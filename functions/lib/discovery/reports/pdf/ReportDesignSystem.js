"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportDesignSystem = void 0;
class ReportDesignSystem {
    branding;
    // PAGE
    pageWidth = 210; // A4 width mm
    pageHeight = 297; // A4 height mm
    margin = {
        top: 25,
        right: 20,
        bottom: 25,
        left: 20
    };
    safeAreaWidth = this.pageWidth - this.margin.left - this.margin.right;
    headerHeight = 20;
    footerHeight = 20;
    // GRID & SPACING
    spacing = {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 40
    };
    // SHAPES
    radii = {
        sm: 1,
        md: 2,
        lg: 4,
        xl: 6
    };
    // COLORS
    colors;
    // TYPOGRAPHY
    typography;
    constructor(branding) {
        this.branding = branding;
        const hexToRgb = (hex) => {
            const h = hex.replace("#", "");
            const r = parseInt(h.substring(0, 2), 16) || 0;
            const g = parseInt(h.substring(2, 4), 16) || 0;
            const b = parseInt(h.substring(4, 6), 16) || 0;
            return [r, g, b];
        };
        this.colors = {
            primary: hexToRgb(branding.primaryColor),
            secondary: hexToRgb(branding.secondaryColor),
            accent: hexToRgb(branding.accentColor),
            surface: hexToRgb(branding.surfaceColor || "#f8fafc"),
            surfaceHover: [241, 245, 249],
            background: hexToRgb(branding.backgroundColor || "#ffffff"),
            textDark: hexToRgb(branding.textColor || "#1e293b"), // slightly darker for better contrast
            textMuted: hexToRgb(branding.mutedTextColor || "#64748b"), // slightly darker
            border: hexToRgb(branding.borderColor || "#e2e8f0"),
            success: [16, 185, 129],
            warning: [245, 158, 11],
            danger: [225, 29, 72], // slightly deeper rose
            info: [14, 165, 233]
        };
        this.typography = {
            displayTitle: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 32, // larger
                lineHeight: 1.3,
                tracking: 0.5,
                color: branding.textColor
            },
            coverSubtitle: {
                fontFamily: "helvetica",
                fontStyle: "normal",
                fontSize: 14,
                lineHeight: 1.4,
                tracking: 2,
                color: branding.mutedTextColor
            },
            sectionTitle: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 18,
                lineHeight: 1.4,
                color: branding.primaryColor
            },
            subsectionTitle: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 12,
                lineHeight: 1.6,
                color: branding.textColor
            },
            cardTitle: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 10,
                lineHeight: 1.4,
                color: branding.textColor
            },
            body: {
                fontFamily: "helvetica",
                fontStyle: "normal",
                fontSize: 10,
                lineHeight: 1.6, // increased for elegance
                color: branding.textColor
            },
            bodyEmphasis: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 10,
                lineHeight: 1.5,
                color: branding.textColor
            },
            metricLarge: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 32,
                lineHeight: 1,
                color: branding.primaryColor
            },
            metricLabel: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 8,
                lineHeight: 1.2,
                tracking: 1,
                color: branding.mutedTextColor
            },
            caption: {
                fontFamily: "helvetica",
                fontStyle: "italic",
                fontSize: 9,
                lineHeight: 1.4,
                color: branding.mutedTextColor
            },
            footer: {
                fontFamily: "helvetica",
                fontStyle: "normal",
                fontSize: 8,
                lineHeight: 1.4,
                color: branding.mutedTextColor
            },
            confidentialLabel: {
                fontFamily: "helvetica",
                fontStyle: "bold",
                fontSize: 9,
                lineHeight: 1.2,
                tracking: 2,
                color: "#dc2626"
            }
        };
    }
}
exports.ReportDesignSystem = ReportDesignSystem;
//# sourceMappingURL=ReportDesignSystem.js.map