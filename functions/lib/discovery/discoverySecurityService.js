"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscoverySecurityConfig = getDiscoverySecurityConfig;
exports.generateTokenHash = generateTokenHash;
exports.generateOpaqueToken = generateOpaqueToken;
exports.computeTrustScore = computeTrustScore;
const admin = require("firebase-admin");
const crypto = require("crypto");
let cachedConfig = null;
let cacheExpiration = 0;
async function getDiscoverySecurityConfig() {
    const now = Date.now();
    if (cachedConfig && now < cacheExpiration) {
        return cachedConfig;
    }
    const doc = await admin.firestore().collection("platform_settings").doc("discovery_security").get();
    const defaultConfig = {
        competitorDomains: [],
        blockedDisposableDomains: ["tempmail.com", "10minutemail.com", "mailinator.com"],
        trustedDomains: ["auranexus.io", "gmail.com"],
        restrictedKeywords: ["test", "demo", "spam"],
        minimumTrustForPremiumReport: 60,
        tokenExpirationHours: 72,
        maxSessionsPerEmail: 5,
        maxSessionsPerIpHash: 10,
    };
    if (doc.exists) {
        cachedConfig = { ...defaultConfig, ...doc.data() };
    }
    else {
        cachedConfig = defaultConfig;
    }
    cacheExpiration = now + 5 * 60 * 1000; // 5 minutes cache
    return cachedConfig;
}
function generateTokenHash(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
function generateOpaqueToken() {
    return crypto.randomBytes(32).toString("hex");
}
async function computeTrustScore(email, advisorContext, acquisitionSource) {
    const config = await getDiscoverySecurityConfig();
    const domain = email.split("@")[1]?.toLowerCase() || "";
    let score = 50;
    let confidence = 50;
    const signals = [];
    const riskSignals = [];
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
    }
    else if (config.blockedDisposableDomains.includes(domain)) {
        score -= 30;
        riskSignals.push("DISPOSABLE_EMAIL_DOMAIN");
    }
    else if (config.trustedDomains.includes(domain)) {
        score += 10;
        signals.push("TRUSTED_DOMAIN");
    }
    else {
        // Normal corporate domain assumably
        score += 10;
        signals.push("CORPORATE_DOMAIN");
    }
    if (acquisitionSource === "DIRECT" && !advisorContext) {
        confidence -= 10;
    }
    score = Math.max(0, Math.min(100, score));
    confidence = Math.max(0, Math.min(100, confidence));
    let decision = "ALLOW_FULL";
    if (competitiveFlag) {
        decision = "ALLOW_BASIC";
    }
    else if (score < config.minimumTrustForPremiumReport) {
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
//# sourceMappingURL=discoverySecurityService.js.map