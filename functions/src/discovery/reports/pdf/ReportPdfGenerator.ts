import { jsPDF } from "jspdf";
import { ExecutiveBrandingProfile, ReportViewModel } from "../types";
import { ReportDesignSystem } from "./ReportDesignSystem";
import { PdfLayoutEngine } from "./PdfLayoutEngine";
import { PdfComponents } from "./PdfComponents";

export class ReportPdfGenerator {
  
  private static addHeader(doc: jsPDF, ds: ReportDesignSystem, folio?: string) {
    doc.setFillColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
    doc.rect(0, 0, ds.pageWidth, ds.headerHeight, "F");
    
    // Top colored bars
    doc.setFillColor(ds.colors.secondary[0], ds.colors.secondary[1], ds.colors.secondary[2]);
    doc.rect(0, 0, ds.pageWidth / 3, 2, "F");
    doc.setFillColor(ds.colors.accent[0], ds.colors.accent[1], ds.colors.accent[2]);
    doc.rect(ds.pageWidth / 3, 0, ds.pageWidth / 3, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(ds.branding.brandName.toUpperCase(), ds.margin.left, 12);
    
    if (folio) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(ds.colors.textMuted[0], ds.colors.textMuted[1], ds.colors.textMuted[2]);
      doc.text(`FOLIO: ${folio}`, ds.pageWidth - ds.margin.right, 12, { align: "right" });
    }
  }

  private static addFooter(doc: jsPDF, ds: ReportDesignSystem, pageNum: number, totalPages: number) {
    const y = ds.pageHeight - ds.footerHeight / 2;
    doc.setDrawColor(ds.colors.border[0], ds.colors.border[1], ds.colors.border[2]);
    doc.setLineWidth(0.2);
    doc.line(ds.margin.left, y - 5, ds.pageWidth - ds.margin.right, y - 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(ds.colors.textMuted[0], ds.colors.textMuted[1], ds.colors.textMuted[2]);
    doc.text(ds.branding.footerText || "Aura Intelligence", ds.margin.left, y);
    doc.text(`Página ${pageNum} de ${totalPages}`, ds.pageWidth - ds.margin.right, y, { align: "right" });
  }

  private static addWatermark(doc: jsPDF, ds: ReportDesignSystem, company: string, contact: string) {
    // Discreet vertical watermark on the left edge
    doc.saveGraphicsState();
    // Use very light gray
    doc.setTextColor(230, 235, 240);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    
    // jsPDF rotation is tricky without advanced API, so we just write it normally at the bottom left 
    // or draw it across the page center with high transparency if supported.
    // Given GState might not support transparency universally in basic jsPDF without advanced modules,
    // we use a very light color and standard text.
    doc.text(`CONFIDENCIAL - EXCLUSIVO PARA ${company.toUpperCase()}`, ds.margin.left, ds.pageHeight - ds.margin.bottom + 10);
    doc.restoreGraphicsState();
  }

  private static async drawCover(doc: jsPDF, ds: ReportDesignSystem, data: ReportViewModel, isInternal: boolean) {
    // Aura Navy Background
    doc.setFillColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
    doc.rect(0, 0, ds.pageWidth, ds.pageHeight, "F");

    // Geometric subtle shapes (simulated light)
    doc.setFillColor(ds.colors.secondary[0], ds.colors.secondary[1], ds.colors.secondary[2]);
    // A faint rect to simulate a glow or tech line
    doc.setDrawColor(ds.colors.secondary[0], ds.colors.secondary[1], ds.colors.secondary[2]);
    doc.setLineWidth(0.1);
    for(let i=0; i<5; i++) {
      doc.line(0, 150 + (i*10), ds.pageWidth, 100 + (i*10)); // Diagonal tech lines
    }
    
    // Logo
    await PdfComponents.drawAuraLogo(doc, ds, 70, 40, 70, 40);

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text(isInternal ? "EXECUTIVE BRIEFING" : "RADIOGRAFÍA EMPRESARIAL", ds.pageWidth / 2, 120, { align: "center" });

    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    // @ts-ignore
    doc.setCharSpace(2);
    doc.setTextColor(ds.colors.secondary[0], ds.colors.secondary[1], ds.colors.secondary[2]);
    doc.text("AURA INTELLIGENCE", ds.pageWidth / 2, 130, { align: "center" });
    // @ts-ignore
    doc.setCharSpace(0);

    // Company & Contact
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(data.companyName || "Empresa", ds.pageWidth / 2, 160, { align: "center" });
    doc.setFontSize(12);
    doc.setTextColor(200, 210, 220);
    doc.text(`Preparado para: ${data.contactName}`, ds.pageWidth / 2, 170, { align: "center" });

    // Footer Info
    doc.setFontSize(10);
    const dateStr = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('es-MX');
    doc.text(`Fecha: ${dateStr}`, ds.pageWidth / 2, 250, { align: "center" });
    
    if (data.folio) {
      doc.text(`Folio: ${data.folio}`, ds.pageWidth / 2, 256, { align: "center" });
    }
    
    if (data.advisor && ds.branding.advisorPresentationEnabled) {
      doc.text(`Asesor: ${data.advisor.displayName}`, ds.pageWidth / 2, 262, { align: "center" });
    } else {
      doc.text(`Equipo de Consultoría Aura`, ds.pageWidth / 2, 262, { align: "center" });
    }

    if (isInternal) {
      doc.setFont("helvetica", "bold");
      // @ts-ignore
      doc.setCharSpace(1);
      doc.setTextColor(ds.colors.danger[0], ds.colors.danger[1], ds.colors.danger[2]);
      doc.text("USO INTERNO - CONFIDENCIAL", ds.pageWidth / 2, 275, { align: "center" });
      // @ts-ignore
      doc.setCharSpace(0);
    }
  }

  public static async generateExternalRadiografia(
    data: ReportViewModel, 
    branding: ExecutiveBrandingProfile
  ): Promise<Buffer> {
    const doc = new jsPDF("p", "mm", "a4");
    const ds = new ReportDesignSystem(branding);
    const layout = new PdfLayoutEngine(doc, ds);
    
    const pageHeader = () => {
      this.addHeader(doc, ds, data.folio);
      this.addWatermark(doc, ds, data.companyName, data.contactName);
    };

    // PAGE 1: COVER
    await this.drawCover(doc, ds, data, false);

    // PAGE 2: RESUMEN & SCORE
    doc.addPage();
    layout.resetY();
    pageHeader();
    
    layout.yPos += 10;
    layout.drawText("Resumen Ejecutivo", ds.margin.left, ds.typography.sectionTitle);
    layout.yPos += 10;

    if (data.overallStatus) {
      layout.drawText(data.overallStatus, ds.margin.left, ds.typography.bodyEmphasis, { maxWidth: ds.safeAreaWidth });
      layout.yPos += 5;
    }

    if (data.maturityScore !== undefined) {
      layout.ensureSpace(80, pageHeader);
      PdfComponents.drawMaturityGauge(doc, ds, layout, data.maturityScore, ds.pageWidth / 2, layout.yPos + 35, 30);
      layout.yPos += 80; // space occupied by gauge
    }

    // FINDINGS
    if (data.keyFindings && data.keyFindings.length > 0) {
      layout.ensureSpace(20, pageHeader);
      layout.drawText("Hallazgos Principales", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 5;
      data.keyFindings.forEach((finding, idx) => {
        PdfComponents.drawCard(doc, ds, layout, `Hallazgo ${idx + 1}`, finding, "finding", pageHeader);
      });
    }

    // ALLOW_FULL DETAILS
    if (data.deliveryLevel === "ALLOW_FULL") {
      if (data.operationalRisks && data.operationalRisks.length > 0) {
        layout.ensureSpace(20, pageHeader);
        layout.drawText("Áreas de Riesgo", ds.margin.left, ds.typography.subsectionTitle);
        layout.yPos += 5;
        data.operationalRisks.forEach((risk, idx) => {
          PdfComponents.drawCard(doc, ds, layout, `Riesgo ${idx + 1}`, risk, "risk", pageHeader);
        });
      }
      
      if (data.opportunities && data.opportunities.length > 0) {
        layout.ensureSpace(20, pageHeader);
        layout.drawText("Oportunidades", ds.margin.left, ds.typography.subsectionTitle);
        layout.yPos += 5;
        data.opportunities.forEach((opp, idx) => {
          PdfComponents.drawCard(doc, ds, layout, `Oportunidad ${idx + 1}`, opp, "opportunity", pageHeader);
        });
      }

      if (data.roadmap && data.roadmap.length > 0) {
        layout.ensureSpace(40, pageHeader);
        layout.drawText("Roadmap Sugerido", ds.margin.left, ds.typography.sectionTitle);
        layout.yPos += 10;
        PdfComponents.drawRoadmapTimeline(doc, ds, layout, data.roadmap, pageHeader);
      }
    } else {
      layout.ensureSpace(40, pageHeader);
      layout.drawText("Nota de Alcance", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 5;
      const lines = doc.splitTextToSize("Se han detectado áreas de oportunidad en sus procesos actuales. Para acceder al análisis detallado, riesgos operativos y al roadmap estratégico de automatización propuesto, le sugerimos agendar una sesión de consultoría técnica con nuestro equipo.", ds.safeAreaWidth);
      layout.drawText(lines, ds.margin.left, ds.typography.body);
    }

    // ADD FOOTERS TO ALL PAGES (Except cover)
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i);
      this.addFooter(doc, ds, i - 1, pageCount - 1);
    }

    return Buffer.from(doc.output("arraybuffer"));
  }

  public static async generateInternalBriefing(
    data: ReportViewModel & { prospectId?: string, opportunityScore?: number, probabilityOfClosing?: string, nextBestAction?: string, confidenceLevel?: string },
    branding: ExecutiveBrandingProfile
  ): Promise<Buffer> {
    const doc = new jsPDF("p", "mm", "a4");
    const ds = new ReportDesignSystem(branding);
    const layout = new PdfLayoutEngine(doc, ds);
    
    const pageHeader = () => {
      this.addHeader(doc, ds, data.folio);
      this.addWatermark(doc, ds, data.companyName, data.contactName);
      // internal badge
      doc.setFillColor(ds.colors.surface[0], ds.colors.surface[1], ds.colors.surface[2]);
      doc.rect(ds.margin.left, ds.headerHeight + 2, 60, 6, "F");
      doc.setFontSize(6);
      doc.setTextColor(ds.colors.danger[0], ds.colors.danger[1], ds.colors.danger[2]);
      doc.text("USO INTERNO - CONFIDENCIAL", ds.margin.left + 2, ds.headerHeight + 6);
    };

    // PAGE 1: COVER
    await this.drawCover(doc, ds, data, true);

    // PAGE 2
    doc.addPage();
    layout.resetY();
    layout.yPos += 10; // make room for badge
    pageHeader();

    layout.yPos += 10;
    layout.drawText("Briefing Estratégico", ds.margin.left, ds.typography.sectionTitle);
    layout.yPos += 10;

    // Table-like structure for internal data
    const drawRow = (label: string, val: string | number) => {
      layout.ensureSpace(15, pageHeader);
      layout.drawText(label.toUpperCase(), ds.margin.left, ds.typography.metricLabel);
      layout.drawText(String(val), ds.margin.left + 50, ds.typography.bodyEmphasis, { maxWidth: ds.safeAreaWidth - 50 });
      layout.yPos += 5;
      doc.setDrawColor(ds.colors.border[0], ds.colors.border[1], ds.colors.border[2]);
      doc.line(ds.margin.left, layout.yPos, ds.pageWidth - ds.margin.right, layout.yPos);
      layout.yPos += 5;
    };

    drawRow("Prospect ID", data.prospectId || "N/A");
    drawRow("Opportunity Score", data.opportunityScore || "N/A");
    drawRow("Confidence", data.confidenceLevel || "N/A");
    drawRow("Prob. Closing", data.probabilityOfClosing || "N/A");
    drawRow("Next Best Action", data.nextBestAction || "N/A");

    if (data.keyFindings && data.keyFindings.length > 0) {
      layout.ensureSpace(20, pageHeader);
      layout.drawText("Señales Clave (Findings)", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 5;
      data.keyFindings.forEach((finding, idx) => {
        PdfComponents.drawCard(doc, ds, layout, `Señal ${idx + 1}`, finding, "finding", pageHeader);
      });
    }

    if (data.operationalRisks && data.operationalRisks.length > 0) {
      layout.ensureSpace(20, pageHeader);
      layout.drawText("Riesgos Comerciales/Operativos", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 5;
      data.operationalRisks.forEach((risk, idx) => {
        PdfComponents.drawCard(doc, ds, layout, `Riesgo ${idx + 1}`, risk, "risk", pageHeader);
      });
    }

    // ADD FOOTERS TO ALL PAGES (Except cover)
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i);
      this.addFooter(doc, ds, i - 1, pageCount - 1);
    }

    return Buffer.from(doc.output("arraybuffer"));
  }

}
