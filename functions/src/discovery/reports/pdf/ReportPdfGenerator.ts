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
    // Elegant White Background (or extremely light surface)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, ds.pageWidth, ds.pageHeight, "F");

    // Logo (Centered, elegant)
    await PdfComponents.drawAuraLogo(doc, ds, 70, 40, 70, 40);

    // Subtitle (Brand)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    // @ts-ignore
    doc.setCharSpace(3);
    doc.setTextColor(ds.colors.textMuted[0], ds.colors.textMuted[1], ds.colors.textMuted[2]);
    doc.text("AURA INTELLIGENCE", ds.pageWidth / 2, 90, { align: "center" });
    // @ts-ignore
    doc.setCharSpace(0);

    // Divider Line
    doc.setDrawColor(ds.colors.border[0], ds.colors.border[1], ds.colors.border[2]);
    doc.setLineWidth(0.2);
    doc.line(ds.pageWidth / 2 - 20, 105, ds.pageWidth / 2 + 20, 105);

    // Title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(22);
    doc.setTextColor(ds.colors.textDark[0], ds.colors.textDark[1], ds.colors.textDark[2]);
    doc.text(isInternal ? "EXECUTIVE BRIEFING" : "RADIOGRAFÍA EMPRESARIAL", ds.pageWidth / 2, 125, { align: "center" });

    // Company & Contact
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(ds.colors.primary[0], ds.colors.primary[1], ds.colors.primary[2]);
    
    // Split long company names if necessary
    const companyLines = doc.splitTextToSize(data.companyName || "Empresa", 150);
    doc.text(companyLines, ds.pageWidth / 2, 145, { align: "center" });
    
    const contactY = 145 + (companyLines.length * 8) + 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(ds.colors.textMuted[0], ds.colors.textMuted[1], ds.colors.textMuted[2]);
    doc.text(`Preparado para: ${data.contactName}`, ds.pageWidth / 2, contactY, { align: "center" });

    // Footer Info (Very discreet)
    doc.setFontSize(9);
    const dateStr = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('es-MX');
    
    let footerY = 260;
    doc.text(dateStr, ds.pageWidth / 2, footerY, { align: "center" });
    footerY += 6;
    
    if (data.folio) {
      doc.text(`Folio: ${data.folio}`, ds.pageWidth / 2, footerY, { align: "center" });
      footerY += 6;
    }
    
    if (isInternal) {
      doc.setFont("helvetica", "bold");
      // @ts-ignore
      doc.setCharSpace(1);
      doc.setTextColor(ds.colors.danger[0], ds.colors.danger[1], ds.colors.danger[2]);
      doc.text("USO INTERNO - CONFIDENCIAL", ds.pageWidth / 2, footerY + 5, { align: "center" });
      // @ts-ignore
      doc.setCharSpace(0);
    } else {
      // Confidentiality Notice
      doc.setFontSize(8);
      doc.text("DOCUMENTO ESTRICTAMENTE CONFIDENCIAL", ds.pageWidth / 2, footerY + 5, { align: "center" });
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

    // PAGE 2: CARTA EJECUTIVA
    doc.addPage();
    layout.resetY();
    pageHeader();
    layout.yPos += 20;

    layout.drawText(`Estimado(a) ${data.contactName},`, ds.margin.left, ds.typography.bodyEmphasis);
    layout.yPos += 15;

    const letterBody = [
      `Gracias por permitir que Aura Intelligence analizara la información compartida durante esta primera conversación de consultoría empresarial.`,
      `El objetivo de este documento no es presentar una propuesta comercial. Nuestro propósito central es ayudarle a comprender con mayor claridad y perspectiva el estado operativo actual de su organización, identificar áreas latentes de evolución tecnológica y facilitar futuras conversaciones estratégicas en su mesa directiva.`,
      `Las conclusiones y reflexiones aquí presentadas han sido estructuradas meticulosamente a partir de los datos proporcionados durante nuestra sesión de Discovery.`,
      `Esperamos que este análisis crítico le resulte de alto valor para la toma de decisiones ejecutivas en el corto y mediano plazo.`
    ];

    for (const paragraph of letterBody) {
      const pLines = doc.splitTextToSize(paragraph, ds.safeAreaWidth);
      layout.drawText(pLines, ds.margin.left, ds.typography.body);
      layout.yPos += pLines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight) + ds.spacing.lg;
    }

    layout.yPos += 15;
    layout.drawText("Atentamente,", ds.margin.left, ds.typography.body);
    layout.yPos += 10;
    layout.drawText("Firma de Socios", ds.margin.left, ds.typography.bodyEmphasis);
    layout.yPos += 5;
    layout.drawText("Aura Intelligence", ds.margin.left, ds.typography.body);

    // PAGE 3: RESUMEN Y MADUREZ
    doc.addPage();
    layout.resetY();
    pageHeader();
    
    layout.yPos += 10;
    layout.drawText("Resumen Ejecutivo", ds.margin.left, ds.typography.sectionTitle);
    layout.yPos += 15;

    const narrativeIntro = `A través de nuestra evaluación, hemos identificado patrones operativos en ${data.companyName} que sugieren un punto de inflexión. La infraestructura actual requiere una revisión profunda para sostener el crecimiento proyectado sin incurrir en deuda técnica o riesgos operativos críticos.`;
    const introLines = doc.splitTextToSize(narrativeIntro, ds.safeAreaWidth);
    layout.drawText(introLines, ds.margin.left, ds.typography.body);
    layout.yPos += introLines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight) + ds.spacing.xl;

    if (data.overallStatus) {
      layout.drawText("Estado Actual de la Operación", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 10;
      layout.drawText(data.overallStatus, ds.margin.left, ds.typography.bodyEmphasis, { maxWidth: ds.safeAreaWidth });
      layout.yPos += ds.spacing.xl;
    }

    if (data.maturityScore !== undefined) {
      layout.ensureSpace(90, pageHeader);
      layout.drawText("Índice de Madurez Tecnológica", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 15;
      PdfComponents.drawMaturityGauge(doc, ds, layout, data.maturityScore, ds.pageWidth / 2, layout.yPos + 35, 35);
      layout.yPos += 90; // space occupied by gauge
      
      // Explanation of score
      const scoreExplanation = data.maturityScore < 50 
        ? "Un índice fundamental indica que la empresa opera mediante procesos manuales o sistemas desconectados. El enfoque inmediato debe ser la centralización y la creación de cimientos digitales confiables."
        : "Un índice consolidado sugiere que existen herramientas implementadas, pero carecen de orquestación unificada. El enfoque debe girar hacia la automatización inteligente y la visibilidad en tiempo real.";
      
      const expLines = doc.splitTextToSize(scoreExplanation, ds.safeAreaWidth);
      layout.drawText(expLines, ds.margin.left, ds.typography.body);
      layout.yPos += expLines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight) + ds.spacing.xl;
    }

    // FINDINGS
    if (data.keyFindings && data.keyFindings.length > 0) {
      layout.ensureSpace(30, pageHeader);
      layout.drawText("Hallazgos Principales", ds.margin.left, ds.typography.sectionTitle);
      layout.yPos += 15;
      data.keyFindings.forEach((finding) => {
        PdfComponents.drawCard(doc, ds, layout, "Observación de Campo", finding, "finding", pageHeader);
      });
    }

    // ALLOW_FULL DETAILS
    if (data.deliveryLevel === "ALLOW_FULL") {
      if (data.operationalRisks && data.operationalRisks.length > 0) {
        layout.ensureSpace(30, pageHeader);
        layout.drawText("Análisis de Riesgo Operativo", ds.margin.left, ds.typography.sectionTitle);
        layout.yPos += 10;
        const riskIntro = doc.splitTextToSize("Las siguientes vulnerabilidades representan contingencias potenciales que podrían impactar la continuidad del negocio o la eficiencia financiera si no son mitigadas estratégicamente.", ds.safeAreaWidth);
        layout.drawText(riskIntro, ds.margin.left, ds.typography.body);
        layout.yPos += riskIntro.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight) + ds.spacing.lg;

        data.operationalRisks.forEach((risk) => {
          PdfComponents.drawCard(doc, ds, layout, "Riesgo Detectado", risk, "risk", pageHeader);
        });
      }
      
      if (data.opportunities && data.opportunities.length > 0) {
        layout.ensureSpace(30, pageHeader);
        layout.drawText("Capacidades a Fortalecer (Oportunidades)", ds.margin.left, ds.typography.sectionTitle);
        layout.yPos += 10;
        const oppIntro = doc.splitTextToSize("Nuestra recomendación central no radica en la adquisición de software aislado, sino en el desarrollo sistémico de las siguientes capacidades organizacionales fundamentales:", ds.safeAreaWidth);
        layout.drawText(oppIntro, ds.margin.left, ds.typography.body);
        layout.yPos += oppIntro.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight) + ds.spacing.lg;

        data.opportunities.forEach((opp) => {
          PdfComponents.drawCard(doc, ds, layout, "Iniciativa Estratégica", opp, "opportunity", pageHeader);
        });
      }

      if (data.roadmap && data.roadmap.length > 0) {
        layout.ensureSpace(40, pageHeader);
        layout.drawText("Roadmap Estratégico", ds.margin.left, ds.typography.sectionTitle);
        layout.yPos += 10;
        PdfComponents.drawRoadmapTimeline(doc, ds, layout, data.roadmap, pageHeader);
      }
      
      // CIERRE
      layout.ensureSpace(60, pageHeader);
      layout.drawText("El Acompañamiento de Aura", ds.margin.left, ds.typography.sectionTitle);
      layout.yPos += 15;
      
      const auraPillars = "Aura Intelligence se especializa en orquestar soluciones profundas para la Gestión de Personas, Operación Unificada e Inteligencia Empresarial. Nuestro enfoque garantiza que la tecnología se subordine a la estrategia de negocio.";
      const pillarLines = doc.splitTextToSize(auraPillars, ds.safeAreaWidth);
      layout.drawText(pillarLines, ds.margin.left, ds.typography.body);
      layout.yPos += pillarLines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight) + ds.spacing.xl;

      layout.drawText("Reflexión Final", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 10;
      const closing = "Toda organización evoluciona de forma distinta y a su propio ritmo. Este documento representa únicamente un punto de partida diagnóstico. El equipo de socios y asesores de Aura Intelligence estará a su entera disposición para profundizar en cualquiera de estos hallazgos cuando el liderazgo de su empresa lo considere oportuno.";
      const closingLines = doc.splitTextToSize(closing, ds.safeAreaWidth);
      layout.drawText(closingLines, ds.margin.left, ds.typography.body);
      layout.yPos += closingLines.length * (ds.typography.body.fontSize * 0.352778 * ds.typography.body.lineHeight) + ds.spacing.lg;

    } else {
      layout.ensureSpace(40, pageHeader);
      layout.drawText("Nota de Alcance", ds.margin.left, ds.typography.subsectionTitle);
      layout.yPos += 5;
      const lines = doc.splitTextToSize("Se han detectado áreas de oportunidad críticas en sus procesos actuales. Para acceder a la disección profunda de los riesgos operativos y al roadmap estratégico propuesto, sugerimos agendar una sesión de consultoría técnica privada con nuestro equipo de especialistas.", ds.safeAreaWidth);
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

    // Table-like structure for internal classified data
    const drawRow = (label: string, val: string | number) => {
      layout.ensureSpace(12, pageHeader);
      layout.drawText(label.toUpperCase(), ds.margin.left, ds.typography.metricLabel);
      layout.drawText(String(val), ds.margin.left + 45, ds.typography.bodyEmphasis, { maxWidth: ds.safeAreaWidth - 45 });
      layout.yPos += 4;
      doc.setDrawColor(ds.colors.border[0], ds.colors.border[1], ds.colors.border[2]);
      doc.setLineWidth(0.2);
      doc.line(ds.margin.left, layout.yPos, ds.pageWidth - ds.margin.right, layout.yPos);
      layout.yPos += 6;
    };

    layout.drawText("Clasificación de Oportunidad", ds.margin.left, ds.typography.subsectionTitle);
    layout.yPos += 8;

    drawRow("ID de Prospecto", data.prospectId || "N/A");
    drawRow("Score de Oportunidad", data.opportunityScore || "N/A");
    drawRow("Nivel de Confianza", data.confidenceLevel || "N/A");
    drawRow("Probabilidad de Cierre", data.probabilityOfClosing || "N/A");
    
    layout.yPos += ds.spacing.lg;
    layout.drawText("Next Best Action (Recomendada)", ds.margin.left, ds.typography.subsectionTitle);
    layout.yPos += 8;
    const nbaLines = doc.splitTextToSize(data.nextBestAction || "N/A", ds.safeAreaWidth);
    layout.drawText(nbaLines, ds.margin.left, ds.typography.bodyEmphasis);
    layout.yPos += nbaLines.length * (ds.typography.bodyEmphasis.fontSize * 0.352778 * ds.typography.bodyEmphasis.lineHeight) + ds.spacing.xl;

    if (data.keyFindings && data.keyFindings.length > 0) {
      layout.ensureSpace(20, pageHeader);
      layout.drawText("Señales Comerciales Extraídas", ds.margin.left, ds.typography.sectionTitle);
      layout.yPos += 10;
      data.keyFindings.forEach((finding) => {
        PdfComponents.drawCard(doc, ds, layout, "Señal Detectada", finding, "finding", pageHeader);
      });
    }

    if (data.operationalRisks && data.operationalRisks.length > 0) {
      layout.ensureSpace(20, pageHeader);
      layout.drawText("Fricciones y Riesgos Comerciales", ds.margin.left, ds.typography.sectionTitle);
      layout.yPos += 10;
      data.operationalRisks.forEach((risk) => {
        PdfComponents.drawCard(doc, ds, layout, "Alerta", risk, "risk", pageHeader);
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
