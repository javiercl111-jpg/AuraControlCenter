import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateOpaqueToken, generateTokenHash } from "./discoverySecurityService";

export const exchangeDiscoveryToken = functions.https.onCall(async (request) => {
  if (request.app == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "APP_CHECK_REQUIRED"
    );
  }

  const { linkId, oneTimeToken } = request.data;

  if (!linkId || !oneTimeToken) {
    throw new functions.https.HttpsError("invalid-argument", "Missing linkId or oneTimeToken.");
  }

  const db = admin.firestore();
  const linkRef = db.collection("market_discovery_links").doc(linkId);
  const linkSnap = await linkRef.get();

  if (!linkSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Link not found.");
  }

  const linkData = linkSnap.data() as any;

  if (linkData.status !== "pending") {
    throw new functions.https.HttpsError("failed-precondition", "Link is no longer pending.");
  }

  const tokenHash = generateTokenHash(oneTimeToken);

  if (linkData.tokenHash !== tokenHash) {
    throw new functions.https.HttpsError("permission-denied", "Invalid token.");
  }

  const now = admin.firestore.Timestamp.now();
  if (linkData.expiresAt && linkData.expiresAt.toDate() < now.toDate()) {
    throw new functions.https.HttpsError("failed-precondition", "Token has expired.");
  }

  if (linkData.usageCount > 0) {
    throw new functions.https.HttpsError("failed-precondition", "Token already used.");
  }

  // Generate session token
  const sessionAccessToken = generateOpaqueToken();
  const sessionTokenHash = generateTokenHash(sessionAccessToken);

  await linkRef.update({
    usageCount: admin.firestore.FieldValue.increment(1),
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
    sessionTokenHash
  });

  return {
    sessionAccessToken,
    linkId,
    trustScoreDecision: linkData.trustScore?.decision || "ALLOW_FULL",
    companyName: linkData.companyName,
    contactName: linkData.contactName
  };
});
