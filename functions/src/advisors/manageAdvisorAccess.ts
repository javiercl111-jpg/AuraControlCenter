import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { resolvePlatformPrincipal } from "../auth/resolvePlatformPrincipal";
import { getAdvisorActivationUrl } from "../auth/activationConfig";

/**
 * Permite a administradores autorizados realizar acciones administrativas sobre el acceso de asesores:
 * - reinvite / resetPassword: Genera enlace de activación / restablecimiento.
 * - deactivate: Marca como inactivo, desactiva en platform_global_admins y en Firebase Auth.
 * - reactivate: Marca como activo, activa en platform_global_admins y en Firebase Auth.
 */
export const manageAdvisorAccess = onCall(
  {
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }

    const { action, advisorId } = request.data;
    if (!action || !advisorId) {
      throw new HttpsError("invalid-argument", "Los campos action y advisorId son obligatorios.");
    }

    const db = admin.firestore();
    const auth = admin.auth();

    // 1. Validate Caller using resolvePlatformPrincipal helper
    const caller = await resolvePlatformPrincipal(db, request.auth);

    const allowedRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR", "PLATFORM_OWNER", "PLATFORM_PARTNER", "PARTNER"];
    if (!allowedRoles.includes(caller.role)) {
      throw new HttpsError("permission-denied", "Rol insuficiente para gestionar accesos de asesores.");
    }

    // Only Owner-level admins receive the contingency link
    const isOwner = caller.role === "SUPER_ADMIN" || caller.role === "FOUNDER" || caller.role === "PLATFORM_OWNER";

    // 2. Fetch Advisor Profile
    const advisorDoc = await db.collection("platform_sales_advisors").doc(advisorId).get();
    if (!advisorDoc.exists) {
      throw new HttpsError("not-found", "Asesor comercial no encontrado.");
    }
    const advisorData = advisorDoc.data()!;
    const advisorUid = advisorData.uid;
    const advisorEmail = advisorData.email;

    if (action === "deactivate") {
      // Deactivate profile status
      await db.collection("platform_sales_advisors").doc(advisorId).update({
        advisorStatus: "INACTIVE",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update global admin document if user UID exists
      if (advisorUid) {
        await db.collection("platform_global_admins").doc(advisorUid).update({
          isActive: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Disable Firebase Auth account
        await auth.updateUser(advisorUid, { disabled: true });
      }

      return { success: true, message: "Acceso desactivado con éxito." };
    }

    if (action === "reactivate") {
      // Reactivate profile status
      await db.collection("platform_sales_advisors").doc(advisorId).update({
        advisorStatus: "ACTIVE",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update global admin document if user UID exists
      if (advisorUid) {
        await db.collection("platform_global_admins").doc(advisorUid).update({
          isActive: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Enable Firebase Auth account
        await auth.updateUser(advisorUid, { disabled: false });
      }

      return { success: true, message: "Acceso reactivado con éxito." };
    }

    if (action === "reinvite" || action === "resetPassword") {
      if (!advisorEmail) {
        throw new HttpsError("failed-precondition", "El asesor no tiene un correo electrónico asociado.");
      }

      let activationLink = "";
      let invitationStatus = "PENDING";

      if (isOwner) {
        try {
          const activationUrl = getAdvisorActivationUrl();
          const actionCodeSettings = {
            url: activationUrl,
            handleCodeInApp: true,
          };
          activationLink = await auth.generatePasswordResetLink(advisorEmail, actionCodeSettings);
        } catch (err: any) {
          throw new HttpsError("internal", "Error generando el enlace de contingencia manual: " + err.message);
        }
      }

      await db.collection("platform_sales_advisors").doc(advisorId).update({
        invitationStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        invitationStatus,
        activationLink: isOwner ? activationLink : null,
        message: "Operación completada con éxito."
      };
    }

    throw new HttpsError("invalid-argument", "Acción no soportada.");
  }
);
