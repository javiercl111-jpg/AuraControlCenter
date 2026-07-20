import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { resolvePlatformPrincipal } from "../auth/resolvePlatformPrincipal";
import { PlatformLeadV2, ProspectLifecycleStatus, LifecycleEventType } from "./types";

export const updateProspectCommercialStage = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión.");
  }
  
  if (request.app == undefined) {
    throw new functions.https.HttpsError("failed-precondition", "App Check requerido.");
  }

  const db = admin.firestore();
  const caller = await resolvePlatformPrincipal(db, request.auth);
  const data = request.data;
  
  if (!data.dossierId || !data.action) {
    throw new functions.https.HttpsError("invalid-argument", "dossierId y action son requeridos.");
  }
  
  // 1. Leer discovery_sessions/{dossierId}
  const sessionRef = db.collection("discovery_sessions").doc(data.dossierId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Dossier no encontrado.");
  }
  
  const sessionData = sessionSnap.data()!;
  const prospectId = sessionData.prospectId;
  
  if (!prospectId) {
    throw new functions.https.HttpsError("data-loss", "Sesión de Discovery no tiene un prospectId asociado (integridad comprometida).");
  }

  // 3. Leer directamente platform_leads/{prospectId}
  const leadRef = db.collection("platform_leads").doc(prospectId);
  const leadSnap = await leadRef.get();

  if (!leadSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Prospecto no encontrado para el dossier especificado.");
  }

  const prospect = leadSnap.data() as PlatformLeadV2;

  // 5. RBAC Validación
  const allowedRoles = ["PLATFORM_OWNER", "PLATFORM_PARTNER", "SALES_DIRECTOR", "SUPER_ADMIN", "FOUNDER"];
  if (!allowedRoles.includes(caller.role)) {
    if (caller.role !== "SALES_ADVISOR" || (prospect.ownerUid !== caller.uid && prospect.currentAdvisorUid !== caller.uid)) {
      throw new functions.https.HttpsError("permission-denied", "Acceso denegado: no es propietario del prospecto.");
    }
  }
  
  // Variables para la transacción
  const now = admin.firestore.FieldValue.serverTimestamp();
  const updates: any = {};
  
  const currentStage = prospect.lifecycleStatus;
  let newStage = currentStage;
  let eventType: LifecycleEventType | null = null;
  // Identificador idempotente basado en estado, acción y dossier
  const eventId = `commercial_event_${prospectId}_${data.action}`;
  
  if (data.action === "MARK_CONTACTED") {
    // Si ya está en una etapa igual o posterior, es idempotente.
    const advancedStages: string[] = ["CONTACTED", "DEMO_SCHEDULED", "PROPOSAL_PENDING", "NEGOTIATION", "CUSTOMER"];
    if (advancedStages.includes(currentStage)) {
      return { success: true, message: "Prospecto ya está contactado o en etapa posterior." };
    }
    
    newStage = "CONTACTED" as ProspectLifecycleStatus;
    updates.lifecycleStatus = newStage;
    updates.lastContactAt = now;
    updates.lastContactedByUid = caller.uid;
    updates.updatedAt = now;
    eventType = "PROSPECT_CONTACTED";
  } 
  else if (data.action === "SCHEDULE_DEMO") {
    if (currentStage === "DEMO_SCHEDULED" || currentStage === "PROPOSAL_PENDING" || currentStage === "NEGOTIATION" || currentStage === "CUSTOMER") {
      return { success: true, message: "Prospecto ya tiene demo programada o está en etapa posterior." };
    }
    
    if (!data.scheduledAt || !data.timezone) {
      throw new functions.https.HttpsError("invalid-argument", "scheduledAt y timezone son obligatorios.");
    }
    
    const parsedDate = new Date(data.scheduledAt);
    if (isNaN(parsedDate.getTime()) || parsedDate.getTime() < Date.now()) {
      throw new functions.https.HttpsError("invalid-argument", "Fecha de demo no válida o es pasada.");
    }
    
    // Validate IANA timezone
    try {
      Intl.DateTimeFormat(undefined, { timeZone: data.timezone });
    } catch (e) {
      throw new functions.https.HttpsError("invalid-argument", "Zona horaria no válida.");
    }
    
    let notes = (data.notes || "").substring(0, 1000);
    
    newStage = "DEMO_SCHEDULED" as ProspectLifecycleStatus;
    updates.lifecycleStatus = newStage;
    updates.demoScheduledAt = admin.firestore.Timestamp.fromDate(parsedDate);
    updates.demoTimezone = data.timezone;
    updates.demoNotes = notes;
    updates.demoScheduledByUid = caller.uid;
    updates.updatedAt = now;
    eventType = "DEMO_SCHEDULED";
  }
  else {
    throw new functions.https.HttpsError("invalid-argument", "Acción comercial no soportada.");
  }
  
  await db.runTransaction(async (t) => {
    // Verificación final
    const currentSnap = await t.get(leadRef);
    if (!currentSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Prospecto ya no existe.");
    }
    
    // Validate the event doesn't already exist for idempotency
    const eventRef = db.collection("platform_events").doc(eventId);
    const eventSnap = await t.get(eventRef);
    if (eventSnap.exists) {
        // Evento ya fue procesado, no hacemos nada extra para garantizar idempotencia
        return;
    }

    const currentData = currentSnap.data() as PlatformLeadV2;
    
    // Si falta smartBusinessDossierId, repararlo dentro de la transacción
    if (!currentData.smartBusinessDossierId || currentData.smartBusinessDossierId !== data.dossierId) {
       updates.smartBusinessDossierId = data.dossierId;
    }

    t.update(leadRef, updates);
    
    const eventData = {
      eventId: eventId,
      type: eventType,
      prospectId: prospectId,
      dossierId: data.dossierId,
      actorUid: caller.uid,
      actorRole: caller.role,
      previousStage: currentStage,
      newStage: newStage,
      createdAt: now,
      source: "CRM_DISCOVERY_DOSSIER"
    };
    t.set(eventRef, eventData);
  });
  
  return {
    success: true,
    lifecycleStatus: newStage
  };
});
