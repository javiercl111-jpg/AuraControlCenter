import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateOpaqueToken, generateTokenHash } from "./discoverySecurityService";
import { FirestoreDiscoveryCapabilityRepository } from
  "../infrastructure/firestore/discoveryCapabilities";
import { toDiscoveryCapabilityHttpsError } from "./discoveryCapabilityHandlerSupport";

export const exchangeDiscoveryToken = functions.https.onCall(async (request) => {
  if (request.app == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "APP_CHECK_REQUIRED"
    );
  }

  const { linkId, oneTimeToken } = request.data;

  if (
    typeof linkId !== "string" ||
    linkId.length > 128 ||
    linkId.includes("/") ||
    typeof oneTimeToken !== "string" ||
    !/^[a-f0-9]{64}$/i.test(oneTimeToken)
  ) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid linkId or oneTimeToken.");
  }

  const db = admin.firestore();
  const sessionAccessToken = generateOpaqueToken();
  const sessionTokenHash = generateTokenHash(sessionAccessToken);
  let linkData: admin.firestore.DocumentData;
  try {
    ({ linkData } = await new FirestoreDiscoveryCapabilityRepository(db)
      .exchangeLegacyLink({ linkId, exchangeToken: oneTimeToken, sessionTokenHash }));
  } catch (error: unknown) {
    throw toDiscoveryCapabilityHttpsError(error);
  }

  return {
    sessionAccessToken,
    linkId,
    trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL",
    companyName: linkData.companyName,
    contactName: linkData.contactName
  };
});
