"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandingEngine = void 0;
const admin = require("firebase-admin");
class BrandingEngine {
    static cachedProfile = null;
    static cacheTimestamp = 0;
    static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    /**
     * Fetches the executive branding profile from platform_settings/executive_branding.
     * If not found or inactive, falls back to the default official Aura branding.
     */
    static async getBrandingProfile() {
        const now = Date.now();
        if (this.cachedProfile && (now - this.cacheTimestamp < this.CACHE_TTL_MS)) {
            return this.cachedProfile;
        }
        try {
            const db = admin.firestore();
            const doc = await db.collection("platform_settings").doc("executive_branding").get();
            if (doc.exists) {
                const data = doc.data();
                if (data.isActive) {
                    this.cachedProfile = data;
                    this.cacheTimestamp = now;
                    return data;
                }
            }
        }
        catch (e) {
            console.error("[BrandingEngine] Failed to fetch branding profile", e.message);
        }
        // Fallback to Official Aura Branding
        const fallback = {
            brandId: "aura-official",
            brandName: "Aura Intelligence",
            logoUrl: "", // Handled by PdfAssetLoader directly if missing
            localAssetKey: "aura-logo-oficial-800.png",
            primaryColor: "#071426", // AURA_NAVY
            secondaryColor: "#22d3ee", // AURA_CYAN
            accentColor: "#6366f1", // AURA_MAGENTA
            surfaceColor: "#0f172a",
            backgroundColor: "#ffffff",
            textColor: "#334155", // TEXT_DARK
            mutedTextColor: "#94a3b8", // TEXT_MUTED
            borderColor: "#e2e8f0", // BORDER
            website: "auranexus.io",
            email: "admin@auranexus.io",
            whatsapp: "442-350-8472",
            footerText: "Aura Nexus · admin@auranexus.io · 442-350-8472 · auranexus.io",
            confidentialityText: "Documento confidencial preparado exclusivamente para",
            advisorPresentationEnabled: true,
            verificationEnabled: false,
            isActive: true,
            version: "1.0",
            updatedAt: new Date().toISOString(),
            updatedBy: "SYSTEM"
        };
        this.cachedProfile = fallback;
        this.cacheTimestamp = now;
        return fallback;
    }
}
exports.BrandingEngine = BrandingEngine;
//# sourceMappingURL=BrandingEngine.js.map