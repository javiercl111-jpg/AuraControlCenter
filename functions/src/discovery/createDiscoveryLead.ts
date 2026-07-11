import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateOpaqueToken, generateTokenHash, computeTrustScore, getDiscoverySecurityConfig } from "./discoverySecurityService";
import { generateIdempotencyHash, generateRequestHash } from "./idempotencyHelper";

export const createDiscoveryLead = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
  },
  async (request) => {
    if (request.app == undefined) {
      throw new HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
    }

    const payload = request.data;
    if (JSON.stringify(payload).length > 5000) {
      throw new HttpsError("out-of-range", "Payload too large.");
    }

    // 1. Extract & Sanitize
    const companyName = (payload.companyName || "").substring(0, 100).trim();
    const contactName = (payload.contactName || "").substring(0, 100).trim();
    const email = (payload.email || "").toLowerCase().trim();
    const phone = (payload.phone || "").substring(0, 20).trim();
    const jobTitle = (payload.jobTitle || payload.role || "").substring(0, 50).trim();
    const state = (payload.state || payload.location || "").substring(0, 50).trim();
    const city = (payload.city || "").substring(0, 50).trim();
    const employeeRange = (payload.employeeRange || "").substring(0, 50).trim();
    const commercialCode = (payload.commercialCode || "").substring(0, 20).toUpperCase().trim();
    const idempotencyKey = payload.idempotencyKey;

    let origin = payload.origin === "WEBSITE" ? "WEBSITE" : "ADVISOR_SHARE";
    if (payload.origin === "AURA_NEXUS" || payload.origin === "WEBSITE") {
        origin = payload.origin;
    }
    const acquisitionSource = payload.acquisitionSource === "AURA_NEXUS" ? "AURA_NEXUS" : "DIRECT";

    // 2. Validate Consents
    let privacyConsent = false;
    let diagnosticDeliveryConsent = false;
    let followUpConsent = false;
    let marketingConsent = false;
    let policyVersion = payload.policyVersion || "legacy-v1";

    if (typeof payload.consent === "boolean" && payload.consent) {
      privacyConsent = true;
      diagnosticDeliveryConsent = true;
      followUpConsent = false;
      marketingConsent = false;
    } else {
      privacyConsent = payload.privacyConsent === true;
      diagnosticDeliveryConsent = payload.diagnosticDeliveryConsent === true;
      followUpConsent = payload.followUpConsent === true;
      marketingConsent = payload.marketingConsent === true;
    }

    if (!companyName || !contactName || !email) {
      throw new HttpsError("invalid-argument", "INVALID_INPUT");
    }

    if (!privacyConsent || !diagnosticDeliveryConsent) {
      throw new HttpsError("invalid-argument", "INVALID_INPUT");
    }

    if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length > 100) {
      throw new HttpsError("invalid-argument", "INVALID_INPUT");
    }

    const idempotencyHash = generateIdempotencyHash(idempotencyKey);
    const requestHash = generateRequestHash(payload);

    const db = admin.firestore();
    const idempotencyRef = db.collection("discovery_intake_idempotency").doc(idempotencyHash);

    // 3. Resolve Advisor
    let advisorContext: any = null;
    if (commercialCode) {
      const q = await db.collection("advisor_commercial_codes").doc(commercialCode).get();
      if (q.exists && q.data()?.status === "ACTIVE") {
        const advId = q.data()?.advisorId;
        if (advId) {
          const advSnap = await db.collection("platform_sales_advisors").doc(advId).get();
          if (advSnap.exists && advSnap.data()?.advisorStatus === "ACTIVE") {
            advisorContext = { id: advSnap.id, ...advSnap.data() };
            origin = "ADVISOR_SHARE";
          }
        }
      }
    }

    const config = await getDiscoverySecurityConfig();

    // Rate limits check
    const emailLimitCheck = await db.collection("market_discovery_links")
      .where("email", "==", email)
      .where("createdAt", ">", new Date(Date.now() - 24 * 60 * 60 * 1000))
      .get();

    if (emailLimitCheck.size >= config.maxSessionsPerEmail) {
      throw new HttpsError("resource-exhausted", "RATE_LIMITED");
    }

    // 4. Idempotency Transaction
    try {
      const transactionResult = await db.runTransaction(async (t) => {
        const idempSnap = await t.get(idempotencyRef);
        
        if (idempSnap.exists) {
          const idempData = idempSnap.data()!;
          
          if (idempData.requestHash !== requestHash) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }

          if (idempData.status === "PROCESSING") {
            // Check if lease expired (e.g. 1 minute)
            const leaseExpired = idempData.processingLeaseExpiresAt && idempData.processingLeaseExpiresAt.toDate() < new Date();
            if (!leaseExpired) {
               throw new Error("PROCESSING");
            }
          } else if (idempData.status === "COMPLETED") {
             // Let's resolve the access
             return { type: "CACHED", idempData };
          } else if (idempData.status === "FAILED_FINAL") {
             throw new Error("FAILED_FINAL");
          }
        }

        // Lock for processing
        t.set(idempotencyRef, {
          status: "PROCESSING",
          requestHash,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          processingLeaseExpiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 60000)),
          attemptCount: admin.firestore.FieldValue.increment(1)
        }, { merge: true });

        return { type: "NEW" };
      });

      if (transactionResult.type === "CACHED" && transactionResult.idempData) {
        const linkSnap = await db.collection("market_discovery_links").doc(transactionResult.idempData.linkId).get();
        if (!linkSnap.exists) {
          throw new HttpsError("internal", "Link no encontrado.");
        }
        const linkData = linkSnap.data()!;
        
        if (linkData.usageCount > 0) {
           return {
             status: "ERROR",
             nextAction: "SHOW_REVIEW_PENDING",
             publicMessage: "Este enlace ya fue consumido. No se generará otro prospecto."
           };
        }

        // Generate a new opaque token (re-issue controlled) since we don't store the old opaque token
        const newOneTimeToken = generateOpaqueToken();
        const newHash = generateTokenHash(newOneTimeToken);
        const expiresAt = linkData.expiresAt.toDate().getTime();

        if (expiresAt < Date.now()) {
           return {
             status: "ERROR",
             nextAction: "SHOW_REVIEW_PENDING",
             publicMessage: "Este enlace ha expirado."
           };
        }

        await linkSnap.ref.update({
          tokenHash: newHash,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const discoveryUrl = `https://controlcenter.auranexus.io/discover/${linkSnap.id}?access=${newOneTimeToken}`;

        return {
          status: "SUCCESS",
          nextAction: "REDIRECT_DISCOVERY",
          discoveryUrl,
          advisorDisplayName: advisorContext ? (advisorContext.displayName || advisorContext.name) : undefined,
          organizationProfile: "UNKNOWN",
          requiresManualReview: linkData.trustScore?.decision === "REQUIRE_MANUAL_REVIEW"
        };
      }

      if (transactionResult.type === "PROCESSING") {
        return {
          status: "PROCESSING",
          retryAfterSeconds: 3
        };
      }

    } catch (e: any) {
      if (e.message === "IDEMPOTENCY_CONFLICT") {
        throw new HttpsError("already-exists", "IDEMPOTENCY_CONFLICT");
      }
      if (e.message === "PROCESSING") {
        return { status: "PROCESSING", retryAfterSeconds: 3 };
      }
      if (e.message === "FAILED_FINAL") {
        throw new HttpsError("internal", "Error procesando solicitud previamente.");
      }
      throw e;
    }

    // 5. Proceed with Creation
    const trustScoreResult = await computeTrustScore(email, advisorContext, acquisitionSource);

    const oneTimeToken = generateOpaqueToken();
    const tokenHash = generateTokenHash(oneTimeToken);
    const expirationDate = new Date(Date.now() + config.tokenExpirationHours * 60 * 60 * 1000);

    const consentsPayload = {
      privacy: { value: privacyConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
      diagnosticDelivery: { value: diagnosticDeliveryConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
      followUp: { value: followUpConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
      marketing: { value: marketingConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
    };

    const linkPayload: any = {
      companyName,
      contactName,
      email,
      phone,
      jobTitle,
      role: jobTitle,
      state,
      location: state,
      city,
      employeeRange,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "createDiscoveryLead_function",
      origin,
      acquisitionSource,
      tokenHash,
      expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
      usageCount: 0,
      trustScore: trustScoreResult,
      consents: consentsPayload
    };

    if (advisorContext) {
      linkPayload.assignmentType = "ORIGIN";
      linkPayload.originalAdvisorId = advisorContext.id;
      linkPayload.originalAdvisorUid = advisorContext.uid;
      linkPayload.currentAdvisorId = advisorContext.id;
      linkPayload.currentAdvisorUid = advisorContext.uid;
      linkPayload.commercialCode = commercialCode;
      linkPayload.attributedAt = admin.firestore.FieldValue.serverTimestamp();
      linkPayload.attributionSource = "DISCOVERY_PRE_FORM";
    } else {
      linkPayload.assignmentType = "UNASSIGNED";
    }

    const docRef = await db.collection("market_discovery_links").add(linkPayload);

    // Update Idempotency
    await idempotencyRef.update({
      status: "COMPLETED",
      linkId: docRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // retain 30 days
    });

    const discoveryUrl = `https://controlcenter.auranexus.io/discover/${docRef.id}?access=${oneTimeToken}`;

    return {
      status: "SUCCESS",
      nextAction: "REDIRECT_DISCOVERY",
      discoveryUrl,
      advisorDisplayName: advisorContext ? (advisorContext.displayName || advisorContext.name) : undefined,
      organizationProfile: "UNKNOWN",
      requiresManualReview: trustScoreResult.decision === "REQUIRE_MANUAL_REVIEW"
    };
  }
);
