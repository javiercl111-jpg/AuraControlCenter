import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { resolvePlatformPrincipal } from "../auth/resolvePlatformPrincipal";
import { getAdvisorActivationUrl } from "../auth/activationConfig";

/**
 * Creates or provisions a Sales Advisor user securely with compensation.
 */
export const provisionCommercialAdvisor = onCall(
  {
    enforceAppCheck: true, // App Check active in production
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }

    const {
      name,
      email,
      phone,
      assignedStates,
      assignedCities,
      specialties,
      commissionPlanId: inputPlanId,
    } = request.data;

    if (!name || !email) {
      throw new HttpsError("invalid-argument", "Nombre y correo son obligatorios.");
    }

    const db = admin.firestore();
    const auth = admin.auth();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Validate Caller using resolvePlatformPrincipal helper
    const caller = await resolvePlatformPrincipal(db, request.auth);

    const targetRole = (request.data.platformRole || "SALES_ADVISOR").trim().toUpperCase();
    const commercialTier = (request.data.commercialTier || "TIER_1").trim().toUpperCase();
    const commissionPlanId = (inputPlanId || "").trim();

    // - solo PLATFORM_OWNER puede crear otro PLATFORM_OWNER;
    if (targetRole === "PLATFORM_OWNER" && caller.role !== "PLATFORM_OWNER") {
      throw new HttpsError("permission-denied", "Solo un PLATFORM_OWNER puede asignar el rol de PLATFORM_OWNER.");
    }
    // - PLATFORM_OWNER, FOUNDER o SUPER_ADMIN pueden asignar PLATFORM_PARTNER;
    const allowedForPartner = ["PLATFORM_OWNER", "FOUNDER", "SUPER_ADMIN"];
    if (targetRole === "PLATFORM_PARTNER" && !allowedForPartner.includes(caller.role)) {
      throw new HttpsError("permission-denied", "No tienes permisos suficientes para asignar el rol PLATFORM_PARTNER.");
    }
    // - SALES_DIRECTOR no puede asignar PLATFORM_PARTNER;
    // - SALES_DIRECTOR solo puede crear perfiles comerciales autorizados inferiores.
    if (caller.role === "SALES_DIRECTOR") {
      const allowedRolesForSalesDir = ["SALES_ADVISOR", "CONSULTANT", "READ_ONLY", "VIEWER"];
      if (!allowedRolesForSalesDir.includes(targetRole)) {
        throw new HttpsError("permission-denied", "Un SALES_DIRECTOR solo puede crear asesores o perfiles comerciales inferiores.");
      }
    }

    const allowedCreatorRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR", "PLATFORM_OWNER", "PLATFORM_PARTNER"];
    if (!allowedCreatorRoles.includes(caller.role)) {
      throw new HttpsError("permission-denied", "Rol insuficiente para crear asesores.");
    }

    const isOwner = caller.role === "SUPER_ADMIN" || caller.role === "FOUNDER" || caller.role === "PLATFORM_OWNER";

    // 2. Check if Email already exists in platform_sales_advisors (No silent reassignments)
    const emailQuery = await db.collection("platform_sales_advisors")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (!emailQuery.empty) {
      throw new HttpsError("already-exists", "El correo ya está registrado con otro asesor comercial en la base de datos.");
    }

    // 3. Check Auth User Existence and conflicts
    let uid = "";
    let authUserCreated = false;
    let authPreExisting = false;

    try {
      const existingUser = await auth.getUserByEmail(normalizedEmail);
      uid = existingUser.uid;
      authPreExisting = true;

      // Validate that pre-existing Auth User is not linked to another advisor
      const uidQuery = await db.collection("platform_sales_advisors")
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (!uidQuery.empty) {
        throw new HttpsError("already-exists", "El usuario de Auth ya está asociado a otro asesor comercial en la base de datos.");
      }
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        try {
          const newUser = await auth.createUser({
            email: normalizedEmail,
            displayName: name,
            emailVerified: false, // Must remain false per security rules
          });
          uid = newUser.uid;
          authUserCreated = true;
        } catch (createErr: any) {
          throw new HttpsError("internal", "Error al crear el usuario en Auth: " + createErr.message);
        }
      } else {
        throw new HttpsError("internal", "Error verificando usuario de Auth: " + e.message);
      }
    }

    // State trackers for compensation logic
    let firestoreDocCreated = false;
    let advisorId = "";
    let commercialCode = "";
    let codeReserved = false;

    try {
      // 4. Generate unique Commercial Code transationally
      let attempt = 0;
      
      // Base generation: First letters of name + random numbers
      const nameParts = name.split(" ");
      const baseChars = nameParts.length >= 2 
        ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
        : nameParts[0].substring(0, 2).toUpperCase();

      while (!codeReserved && attempt < 5) {
        const randomNum = Math.floor(100 + Math.random() * 900); // 3 digits
        const testCode = `${baseChars}${randomNum}`.replace(/[^A-Z0-9]/g, "");

        const codeRef = db.collection("advisor_commercial_codes").doc(testCode);
        
        try {
          await db.runTransaction(async (t) => {
            const doc = await t.get(codeRef);
            if (!doc.exists) {
              // Not used, reserve it
              advisorId = db.collection("platform_sales_advisors").doc().id;
              commercialCode = testCode;
              t.set(codeRef, {
                advisorId,
                uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "RESERVED"
              });
              codeReserved = true;
            }
          });
        } catch (err) {
          // Transaction failed (collision), retry
        }
        attempt++;
      }

      if (!codeReserved) {
        // Fallback: fully random code if collisions persisted
        advisorId = db.collection("platform_sales_advisors").doc().id;
        commercialCode = `ADV${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        await db.collection("advisor_commercial_codes").doc(commercialCode).set({
          advisorId,
          uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "RESERVED_FALLBACK"
        });
        codeReserved = true;
      }

      // 5. Create Profile document in platform_sales_advisors
      await db.collection("platform_sales_advisors").doc(advisorId).set({
        advisorId,
        uid,
        name,
        email: normalizedEmail,
        phone: phone || "",
        commercialCode,
        discoveryLink: `https://controlcenter.auranexus.io/discover/advisor/${commercialCode}`,
        assignedStates: assignedStates || [],
        assignedStateCodes: request.data.assignedStateCodes || [],
        assignedStateLabels: request.data.assignedStateLabels || [],
        assignedCities: assignedCities || [],
        specialties: specialties || [],
        commercialTier,
        commissionPlanId: commissionPlanId || "STANDARD_TIER_1",
        platformRole: targetRole,
        
        authStatus: authPreExisting ? "NOT_CREATED" : "CREATED",
        invitationStatus: "PENDING",
        advisorStatus: "ACTIVE",
        provisioningStatus: "SUCCESS",
        
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      firestoreDocCreated = true;

      // 6. Give the target role in platform_global_admins
      await db.collection("platform_global_admins").doc(uid).set({
        email: normalizedEmail,
        role: targetRole,
        advisorId,
        isActive: true, // Allow login
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // 7. Update Custom Claims
      await auth.setCustomUserClaims(uid, {
        roleCode: targetRole,
        advisorId: advisorId
      });

      // 8. Generate Activation Link (Contingency for Platform Owner only)
      let activationLink = "";
      let invitationStatus = "PENDING";
      
      if (isOwner) {
        try {
          const activationUrl = getAdvisorActivationUrl();
          const actionCodeSettings = {
            url: activationUrl,
            handleCodeInApp: true,
          };
          activationLink = await auth.generatePasswordResetLink(normalizedEmail, actionCodeSettings);
        } catch (err: any) {
          console.warn("Fallo al generar enlace de contingencia:", err.message);
        }
      }

      await db.collection("platform_sales_advisors").doc(advisorId).update({
        invitationStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 8b. Emit event for notifications (ADVISOR_PROVISIONED)
      try {
        const eventId = db.collection("platform_events").doc().id;
        await db.collection("platform_events").doc(eventId).set({
          eventId,
          type: "ADVISOR_PROVISIONED",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          recipientAdvisorId: advisorId,
          actorId: request.auth.uid,
          metadata: {
            advisorId,
            name,
            email: normalizedEmail,
            commercialCode,
          }
        });
      } catch (evtErr) {
        console.error("Fallo al registrar evento ADVISOR_PROVISIONED:", evtErr);
      }

      return {
        success: true,
        advisorId,
        uid,
        commercialCode,
        invitationStatus,
        activationLink: isOwner ? activationLink : null,
        message: "Asesor creado con éxito."
      };

    } catch (dbErr: any) {
      // 9. Full compensation logic: Revert changes in reverse order of creation
      console.warn("[Compensación] Iniciando compensación segura de creación de asesor comercial...");

      if (firestoreDocCreated && advisorId) {
        try {
          await db.collection("platform_sales_advisors").doc(advisorId).delete();
          await db.collection("platform_global_admins").doc(uid).delete();
          console.log(`[Compensación] Perfil Firestore del asesor ${advisorId} eliminado.`);
        } catch (delFsErr: any) {
          console.error(`[Compensación] Error al eliminar perfil Firestore ${advisorId}:`, delFsErr);
        }
      }

      if (codeReserved && commercialCode) {
        try {
          await db.collection("advisor_commercial_codes").doc(commercialCode).delete();
          console.log(`[Compensación] Código comercial reservado ${commercialCode} eliminado.`);
        } catch (delCodeErr: any) {
          console.error(`[Compensación] Error al eliminar código reservado ${commercialCode}:`, delCodeErr);
        }
      }

      if (authUserCreated && uid) {
        try {
          await auth.deleteUser(uid);
          console.log(`[Compensación] Usuario recién creado de Auth ${uid} eliminado.`);
        } catch (delAuthErr: any) {
          console.error(`[Compensación] Error al eliminar usuario de Auth recién creado ${uid}:`, delAuthErr);
        }
      }

      throw new HttpsError("internal", dbErr.message || "Error al completar el aprovisionamiento del asesor.");
    }
  }
);
