import { jsPDF } from "jspdf";
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

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text(title, pageWidth / 2, 112, { align: "center" });

    // Subtitle
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth / 2, 124, { align: "center" });

    doc.setDrawColor(AURA_CYAN[0], AURA_CYAN[1], AURA_CYAN[2]);
    doc.line(54, 137, 156, 137);

    // Company
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(companyName, pageWidth / 2, 160, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(200, 210, 220);
    doc.text(`Preparado para: ${contactName}`, pageWidth / 2, 172, { align: "center" });
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
      layout.applyTypography(AuraDesignTokens.typography.body);
      
      const phaseParts = phase.split(":");
      const phaseTitle = phaseParts.length > 1 ? phaseParts[0].trim() : `Horizonte ${index + 1}`;
      const phaseDesc = phaseParts.length > 1 ? phaseParts.slice(1).join(":").trim() : phase;

      const lines = doc.splitTextToSize(phaseDesc, maxTextWidth);
      const textHeight = lines.length * (AuraDesignTokens.typography.body.fontSize * 0.352778 * AuraDesignTokens.typography.body.lineHeight);
      const nodeHeight = Math.max(textHeight + 15, 30);

      layout.ensureSpace(nodeHeight + 10, headerCallback);

      if (index < phases.length - 1) {
        doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
        doc.setLineWidth(0.3);
        doc.line(startX, layout.yPos + 5, startX, layout.yPos + nodeHeight + 5);
      }

      doc.setDrawColor(AURA_NAVY[0], AURA_NAVY[1], AURA_NAVY[2]);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.circle(startX, layout.yPos + 3, 2.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      // @ts-ignore
      doc.setCharSpace(1);
      doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
      doc.text(`INICIATIVA ESTRATÉGICA 0${index + 1}`, textX, layout.yPos + 4);
      // @ts-ignore
      doc.setCharSpace(0);

      layout.yPos += 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(AURA_NAVY[0], AURA_NAVY[1], AURA_NAVY[2]);
      doc.text(phaseTitle.toUpperCase(), textX, layout.yPos);

      layout.yPos += 6;
      layout.drawText(lines, textX, AuraDesignTokens.typography.body);

      layout.yPos += (nodeHeight - textHeight) - 5;
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
      if (i === 0) doc.moveTo(ptX, ptY);
      else doc.lineTo(ptX, ptY);
    }
    doc.stroke();

    // Draw active arc
    doc.setDrawColor(AURA_CYAN[0], AURA_CYAN[1], AURA_CYAN[2]);
    doc.setLineWidth(4);
    const fillSegments = Math.max(1, Math.floor((safeScore / 100) * segments));
    for (let i = 0; i <= fillSegments; i++) {
      const angle = Math.PI + (i / segments) * Math.PI;
      const ptX = x + radius * Math.cos(angle);
      const ptY = y + radius * Math.sin(angle);
      if (i === 0) doc.moveTo(ptX, ptY);
      else doc.lineTo(ptX, ptY);
    }
    doc.stroke();

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
