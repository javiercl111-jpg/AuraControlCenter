import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateIpHash, checkIpRateLimit } from "../discovery/discoverySecurityService";

export const resolveAdvisorByCode = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
  },
  async (request) => {
    // 1. IP Rate Limiting
    const ipHash = generateIpHash(request.rawRequest?.ip);
    try {
      // Limit to 10 attempts per hour per IP
      await checkIpRateLimit(ipHash, 10, 60 * 60 * 1000);
    } catch (e: any) {
      if (e.message === "RATE_LIMITED") {
        throw new HttpsError("resource-exhausted", "RATE_LIMITED");
      }
      throw new HttpsError("internal", "Error en el servidor");
    }

    const { commercialCode } = request.data;
    if (!commercialCode || typeof commercialCode !== "string") {
      throw new HttpsError("invalid-argument", "INVALID_INPUT");
    }

    const normalizedCode = commercialCode.trim().toUpperCase();
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return {
        status: "INVALID",
        publicMessage: "No pudimos validar el contexto del consultor."
      };
    }

    const db = admin.firestore();
    
    // O(1) canonical reservation lookup
    const codeRef = db.collection("advisor_commercial_codes").doc(normalizedCode);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      return {
        status: "INVALID",
        publicMessage: "No pudimos validar el contexto del consultor."
      };
    }

    const codeData = codeSnap.data()!;
    if (codeData.status !== "ACTIVE") {
      return {
        status: "INVALID",
        publicMessage: "No pudimos validar el contexto del consultor."
      };
    }

    const advisorId = codeData.advisorId;
    if (!advisorId) {
      return {
        status: "INVALID",
        publicMessage: "No pudimos validar el contexto del consultor."
      };
    }

    // Read the advisor profile
    const advisorRef = db.collection("platform_sales_advisors").doc(advisorId);
    const advisorSnap = await advisorRef.get();

    if (!advisorSnap.exists) {
      return {
        status: "INVALID",
        publicMessage: "No pudimos validar el contexto del consultor."
      };
    }

    const advisorData = advisorSnap.data()!;
    if (advisorData.advisorStatus !== "ACTIVE") {
      return {
        status: "INVALID",
        publicMessage: "No pudimos validar el contexto del consultor."
      };
    }

    return {
      status: "VALID",
      advisorDisplayName: advisorData.displayName || advisorData.name,
      publicMessage: `Estás conectado con ${advisorData.displayName || advisorData.name}`
    };
  }
);
