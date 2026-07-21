import * as admin from "firebase-admin";
import * as crypto from "crypto";

export interface DiscoverySecurityConfig {
  competitorDomains: string[];
  blockedDisposableDomains: string[];
  trustedDomains: string[];
  restrictedKeywords: string[];
  minimumTrustForPremiumReport: number;
  tokenExpirationHours: number;
  maxSessionsPerEmail: number;
  maxSessionsPerIpHash: number;
  maxLinksPerAdvisorPerDay: number;
}

let cachedConfig: DiscoverySecurityConfig | null = null;
let cacheExpiration = 0;

export async function getDiscoverySecurityConfig(): Promise<DiscoverySecurityConfig> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiration) {
    return cachedConfig;
  }

  const doc = await admin.firestore().collection("platform_settings").doc("discovery_security").get();
  
  const defaultConfig: DiscoverySecurityConfig = {
    competitorDomains: [],
    blockedDisposableDomains: ["tempmail.com", "10minutemail.com", "mailinator.com"],
    trustedDomains: ["auranexus.io", "gmail.com"],
    restrictedKeywords: ["test", "demo", "spam"],
    minimumTrustForPremiumReport: 60,
    tokenExpirationHours: 72,
    maxSessionsPerEmail: 5,
    maxSessionsPerIpHash: 10,
    maxLinksPerAdvisorPerDay: 50,
  };

  if (doc.exists) {
    cachedConfig = { ...defaultConfig, ...doc.data() } as DiscoverySecurityConfig;
  } else {
    cachedConfig = defaultConfig;
  }

  cacheExpiration = now + 5 * 60 * 1000; // 5 minutes cache
  return cachedConfig;
}

export function generateTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function computeTrustScore(email: string, advisorContext: any | null, acquisitionSource: string): Promise<{
  score: number;
  confidence: number;
  signals: string[];
  riskSignals: string[];
  decision: "ALLOW_FULL" | "ALLOW_BASIC" | "REQUIRE_EMAIL_VERIFICATION" | "REQUIRE_MANUAL_REVIEW" | "BLOCK_ABUSE";
  competitiveFlag: boolean;
  competitiveReason?: string;
}> {
  const config = await getDiscoverySecurityConfig();
  const domain = email.split("@")[1]?.toLowerCase() || "";
  
  let score = 50;
  let confidence = 50;
  const signals: string[] = [];
  const riskSignals: string[] = [];
  let competitiveFlag = false;
  let competitiveReason = "";

  if (advisorContext) {
    score += 30;
    confidence += 30;
    signals.push("ADVISOR_ATTRIBUTED");
  }

  if (config.competitorDomains.includes(domain)) {
    score -= 40;
    confidence += 20;
    competitiveFlag = true;
    competitiveReason = `Domain ${domain} is listed as a competitor.`;
    riskSignals.push("COMPETITOR_DOMAIN");
  } else if (config.blockedDisposableDomains.includes(domain)) {
    score -= 30;
    riskSignals.push("DISPOSABLE_EMAIL_DOMAIN");
  } else if (config.trustedDomains.includes(domain)) {
    score += 10;
    signals.push("TRUSTED_DOMAIN");
  } else {
    // Normal corporate domain assumably
    score += 10;
    signals.push("CORPORATE_DOMAIN");
  }

  if (acquisitionSource === "DIRECT" && !advisorContext) {
    confidence -= 10;
  }

  score = Math.max(0, Math.min(100, score));
  confidence = Math.max(0, Math.min(100, confidence));

  let decision: "ALLOW_FULL" | "ALLOW_BASIC" | "REQUIRE_EMAIL_VERIFICATION" | "REQUIRE_MANUAL_REVIEW" | "BLOCK_ABUSE" = "ALLOW_FULL";

  if (competitiveFlag) {
    decision = "ALLOW_BASIC";
  } else if (score < config.minimumTrustForPremiumReport) {
    decision = "REQUIRE_MANUAL_REVIEW";
  }

  return {
    score,
    confidence,
    signals,
    riskSignals,
    decision,
    competitiveFlag,
    competitiveReason
  };
}

export function generateIpHash(ip: string | undefined, saltValue: string): string {
  if (!ip) return "unknown";
  const normalized = ip.trim().split(",")[0];
  return crypto.createHmac("sha256", saltValue).update(normalized).digest("hex");
}

export async function checkIpRateLimit(ipHash: string, limit: number, windowMs: number): Promise<void> {
  const db = admin.firestore();
  const bucketId = Math.floor(Date.now() / windowMs).toString();
  const docId = `${ipHash}_${bucketId}`;
  const ref = db.collection("platform_rate_limits").doc(docId);

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) {
      t.set(ref, { count: 1, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + windowMs) });
    } else {
      const data = snap.data()!;
      if (data.count >= limit) {
        throw new Error("RATE_LIMITED");
      }
      t.update(ref, { count: admin.firestore.FieldValue.increment(1) });
    }
  });
}

