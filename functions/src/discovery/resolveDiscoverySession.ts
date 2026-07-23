import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateTokenHash } from "./discoverySecurityService";

export const resolveDiscoverySession = functions.https.onCall(async (request) => {
  if (request.app == undefined) {
    throw new functions.https.HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
  }

  const { linkId, sessionToken } = request.data;

  if (
    typeof linkId !== "string" ||
    linkId.length > 128 ||
    linkId.includes("/") ||
    typeof sessionToken !== "string" ||
    !/^[a-f0-9]{64}$/i.test(sessionToken)
  ) {
    throw new functions.https.HttpsError("invalid-argument", "Missing linkId or sessionToken.");
  }

  const db = admin.firestore();
  const linkSnap = await db.collection("market_discovery_links").doc(linkId).get();

  if (!linkSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Session not found.");
  }

  const linkData = linkSnap.data()!;
  const sessionTokenHash = generateTokenHash(sessionToken);

  if (linkData.sessionTokenHash !== sessionTokenHash) {
    throw new functions.https.HttpsError("permission-denied", "Invalid session token.");
  }

  const expiresAt = linkData.sessionTokenExpiresAt || linkData.expiresAt;
  if (!expiresAt || typeof expiresAt.toMillis !== "function" || expiresAt.toMillis() <= Date.now()) {
    throw new functions.https.HttpsError("permission-denied", "Session token expired.");
  }

  // Return non-sensitive data
  return {
    id: linkSnap.id,
    companyName: linkData.companyName,
    contactName: linkData.contactName,
    status: linkData.status,
    trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL"
  };
});
