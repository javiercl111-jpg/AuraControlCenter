import { jsPDF } from "jspdf";
import { ReportDesignSystem } from "./ReportDesignSystem";
import { PdfLayoutEngine } from "./PdfLayoutEngine";
import { PdfAssetLoader } from "./PdfAssetLoader";

export class PdfComponents {
  public static async drawAuraLogo(
    doc: jsPDF,
    ds: ReportDesignSystem,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ) {
    try {
      const logoData = await PdfAssetLoader.loadFallbackLogoBase64();
      if (!logoData) throw new Error("Logo not found");

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
    } catch (err) {
      // Fallback
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
      doc.text("Aura Intelligence", x, y + 10);
      return 15;
    }
  }

  public static drawMaturityGauge(
    doc: jsPDF,
    ds: ReportDesignSystem,
    layout: PdfLayoutEngine,
    score: number | null,
    centerX: number,
    yPos: number,
    radius: number
  ) {
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
    if (safeScore >= 40) label = "En desarrollo";
    if (safeScore >= 60) label = "Avanzando";
    if (safeScore >= 80) label = "Consolidado";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
    doc.text(label.toUpperCase(), centerX, yPos + radius + 10, { align: "center" });
    
    return radius * 2 + 20; // total height occupied
  }

  public static drawCard(
    doc: jsPDF,
    ds: ReportDesignSystem,
    layout: PdfLayoutEngine,
    title: string,
    content: string,
    type: "finding" | "risk" | "opportunity",
    headerCallback: () => void
  ) {
    const cardWidth = ds.safeAreaWidth;
    layout.applyTypography(ds.typography.body);
    const textLines = doc.splitTextToSize(content, cardWidth - ds.spacing.xl);
    const textHeight = textLines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight);
    
    const paddingY = ds.spacing.md;
    const titleHeight = 6;
    const totalHeight = titleHeight + textHeight + paddingY;

    layout.ensureSpace(totalHeight + ds.spacing.md, headerCallback);

    // Semantics
    let iconColor = ds.colors.primary;

    if (type === "finding") {
      iconColor = ds.colors.warning;
    } else if (type === "risk") {
      iconColor = ds.colors.danger;
    } else if (type === "opportunity") {
      iconColor = ds.colors.success;
    }

    // Elegant left indicator instead of a full box
    doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
    doc.rect(ds.margin.left, layout.yPos, 1.5, totalHeight, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(iconColor[0], iconColor[1], iconColor[2]);
    doc.text(`${title.toUpperCase()}`, ds.margin.left + ds.spacing.lg, layout.yPos + 4);

    // Content
    layout.yPos += titleHeight + 2;
    layout.drawText(textLines, ds.margin.left + ds.spacing.lg, ds.typography.body);
    
    layout.yPos += paddingY + ds.spacing.md; // space after item
  }

  public static drawRoadmapTimeline(
    doc: jsPDF,
    ds: ReportDesignSystem,
    layout: PdfLayoutEngine,
    phases: string[],
    headerCallback: () => void
  ) {
    // Vertical timeline for better text handling
    const startX = ds.margin.left + 10;
    const textX = startX + 15;
    const maxTextWidth = ds.safeAreaWidth - 25;

    phases.forEach((phase, index) => {
      layout.applyTypography(ds.typography.body);
      
      // Parse phase (simulating strategic breakdown if the string is just one chunk)
      const phaseParts = phase.split(":"); // Usually fixtures are "Fase 3: Optimización..."
      const phaseTitle = phaseParts.length > 1 ? phaseParts[0].trim() : `Horizonte ${index + 1}`;
      const phaseDesc = phaseParts.length > 1 ? phaseParts.slice(1).join(":").trim() : phase;

      const lines = doc.splitTextToSize(phaseDesc, maxTextWidth);
      const textHeight = lines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight);
      const nodeHeight = Math.max(textHeight + 15, 30);

      layout.ensureSpace(nodeHeight + 10, headerCallback);

      // Draw line to next node (if not last)
      if (index < phases.length - 1) {
        doc.setDrawColor(ds.colors.border[0], ds.colors.border[1], ds.colors.border[2]);
        doc.setLineWidth(0.3); // Thinner, elegant line
        doc.line(startX, layout.yPos + 5, startX, layout.yPos + nodeHeight + 5);
      }

      // Draw node circle (hollow circle is more elegant)
      doc.setDrawColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
      doc.setFillColor(ds.colors.background[0], ds.colors.background[1], ds.colors.background[2]);
      doc.setLineWidth(0.5);
      doc.circle(startX, layout.yPos + 3, 2.5, "FD");

      // Draw Phase Label (Strategic)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      // @ts-ignore
      doc.setCharSpace(1);
      doc.setTextColor(ds.colors.textMuted[0], ds.colors.textMuted[1], ds.colors.textMuted[2]);
      doc.text(`INICIATIVA ESTRATÉGICA 0${index + 1}`, textX, layout.yPos + 4);
      // @ts-ignore
      doc.setCharSpace(0);

      // Draw Title
      layout.yPos += 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
      doc.text(phaseTitle.toUpperCase(), textX, layout.yPos);

      // Draw Content (The What and Why)
      layout.yPos += 6;
      layout.drawText(lines, textX, ds.typography.body);

      layout.yPos += (nodeHeight - textHeight) - 5;
    });
  }
}
