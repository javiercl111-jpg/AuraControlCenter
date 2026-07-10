"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfAssetLoader = void 0;
const fs = require("fs");
const path = require("path");
class PdfAssetLoader {
    static cachedLogoBase64 = null;
    /**
     * Loads the official fallback logo from the local assets folder.
     * Converts it to a base64 string suitable for jsPDF.
     */
    static async loadFallbackLogoBase64() {
        if (this.cachedLogoBase64) {
            return this.cachedLogoBase64;
        }
        try {
            // Depending on if we are running in src/ or lib/, we need to resolve the path
            let assetPath = path.resolve(__dirname, "../../../../src/assets/branding/aura-logo-oficial-800.png");
            if (!fs.existsSync(assetPath)) {
                // Fallback for different build structures
                assetPath = path.resolve(__dirname, "../../../assets/branding/aura-logo-oficial-800.png");
            }
            if (!fs.existsSync(assetPath)) {
                console.warn("[PdfAssetLoader] Fallback logo not found at: " + assetPath);
                return null;
            }
            const buffer = fs.readFileSync(assetPath);
            const base64 = buffer.toString("base64");
            this.cachedLogoBase64 = base64;
            return base64;
        }
        catch (e) {
            console.error("[PdfAssetLoader] Failed to load fallback logo", e.message);
            return null;
        }
    }
}
exports.PdfAssetLoader = PdfAssetLoader;
//# sourceMappingURL=PdfAssetLoader.js.map