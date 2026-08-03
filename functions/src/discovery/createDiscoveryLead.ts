import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateOpaqueToken, generateTokenHash, computeTrustScore, getDiscoverySecurityConfig } from "./discoverySecurityService";
import {
  generateDiscoveryCapabilityToken,
  generateIdempotencyHash,
  generateIdempotencyNamespaceHash,
  generateRequestHash,
} from "./idempotencyHelper";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { resolvePlatformPrincipal } from "../auth/resolvePlatformPrincipal";
import {
  DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1,
  isDiscoveryIntakeIdempotencyError,
  type DiscoveryIntakeIdempotencyFailCommandV1,
  type DiscoveryIntakeIdempotencyRepository,
} from "./idempotency";
import {
  FirestoreDiscoveryIntakeIdempotencyRepository,
} from "../infrastructure/firestore/discoveryIntakeIdempotency";

const idempotencySecret = defineSecret("IDEMPOTENCY_SECRET");

function toCallerSafeIdempotencyError(error: unknown): HttpsError | null {
  if (!isDiscoveryIntakeIdempotencyError(error)) return null;
  if (error.code === "IDEMPOTENCY_REQUEST_CONFLICT") {
    return new HttpsError("already-exists", error.code);
  }
  if (error.code === "IDEMPOTENCY_CARDINALITY_EXCEEDED") {
    return new HttpsError("resource-exhausted", error.code);
  }
  if (
    error.code === "IDEMPOTENCY_RECORD_EXPIRED" ||
    error.code === "IDEMPOTENCY_ATTEMPTS_EXCEEDED" ||
    error.code === "IDEMPOTENCY_LEASE_RECOVERY_EXCEEDED"
  ) {
    return new HttpsError("failed-precondition", error.code);
  }
  return new HttpsError("internal", error.code);
}

export const createDiscoveryLead = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    secrets: [idempotencySecret],
  },
  async (request) => {
    let idempotencyRepository: DiscoveryIntakeIdempotencyRepository | null = null;
    let activeAttempt: DiscoveryIntakeIdempotencyFailCommandV1 | null = null;
    try {
      if (request.app == undefined) {
        throw new HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
      }

      const payload = request.data;
      if (!payload) {
        throw new HttpsError("invalid-argument", "INVALID_INPUT");
      }
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
      const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey.trim() : "";

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
      const policyVersion = payload.policyVersion || "legacy-v1";

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

      if (!/^[A-Za-z0-9._:-]{16,100}$/.test(idempotencyKey)) {
        throw new HttpsError("invalid-argument", "INVALID_INPUT");
      }

      const idempotencyHash = generateIdempotencyHash(idempotencyKey, idempotencySecret.value());
      const namespaceHash = generateIdempotencyNamespaceHash(
        email,
        idempotencySecret.value(),
      );
      const requestHash = generateRequestHash({
        ...payload,
        companyName,
        contactName,
        email,
        phone,
        jobTitle,
        state,
        city,
        employeeRange,
        commercialCode,
        origin,
        acquisitionSource,
        privacyConsent,
        diagnosticDeliveryConsent,
        followUpConsent,
        marketingConsent,
        policyVersion,
      });

      const db = admin.firestore();
      idempotencyRepository = new FirestoreDiscoveryIntakeIdempotencyRepository(
        db,
        DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1,
      );

      // 3. Resolve Advisor
      let advisorContext: admin.firestore.DocumentData | null = null;
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

      let authCaller: Awaited<ReturnType<typeof resolvePlatformPrincipal>> | null = null;
      if (request.auth) {
        authCaller = await resolvePlatformPrincipal(db, request.auth);
      }
      const allowedRoles = ["SALES_ADVISOR", "PLATFORM_PARTNER", "SALES_DIRECTOR", "PLATFORM_OWNER", "FOUNDER", "SUPER_ADMIN", "PARTNER"];
      const isAuthorizedCaller = authCaller !== null && allowedRoles.includes(authCaller.role);

      let acquisition;
      try {
        acquisition = await idempotencyRepository.acquire({
          recordId: idempotencyHash,
          requestHash,
          namespaceHash,
          processingAttemptId: generateOpaqueToken(),
        });
      } catch (error: unknown) {
        throw toCallerSafeIdempotencyError(error) ?? error;
      }

      if (acquisition.decision === "PROCESSING") {
        return {
          status: "PROCESSING",
          retryAfterSeconds: acquisition.retryAfterSeconds,
        };
      }

      if (acquisition.decision === "CACHED") {
        const cachedResult = acquisition.result;
        const linkSnap = await db.collection("market_discovery_links")
          .doc(cachedResult.linkId)
          .get();
        if (!linkSnap.exists) {
          throw new HttpsError("internal", "IDEMPOTENCY_RECORD_CORRUPTED");
        }
        const linkData = linkSnap.data()!;
        if (linkData.usageCount > 0) {
          return {
            status: "ERROR",
            nextAction: "SHOW_REVIEW_PENDING",
            publicMessage: "Este enlace ya fue consumido. No se generará otro prospecto.",
          };
        }
        const expiresAt = linkData.expiresAt?.toDate?.().getTime();
        if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
          return {
            status: "ERROR",
            nextAction: "SHOW_REVIEW_PENDING",
            publicMessage: "Este enlace ha expirado.",
          };
        }
        const cachedToken = generateDiscoveryCapabilityToken(
          idempotencyHash,
          cachedResult.capabilityGenerationId,
          idempotencySecret.value(),
        );
        if (linkData.tokenHash !== generateTokenHash(cachedToken)) {
          throw new HttpsError("internal", "IDEMPOTENCY_RECORD_CORRUPTED");
        }
        return {
          status: "SUCCESS",
          nextAction: "REDIRECT_DISCOVERY",
          discoveryUrl:
            `https://controlcenter.auranexus.io/discover/${linkSnap.id}` +
            `#access=${cachedToken}`,
          linkId: linkSnap.id,
          oneTimeToken: cachedToken,
          advisorDisplayName: cachedResult.advisorDisplayName ?? undefined,
          organizationProfile: cachedResult.organizationProfile,
          requiresManualReview: cachedResult.requiresManualReview,
        };
      }

      const processingAttemptId = acquisition.processingAttemptId;
      const isKnownRetry = acquisition.attemptCount > 1;
      activeAttempt = {
        recordId: idempotencyHash,
        requestHash,
        namespaceHash,
        processingAttemptId,
        failureCode: "IDEMPOTENCY_INTERNAL_FAILURE",
      };

      // A retry of an already accepted commercial attempt must not be rejected by
      // a rate limit caused by the original successful creation.
      if (!isKnownRetry) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let recentCount = 0;

        if (isAuthorizedCaller && authCaller) {
          const advisorUid = authCaller.uid || request.auth!.uid;
          const advisorLimitCheck = await db.collection("market_discovery_links")
            .where("createdByUid", "==", advisorUid)
            .get();

          advisorLimitCheck.forEach(doc => {
            const data = doc.data();
            if (data.createdAt && data.createdAt.toDate() > cutoff) {
              recentCount++;
            }
          });

          if (recentCount >= config.maxLinksPerAdvisorPerDay) {
            throw new HttpsError("resource-exhausted", "RATE_LIMITED");
          }
        } else {
          // Query by email only to avoid missing composite index
          const emailLimitCheck = await db.collection("market_discovery_links")
            .where("email", "==", email)
            .get();

          emailLimitCheck.forEach(doc => {
            const data = doc.data();
            if (data.createdAt && data.createdAt.toDate() > cutoff) {
              recentCount++;
            }
          });

          if (recentCount >= config.maxSessionsPerEmail) {
            throw new HttpsError("resource-exhausted", "RATE_LIMITED");
          }
        }
      }

      // 5. Proceed with Creation

      const trustScoreResult = await computeTrustScore(email, advisorContext, acquisitionSource);

      const oneTimeToken = generateDiscoveryCapabilityToken(
        idempotencyHash,
        processingAttemptId,
        idempotencySecret.value(),
      );
      const tokenHash = generateTokenHash(oneTimeToken);
      const expirationDate = new Date(Date.now() + config.tokenExpirationHours * 60 * 60 * 1000);

      const consentsPayload = {
        privacy: { value: privacyConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
        diagnosticDelivery: { value: diagnosticDeliveryConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
        followUp: { value: followUpConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
        marketing: { value: marketingConsent, capturedAt: new Date().toISOString(), policyVersion, source: "AURA_NEXUS", origin },
      };

      const linkPayload: admin.firestore.DocumentData = {
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

      if (isAuthorizedCaller && authCaller) {
        linkPayload.advisorUid = authCaller.uid || request.auth!.uid;
        if (authCaller.advisorId) {
          linkPayload.advisorId = authCaller.advisorId;
          linkPayload.originalAdvisorId = authCaller.advisorId;
          linkPayload.currentAdvisorId = authCaller.advisorId;
        }
        linkPayload.originalAdvisorUid = authCaller.uid || request.auth!.uid;
        linkPayload.currentAdvisorUid = authCaller.uid || request.auth!.uid;
        linkPayload.createdByUid = request.auth!.uid;
        linkPayload.createdByRole = authCaller.role;
        linkPayload.assignmentType = "ORIGIN";
        linkPayload.attributedAt = admin.firestore.FieldValue.serverTimestamp();
        linkPayload.attributionSource = "DISCOVERY_CRM_CREATE";
      } else if (advisorContext) {
        linkPayload.assignmentType = "ORIGIN";
        linkPayload.originalAdvisorId = advisorContext.id;
        linkPayload.originalAdvisorUid = advisorContext.uid;
        linkPayload.currentAdvisorId = advisorContext.id;
        linkPayload.currentAdvisorUid = advisorContext.uid;
        linkPayload.commercialCode = commercialCode;
        linkPayload.attributedAt = admin.firestore.FieldValue.serverTimestamp();
        linkPayload.attributionSource = "DISCOVERY_PRE_FORM";
        linkPayload.advisorUid = advisorContext.uid;
        linkPayload.advisorId = advisorContext.id;
      } else {
        linkPayload.assignmentType = "UNASSIGNED";
      }

      const docRef = db.collection("market_discovery_links").doc();

      // The adapter creates the lead and closes the fenced idempotency attempt in
      // the same Firestore transaction. Transaction retries reuse the same doc id.
      try {
        await idempotencyRepository.complete(
          {
            recordId: idempotencyHash,
            requestHash,
            namespaceHash,
            processingAttemptId,
            result: {
              linkId: docRef.id,
              capabilityGenerationId: processingAttemptId,
              advisorDisplayName: advisorContext
                ? (advisorContext.displayName || advisorContext.name || null)
                : null,
              organizationProfile: "UNKNOWN",
              requiresManualReview:
                trustScoreResult.decision === "REQUIRE_MANUAL_REVIEW",
            },
          },
          {
            operation: "CREATE",
            collectionPath: "market_discovery_links",
            documentId: docRef.id,
            data: linkPayload,
          },
        );
      } catch (error: unknown) {
        throw toCallerSafeIdempotencyError(error) ?? error;
      }
      activeAttempt = null;

      const discoveryUrl = `https://controlcenter.auranexus.io/discover/${docRef.id}#access=${oneTimeToken}`;

      return {
        status: "SUCCESS",
        nextAction: "REDIRECT_DISCOVERY",
        discoveryUrl,
        linkId: docRef.id,
        oneTimeToken,
        advisorDisplayName: advisorContext ? (advisorContext.displayName || advisorContext.name) : undefined,
        organizationProfile: "UNKNOWN",
        requiresManualReview: trustScoreResult.decision === "REQUIRE_MANUAL_REVIEW"
      };
    } catch (error: unknown) {
      if (idempotencyRepository !== null && activeAttempt !== null) {
        try {
          await idempotencyRepository.fail(activeAttempt);
        } catch (failureError: unknown) {
          logger.warn("Unable to close Discovery idempotency attempt", {
            code: isDiscoveryIntakeIdempotencyError(failureError)
              ? failureError.code
              : "IDEMPOTENCY_INTERNAL_FAILURE",
          });
        }
      }
      const errorDetails = error instanceof Error
        ? { message: error.message, code: (error as Error & { code?: unknown }).code, stack: error.stack }
        : { message: "UNKNOWN", code: undefined, stack: undefined };
      logger.error("Unhandled error in createDiscoveryLead", { 
        message: errorDetails.message,
        code: errorDetails.code,
        stack: errorDetails.stack,
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      const callerSafeIdempotencyError = toCallerSafeIdempotencyError(error);
      if (callerSafeIdempotencyError !== null) {
        throw callerSafeIdempotencyError;
      }
      throw new HttpsError("internal", "INTERNAL");
    }
  }
);
