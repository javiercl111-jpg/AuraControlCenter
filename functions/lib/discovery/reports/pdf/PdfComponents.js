"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfComponents = void 0;
const PdfAssetLoader_1 = require("./PdfAssetLoader");
class PdfComponents {
    static async drawAuraLogo(doc, ds, x, y, maxWidth, maxHeight) {
        try {
            const logoData = await PdfAssetLoader_1.PdfAssetLoader.loadFallbackLogoBase64();
            if (!logoData)
                throw new Error("Logo not found");
            // Approximate original dimensions of aura-logo-oficial-800.png (assume 800x480 as standard 5:3 or similar)
            // Since we can't measure image dimensions natively in base64 easily without DOM, we'll assume a 16:9 or 3:1 ratio.
            // Wait, let's use a safe bounding box that preserves ratio if we assume 3:1.
            // Actually, we can just pass an alias and let jsPDF handle it? jsPDF requires w/h.
            // We will assume 800x240 (roughly 3.33 aspect ratio) based on typical logos.
            const originalW = 800;
            const originalH = 260;
            const ratio = originalW / originalH;
            let w = maxWidth;
            let h = w / ratio;
            if (h > maxHeight) {
                h = maxHeight;
                w = h * ratio;
            }
            // Center it within the maxWidth if it shrinks
            const xOffset = (maxWidth - w) / 2;
            doc.addImage(logoData, "PNG", x + xOffset, y, w, h);
            return h;
        }
        catch (err) {
            // Fallback
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
            doc.text("Aura Intelligence", x, y + 10);
            return 15;
        }
    }
    static drawMaturityGauge(doc, ds, layout, score, centerX, yPos, radius) {
        const safeScore = score === null || isNaN(score) ? 0 : Math.max(0, Math.min(100, score));
        // Background circle (muted)
        doc.setDrawColor(ds.colors.border[0], ds.colors.border[1], ds.colors.border[2]);
        doc.setLineWidth(4);
        doc.circle(centerX, yPos, radius, "S");
        // Progress arc
        // In jsPDF, drawing arcs requires custom path or lines.
        // Instead of a complex bezier approximation for an arc, we can draw a filled pie or segmented lines,
        // OR we can use the jsPDF API if available. jsPDF has `doc.arc` in some versions, or `doc.lines`.
        // Wait, jsPDF doesn't have a simple thick arc natively without advanced API. 
        // We can draw a polygon or just fallback to a clean bar if arc is risky for rendering.
        // Given the requirement "anillo circular", let's approximate it with segments.
        doc.setDrawColor(ds.colors.success[0], ds.colors.success[1], ds.colors.success[2]);
        doc.setLineWidth(4);
        const startAngle = -Math.PI / 2; // Top
        const endAngle = startAngle + (safeScore / 100) * (2 * Math.PI);
        // We will draw it using small line segments to form the arc
        const segments = 40;
        const angleStep = (endAngle - startAngle) / segments;
        if (safeScore > 0) {
            for (let i = 0; i < segments; i++) {
                const a1 = startAngle + i * angleStep;
                const a2 = startAngle + (i + 1) * angleStep;
                const x1 = centerX + radius * Math.cos(a1);
                const y1 = yPos + radius * Math.sin(a1);
                const x2 = centerX + radius * Math.cos(a2);
                const y2 = yPos + radius * Math.sin(a2);
                doc.line(x1, y1, x2, y2);
            }
        }
        // Center Text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.setTextColor(ds.colors.textDark[0], ds.colors.textDark[1], ds.colors.textDark[2]);
        doc.text(safeScore.toString(), centerX, yPos + 4, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(ds.colors.textMuted[0], ds.colors.textMuted[1], ds.colors.textMuted[2]);
        doc.text("/ 100", centerX, yPos + 10, { align: "center" });
        // Interpretative label
        let label = "Fundacional";
        if (safeScore >= 40)
            label = "En desarrollo";
        if (safeScore >= 60)
            label = "Avanzando";
        if (safeScore >= 80)
            label = "Consolidado";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
        doc.text(label.toUpperCase(), centerX, yPos + radius + 10, { align: "center" });
        return radius * 2 + 20; // total height occupied
    }
    static drawCard(doc, ds, layout, title, content, type, headerCallback) {
        const cardWidth = ds.safeAreaWidth;
        layout.applyTypography(ds.typography.body);
        const textLines = doc.splitTextToSize(content, cardWidth - ds.spacing.xl * 2);
        const textHeight = textLines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight);
        const paddingY = ds.spacing.lg;
        const titleHeight = 10;
        const totalHeight = paddingY * 2 + titleHeight + textHeight;
        layout.ensureSpace(totalHeight + ds.spacing.md, headerCallback);
        // Semantics
        let bgColor = ds.colors.surface;
        let iconColor = ds.colors.primary;
        let iconStr = "•";
        if (type === "finding") {
            bgColor = [ds.colors.warning[0], ds.colors.warning[1], ds.colors.warning[2]]; // Needs to be very light
            iconColor = ds.colors.warning;
            iconStr = "✦";
        }
        else if (type === "risk") {
            bgColor = [ds.colors.danger[0], ds.colors.danger[1], ds.colors.danger[2]];
            iconColor = ds.colors.danger;
            iconStr = "⚠";
        }
        else if (type === "opportunity") {
            bgColor = [ds.colors.success[0], ds.colors.success[1], ds.colors.success[2]];
            iconColor = ds.colors.success;
            iconStr = "💡";
        }
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.setDrawColor(iconColor[0], iconColor[1], iconColor[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(ds.margin.left, layout.yPos, cardWidth, totalHeight, ds.radii.lg, ds.radii.lg, "FD");
        // Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(iconColor[0], iconColor[1], iconColor[2]);
        doc.text(`${iconStr}  ${title.toUpperCase()}`, ds.margin.left + ds.spacing.lg, layout.yPos + paddingY + 3);
        // Content
        layout.yPos += paddingY + titleHeight;
        layout.drawText(textLines, ds.margin.left + ds.spacing.lg, ds.typography.body);
        layout.yPos += paddingY + ds.spacing.md; // space after card
    }
    static drawRoadmapTimeline(doc, ds, layout, phases, headerCallback) {
        // Vertical timeline for better text handling
        const startX = ds.margin.left + 10;
        const textX = startX + 15;
        const maxTextWidth = ds.safeAreaWidth - 25;
        phases.forEach((phase, index) => {
            layout.applyTypography(ds.typography.body);
            const lines = doc.splitTextToSize(phase, maxTextWidth);
            const textHeight = lines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight);
            const nodeHeight = Math.max(textHeight + 10, 30);
            layout.ensureSpace(nodeHeight + 10, headerCallback);
            // Draw line to next node (if not last)
            if (index < phases.length - 1) {
                doc.setDrawColor(ds.colors.border[0], ds.colors.border[1], ds.colors.border[2]);
                doc.setLineWidth(1);
                doc.line(startX, layout.yPos + 5, startX, layout.yPos + nodeHeight + 5);
            }
            // Draw node circle
            doc.setFillColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
            doc.circle(startX, layout.yPos + 5, 3, "F");
            // Draw Phase Label
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
            doc.text(`FASE ${index + 1}`, textX, layout.yPos + 5);
            // Draw Content
            layout.yPos += 10;
            layout.drawText(lines, textX, ds.typography.body);
            layout.yPos += (nodeHeight - textHeight);
        });
    }
}
exports.PdfComponents = PdfComponents;
//# sourceMappingURL=PdfComponents.js.map