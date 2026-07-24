import jsPDF from "jspdf";
import { AuraDesignTokens, AURA_NAVY, AURA_CYAN, AURA_MAGENTA, TEXT_DARK, TEXT_MUTED, BORDER } from "./AuraDesignTokens";
import { AuraPdfLayout } from "./AuraPdfLayout";
import { AuraDocumentAssets } from "./AuraDocumentTypes";

export class AuraPdfComponents {
  
  public static addTopBrandBar(doc: jsPDF) {
    const { pageWidth } = AuraDesignTokens;
    doc.setFillColor(AURA_NAVY[0], AURA_NAVY[1], AURA_NAVY[2]);
    doc.rect(0, 0, pageWidth, 14, "F");

    doc.setFillColor(AURA_CYAN[0], AURA_CYAN[1], AURA_CYAN[2]);
    doc.rect(0, 14, pageWidth * 0.62, 1.8, "F");

    doc.setFillColor(AURA_MAGENTA[0], AURA_MAGENTA[1], AURA_MAGENTA[2]);
    doc.rect(pageWidth * 0.62, 14, pageWidth * 0.38, 1.8, "F");
  }

  public static addFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
    const { pageWidth, margin } = AuraDesignTokens;
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.line(margin.left, 276, pageWidth - margin.right, 276);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(
      "Aura Nexus · admin@auranexus.io · 442-350-8472 · auranexus.io",
      margin.left,
      284
    );

    if (pageNumber > 0 && totalPages > 0) {
      doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin.right, 284, {
        align: "right",
      });
    }
  }

  public static drawLogo(doc: jsPDF, assets: AuraDocumentAssets, x: number, y: number, defaultW: number = 70, defaultH: number = 42) {
    if (assets.logoDataUrl) {
      // Use dimensions from assets if available, or fallback
      let w = assets.logoWidth || defaultW;
      let h = assets.logoHeight || defaultH;
      // if we only have one dimension, we could calculate aspect ratio, but assuming both or neither are provided for simplicity
      doc.addImage(assets.logoDataUrl, "PNG", x, y, w, h);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text(assets.fallbackBrandText, x, y + 10);
    }
  }

  public static drawFittedTextBlock(options: {
    doc: jsPDF;
    text: string;
    x: number;
    y: number;
    maxWidth: number;
    maxHeight?: number;
    initialFontSize: number;
    minimumFontSize?: number;
    lineHeight?: number;
    fontStyle?: "normal" | "bold" | "italic";
    align?: "left" | "center" | "right";
    maxLines?: number;
    textColor?: readonly [number, number, number];
  }): number {
    const {
      doc,
      text,
      x,
      y,
      maxWidth,
      maxHeight = 99999,
      initialFontSize,
      minimumFontSize = 8,
      lineHeight = 1.4,
      fontStyle = "normal",
      align = "left",
      maxLines = 999,
      textColor
    } = options;

    const sanitizedText = text ? text.replace(/\s+/g, " ").trim() : "";
    if (!sanitizedText) return 0;

    let currentFontSize = initialFontSize;
    let lines: string[] = [];
    let lineH = 0;
    let totalHeight = 0;

    doc.setFont("helvetica", fontStyle);
    if (textColor) {
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    }

    while (currentFontSize >= minimumFontSize) {
      doc.setFontSize(currentFontSize);
      lineH = currentFontSize * 0.352778 * lineHeight; // in mm
      lines = doc.splitTextToSize(sanitizedText, maxWidth);
      
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
      }
      
      totalHeight = lines.length * lineH;
      
      if (totalHeight <= maxHeight) {
        break;
      }
      currentFontSize -= 0.5;
    }

    doc.setFontSize(currentFontSize);
    
    lines.forEach((line, index) => {
      const lineY = y + index * lineH;
      doc.text(line, x, lineY, { align });
    });

    // Track bounds for testing
    let maxW = 0;
    lines.forEach(l => {
      const w = doc.getTextWidth(l);
      if (w > maxW) maxW = w;
    });
    
    let x1 = x;
    let x2 = x + maxW;
    if (align === "center") {
      x1 = x - (maxW / 2);
      x2 = x + (maxW / 2);
    } else if (align === "right") {
      x1 = x - maxW;
      x2 = x;
    }
    
    const y1 = y - (currentFontSize * 0.352778);
    const y2 = y + totalHeight;
    
    if (!(doc as any).drawnBounds) {
      (doc as any).drawnBounds = [];
    }
    (doc as any).drawnBounds.push({
      text: sanitizedText,
      x1,
      y1,
      x2,
      y2,
      page: (doc.internal as any).getCurrentPageInfo().pageNumber,
      fontSize: currentFontSize
    });

    return totalHeight;
  }

  public static drawCoverPage(
    doc: jsPDF, 
    assets: AuraDocumentAssets, 
    title: string, 
    subtitle: string, 
    companyName: string,
    contactName: string
  ) {
    const { pageWidth, pageHeight } = AuraDesignTokens;
    
    // Navy Background
    doc.setFillColor(AURA_NAVY[0], AURA_NAVY[1], AURA_NAVY[2]);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Cyan/Magenta stripes
    doc.setFillColor(AURA_CYAN[0], AURA_CYAN[1], AURA_CYAN[2]);
    doc.rect(0, 0, 8, pageHeight, "F");

    doc.setFillColor(AURA_MAGENTA[0], AURA_MAGENTA[1], AURA_MAGENTA[2]);
    doc.rect(8, 0, 3, pageHeight, "F");

    // Logo
    this.drawLogo(doc, assets, 70, 42);

    // Explicitly set text color to white for cover page elements
    const whiteColor: readonly [number, number, number] = [255, 255, 255];
    doc.setTextColor(255, 255, 255);

    // Dynamic Title Layout
    let currentY = 112;
    doc.setTextColor(255, 255, 255);
    const titleH = this.drawFittedTextBlock({
      doc,
      text: title,
      x: pageWidth / 2,
      y: currentY,
      maxWidth: 170,
      initialFontSize: 28,
      minimumFontSize: 16,
      align: "center",
      fontStyle: "bold",
      textColor: whiteColor
    });
    
    currentY += titleH + 4;
    
    // Subtitle
    doc.setTextColor(255, 255, 255);
    const subtitleH = this.drawFittedTextBlock({
      doc,
      text: subtitle,
      x: pageWidth / 2,
      y: currentY,
      maxWidth: 170,
      initialFontSize: 16,
      minimumFontSize: 11,
      align: "center",
      fontStyle: "normal",
      textColor: whiteColor
    });

    currentY += subtitleH + 8;
    
    doc.setDrawColor(AURA_CYAN[0], AURA_CYAN[1], AURA_CYAN[2]);
    doc.line(54, currentY, 156, currentY);
    
    currentY += 18;

    // Company
    doc.setTextColor(255, 255, 255);
    const companyH = this.drawFittedTextBlock({
      doc,
      text: companyName,
      x: pageWidth / 2,
      y: currentY,
      maxWidth: 170,
      initialFontSize: 20,
      minimumFontSize: 11,
      align: "center",
      fontStyle: "bold",
      textColor: whiteColor
    });

    currentY += companyH + 8;

    // Contact
    if (contactName) {
      doc.setTextColor(255, 255, 255);
      this.drawFittedTextBlock({
        doc,
        text: `Preparado para: ${contactName}`,
        x: pageWidth / 2,
        y: currentY,
        maxWidth: 170,
        initialFontSize: 12,
        minimumFontSize: 9,
        align: "center",
        fontStyle: "normal",
        textColor: whiteColor
      });
    }
  }

  public static drawCard(
    doc: jsPDF,
    layout: AuraPdfLayout,
    title: string,
    content: string,
    type: "finding" | "risk" | "opportunity",
    headerCallback: () => void
  ) {
    const safeAreaWidth = AuraDesignTokens.pageWidth - AuraDesignTokens.margin.left - AuraDesignTokens.margin.right;
    layout.applyTypography(AuraDesignTokens.typography.body);
    const textLines = doc.splitTextToSize(content, safeAreaWidth - AuraDesignTokens.spacing.xl);
    const textHeight = textLines.length * (AuraDesignTokens.typography.body.fontSize * 0.352778 * AuraDesignTokens.typography.body.lineHeight);
    
    const paddingY = AuraDesignTokens.spacing.md;
    const titleHeight = 6;
    const totalHeight = titleHeight + textHeight + paddingY;

    layout.ensureSpace(totalHeight + AuraDesignTokens.spacing.md, headerCallback);

    let iconColor: readonly [number, number, number] = AURA_NAVY;
    if (type === "finding") {
      iconColor = AURA_CYAN;
    } else if (type === "risk") {
      iconColor = AURA_MAGENTA;
    } else if (type === "opportunity") {
      iconColor = AURA_CYAN;
    }

    // Left indicator
    doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
    doc.rect(AuraDesignTokens.margin.left, layout.yPos, 1.5, totalHeight, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(iconColor[0], iconColor[1], iconColor[2]);
    doc.text(`${title.toUpperCase()}`, AuraDesignTokens.margin.left + AuraDesignTokens.spacing.lg, layout.yPos + 4);

    // Content
    layout.yPos += titleHeight + 2;
    layout.drawText(textLines, AuraDesignTokens.margin.left + AuraDesignTokens.spacing.lg, AuraDesignTokens.typography.body);
    
    layout.yPos += paddingY + AuraDesignTokens.spacing.md; 
  }

  public static drawRoadmapTimeline(
    doc: jsPDF,
    layout: AuraPdfLayout,
    phases: string[],
    headerCallback: () => void
  ) {
    const maxTextWidth = AuraDesignTokens.pageWidth - AuraDesignTokens.margin.left - AuraDesignTokens.margin.right - 25;
    const startX = AuraDesignTokens.margin.left + 10;
    const textX = startX + 15;

    phases.forEach((phase, index) => {
      const phaseParts = phase.split(":");
      const phaseTitle = phaseParts.length > 1 ? phaseParts[0].trim() : `Horizonte ${index + 1}`;
      const phaseDesc = phaseParts.length > 1 ? phaseParts.slice(1).join(":").trim() : phase;

      // Measure title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const titleLines = doc.splitTextToSize(phaseTitle.toUpperCase(), maxTextWidth);
      const titleHeight = titleLines.length * (11 * 0.352778 * 1.2);

      // Measure desc
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const descLines = doc.splitTextToSize(phaseDesc, maxTextWidth);
      const descHeight = descLines.length * (10 * 0.352778 * 1.4);

      const eyebrowHeight = 4;
      const totalNodeHeight = eyebrowHeight + 6 + titleHeight + 6 + descHeight + 10;

      layout.ensureSpace(totalNodeHeight + 10, headerCallback);

      if (index < phases.length - 1) {
        doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
        doc.setLineWidth(0.3);
        doc.line(startX, layout.yPos + 3, startX, layout.yPos + totalNodeHeight + 3);
      }

      doc.setDrawColor(AURA_NAVY[0], AURA_NAVY[1], AURA_NAVY[2]);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.circle(startX, layout.yPos + 3, 2.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      // @ts-ignore
      doc.setCharSpace(1);
      doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
      doc.text(`INICIATIVA ESTRATÉGICA 0${index + 1}`, textX, layout.yPos + 4);
      // @ts-ignore
      doc.setCharSpace(0);

      let currentY = layout.yPos + 10;

      // Title
      this.drawFittedTextBlock({
        doc,
        text: phaseTitle.toUpperCase(),
        x: textX,
        y: currentY,
        maxWidth: maxTextWidth,
        initialFontSize: 11,
        minimumFontSize: 9,
        align: "left",
        fontStyle: "bold"
      });
      currentY += titleHeight + 4;

      // Description
      this.drawFittedTextBlock({
        doc,
        text: phaseDesc,
        x: textX,
        y: currentY,
        maxWidth: maxTextWidth,
        initialFontSize: 10,
        minimumFontSize: 8,
        align: "left",
        fontStyle: "normal",
        lineHeight: 1.4
      });

      layout.yPos += totalNodeHeight;
    });
  }

  public static drawMaturityGauge(
    doc: jsPDF, 
    layout: AuraPdfLayout,
    score: number, 
    x: number, 
    y: number, 
    radius: number
  ) {
    const safeScore = Math.min(100, Math.max(0, score));
    const segments = 50;
    
    // Draw background arc
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(4);
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + (i / segments) * Math.PI;
      const ptX = x + radius * Math.cos(angle);
      const ptY = y + radius * Math.sin(angle);
      if (i === 0) (doc as any).moveTo(ptX, ptY);
      else (doc as any).lineTo(ptX, ptY);
    }
    (doc as any).stroke();

    // Draw active arc
    doc.setDrawColor(AURA_CYAN[0], AURA_CYAN[1], AURA_CYAN[2]);
    doc.setLineWidth(4);
    const fillSegments = Math.max(1, Math.floor((safeScore / 100) * segments));
    for (let i = 0; i <= fillSegments; i++) {
      const angle = Math.PI + (i / segments) * Math.PI;
      const ptX = x + radius * Math.cos(angle);
      const ptY = y + radius * Math.sin(angle);
      if (i === 0) (doc as any).moveTo(ptX, ptY);
      else (doc as any).lineTo(ptX, ptY);
    }
    (doc as any).stroke();

    // Draw score text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(AURA_NAVY[0], AURA_NAVY[1], AURA_NAVY[2]);
    doc.text(`${safeScore}`, x, y - 5, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text("ÍNDICE DE MADUREZ", x, y + 8, { align: "center" });
  }

}
