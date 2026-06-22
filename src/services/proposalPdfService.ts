import jsPDF from "jspdf";

import type { PlatformQuote } from "../types/quote";

const LOGO_PATH = "/Logo Aura Oficial.png";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 18;

const AURA_NAVY = [7, 20, 38] as const;
const AURA_CYAN = [28, 210, 230] as const;
const AURA_MAGENTA = [236, 72, 153] as const;
const TEXT_DARK = [20, 30, 45] as const;
const TEXT_MUTED = [95, 105, 120] as const;
const BORDER = [220, 225, 235] as const;

const HCM_SETUP_POINT_PRICE = 2500;
const MAINTENANCE_SETUP_POINT_PRICE = 2000;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function formatBillingCycle(value: string) {
  return value === "YEARLY" ? "Anual" : "Mensual";
}

function formatIndustry(value: string) {
  const labels: Record<string, string> = {
    HOTELERIA: "Hotelería",
    RESTAURANTES: "Restaurantes",
    CORPORATIVO: "Corporativo",
    HOSPITAL: "Hospitales",
    RETAIL: "Retail",
    MANUFACTURA: "Manufactura",
    SERVICIOS: "Servicios",
    EDUCACION: "Educación",
    GOBIERNO: "Gobierno",
    OTRO: "Otro",
  };

  return labels[value] || value;
}

function formatModuleName(value: string) {
  const labels: Record<string, string> = {
    AURA_HCM: "Aura HCM",
    AURA_MAINTENANCE: "Aura Maintenance OS",
    AURA_SIGNATURE: "Aura Signature",
    AURA_INTELLIGENCE: "Aura Intelligence",
  };

  return labels[value] || value;
}

function todayLabel() {
  return new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

async function loadImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("[Proposal PDF] No se pudo cargar el logo:", error);
    return null;
  }
}

function setTextColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFillColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function addFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, 276, PAGE_WIDTH - MARGIN_X, 276);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, TEXT_MUTED);
  doc.text(
    "Aura Nexus · admin@auranexus.io · 442-350-8472 · auranexus.io",
    MARGIN_X,
    284
  );

  doc.text(`Página ${pageNumber} de ${totalPages}`, PAGE_WIDTH - MARGIN_X, 284, {
    align: "right",
  });
}

function addTopBrandBar(doc: jsPDF) {
  setFillColor(doc, AURA_NAVY);
  doc.rect(0, 0, PAGE_WIDTH, 14, "F");

  setFillColor(doc, AURA_CYAN);
  doc.rect(0, 14, PAGE_WIDTH * 0.62, 1.8, "F");

  setFillColor(doc, AURA_MAGENTA);
  doc.rect(PAGE_WIDTH * 0.62, 14, PAGE_WIDTH * 0.38, 1.8, "F");
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setTextColor(doc, TEXT_DARK);
  doc.text(title, MARGIN_X, y);

  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, y + 3, PAGE_WIDTH - MARGIN_X, y + 3);
}

function addInfoRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setTextColor(doc, TEXT_MUTED);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setTextColor(doc, TEXT_DARK);
  doc.text(value || "Pendiente", x, y + 5);
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function addCoverPage(doc: jsPDF, quote: PlatformQuote, logo: string | null) {
  setFillColor(doc, AURA_NAVY);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  setFillColor(doc, AURA_CYAN);
  doc.rect(0, 0, 8, PAGE_HEIGHT, "F");

  setFillColor(doc, AURA_MAGENTA);
  doc.rect(8, 0, 3, PAGE_HEIGHT, "F");

  if (logo) {
    doc.addImage(logo, "PNG", 70, 42, 70, 42);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  setTextColor(doc, [255, 255, 255]);
  doc.text("Propuesta Comercial", PAGE_WIDTH / 2, 112, { align: "center" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("Ecosistema Aura", PAGE_WIDTH / 2, 124, { align: "center" });

  setDrawColor(doc, AURA_CYAN);
  doc.line(54, 137, 156, 137);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(quote.prospectName || "Cliente pendiente", PAGE_WIDTH / 2, 160, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Folio: ${quote.folio}`, PAGE_WIDTH / 2, 176, { align: "center" });
  doc.text(`Fecha: ${todayLabel()}`, PAGE_WIDTH / 2, 185, { align: "center" });
  doc.text(`Vigencia: ${quote.validUntil}`, PAGE_WIDTH / 2, 194, {
    align: "center",
  });

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Facturación: ${formatBillingCycle(quote.billingCycle)}`,
    PAGE_WIDTH / 2,
    215,
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTextColor(doc, [190, 205, 220]);
  doc.text(
    "Tecnología SaaS para gestión empresarial, talento, mantenimiento, firma e inteligencia operativa.",
    PAGE_WIDTH / 2,
    238,
    { align: "center", maxWidth: 150 }
  );

  doc.text("Aura Nexus · auranexus.io", PAGE_WIDTH / 2, 270, {
    align: "center",
  });
}

function addExecutiveSummaryPage(
  doc: jsPDF,
  quote: PlatformQuote,
  logo: string | null
) {
  doc.addPage();
  addTopBrandBar(doc);

  if (logo) {
    doc.addImage(logo, "PNG", MARGIN_X, 24, 32, 19);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setTextColor(doc, TEXT_DARK);
  doc.text("Resumen Ejecutivo", 58, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_MUTED);
  doc.text(
    "Propuesta comercial consolidada para la adopción del ecosistema Aura.",
    58,
    42
  );

  addSectionTitle(doc, "Datos generales de la propuesta", 62);

  addInfoRow(doc, "Cliente / Empresa", quote.prospectName, MARGIN_X, 78);
  addInfoRow(doc, "Contacto Comercial", quote.contactName, 78, 78);
  addInfoRow(doc, "Correo de Contacto", quote.contactEmail, 138, 78);

  addInfoRow(doc, "Industria", formatIndustry(quote.industry), MARGIN_X, 100);
  addInfoRow(doc, "Folio", quote.folio, 78, 100);
  addInfoRow(doc, "Vigencia de Oferta", quote.validUntil, 138, 100);

  addSectionTitle(doc, "Objetivo de la implementación", 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setTextColor(doc, TEXT_DARK);
  const targetText =
    "El objetivo de esta propuesta es proveer una plataforma integral para la gestión y digitalización de los procesos de la empresa, optimizando la operación y garantizando la consistencia de datos, seguridad de la información y cumplimiento normativo a través del ecosistema Aura.";
  doc.text(targetText, MARGIN_X, 134, { maxWidth: PAGE_WIDTH - MARGIN_X * 2, align: "justify" });

  addSectionTitle(doc, "Licenciamiento y capacidades contratadas", 154);

  const cardY = 170;
  const cardW = 38;
  const gap = 7;
  const cards = [
    ["Plan Aura", quote.planName],
    ["Colaboradores", `${quote.employeeCount}`],
    ["Ubicaciones", `${quote.locationCount}`],
    ["Empresas", `${quote.companyCount}`],
  ];

  cards.forEach(([label, value], index) => {
    const x = MARGIN_X + index * (cardW + gap);

    setFillColor(doc, [245, 248, 252]);
    setDrawColor(doc, BORDER);
    doc.roundedRect(x, cardY, cardW, 26, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_MUTED);
    doc.text(label.toUpperCase(), x + 4, cardY + 8);

    doc.setFontSize(10.5);
    setTextColor(doc, TEXT_DARK);
    doc.text(value, x + 4, cardY + 18, { maxWidth: cardW - 8 });
  });

  addSectionTitle(doc, "Productos y Módulos Activos", 208);
  
  let y = 224;
  quote.selectedModules.forEach((moduleCode) => {
    setFillColor(doc, AURA_CYAN);
    doc.circle(MARGIN_X + 3, y - 2, 1.8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setTextColor(doc, TEXT_DARK);
    doc.text(formatModuleName(moduleCode), MARGIN_X + 10, y);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setTextColor(doc, TEXT_MUTED);
    const subInfo = moduleCode === "AURA_HCM" 
      ? "— Módulo base de capital humano y control de asistencia" 
      : moduleCode === "AURA_MAINTENANCE"
      ? "— Control de activos y gestión operativa de mantenimiento"
      : moduleCode === "AURA_SIGNATURE"
      ? "— Gestión contractual y firma digital legalmente válida"
      : "— Capa avanzada de analítica e inteligencia de negocio";
    doc.text(subInfo, MARGIN_X + 60, y);

    y += 9;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  setTextColor(doc, TEXT_DARK);
  doc.text("Soporte incluido:", MARGIN_X, y);
  doc.setFont("helvetica", "normal");
  doc.text(" Soporte Técnico Enterprise (24/7 para incidencias críticas, chat y correo preferente).", MARGIN_X + 30, y);
}

function addPricingPage(doc: jsPDF, quote: PlatformQuote) {
  doc.addPage();
  addTopBrandBar(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setTextColor(doc, TEXT_DARK);
  doc.text("Costos Recurrentes y Setup", MARGIN_X, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setTextColor(doc, TEXT_MUTED);
  doc.text(
    `Facturación ${formatBillingCycle(quote.billingCycle).toLowerCase()} · Precios expresados en MXN más IVA.`,
    MARGIN_X,
    39
  );

  let currentY = 45;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > 265) {
      doc.addPage();
      addTopBrandBar(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      setTextColor(doc, TEXT_DARK);
      doc.text("Costos Recurrentes y Setup (Continuación)", MARGIN_X, 32);
      currentY = 48;
    }
  };

  checkPageBreak(15);
  addSectionTitle(doc, "1. Costos de Licenciamiento Recurrentes", currentY);
  currentY += 12;

  checkPageBreak(12);
  setFillColor(doc, AURA_NAVY);
  doc.roundedRect(MARGIN_X, currentY - 5, PAGE_WIDTH - MARGIN_X * 2, 8, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setTextColor(doc, [255, 255, 255]);
  doc.text("Concepto de Licenciamiento", MARGIN_X + 4, currentY.toFixed(1) === currentY.toString() ? currentY : currentY);
  doc.text("Cantidad", 112, currentY);
  doc.text("Precio Unitario", 142, currentY);
  doc.text("Total", 176, currentY);
  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT_DARK);

  quote.items.forEach((item, index) => {
    checkPageBreak(8);
    if (index % 2 === 0) {
      setFillColor(doc, [248, 250, 252]);
      doc.rect(MARGIN_X, currentY - 4, PAGE_WIDTH - MARGIN_X * 2, 7, "F");
    }

    doc.text(item.label, MARGIN_X + 4, currentY);
    doc.text(String(item.quantity), 116, currentY);
    doc.text(formatCurrency(item.unitPrice), 136, currentY);
    doc.text(formatCurrency(item.total), 172, currentY);
    currentY += 7;
  });

  currentY += 4;
  checkPageBreak(40);
  setDrawColor(doc, BORDER);
  doc.line(116, currentY, PAGE_WIDTH - MARGIN_X, currentY);
  currentY += 6;

  const summaryX = 112;
  const valueX = 188;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTextColor(doc, TEXT_DARK);

  if (quote.billingCycle === "YEARLY") {
    doc.text("Subtotal anual antes de descuentos", summaryX, currentY);
    doc.text(formatCurrency(quote.annualSubtotalBeforeDiscount), valueX, currentY, {
      align: "right",
    });
    currentY += 6;

    setTextColor(doc, [180, 110, 20]);
    const isSpecial = quote.discountPercent === 15 || (quote.discountPercent > 0 && quote.discountPercent !== 10);
    const discLabel = isSpecial 
      ? `Descuento Recurrente Anual Especial (${quote.discountPercent}%)`
      : `Descuento Recurrente Anual Estándar (${quote.discountPercent}%)`;

    doc.text(discLabel, summaryX, currentY);
    doc.text(`-${formatCurrency(quote.discountAmount)}`, valueX, currentY, {
      align: "right",
    });
    currentY += 6;
    setTextColor(doc, TEXT_DARK);
  }

  doc.text("Subtotal recurrente", summaryX, currentY);
  doc.text(formatCurrency(quote.subtotal), valueX, currentY, { align: "right" });
  currentY += 6;

  doc.text("IVA recurrente (16%)", summaryX, currentY);
  doc.text(formatCurrency(quote.ivaAmount), valueX, currentY, { align: "right" });
  currentY += 8;

  setFillColor(doc, AURA_NAVY);
  doc.roundedRect(110, currentY - 5, 82, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, [255, 255, 255]);
  doc.text("TOTAL RECURRENTE", 114, currentY + 1.5);
  doc.text(formatCurrency(quote.total), 187, currentY + 1.5, { align: "right" });

  setTextColor(doc, TEXT_DARK);
  currentY += 15;

  checkPageBreak(20);
  addSectionTitle(doc, "2. Costo Único de Implementación / Setup", currentY);
  currentY += 12;

  const isLegacy =
    quote.setupFee === undefined ||
    quote.setupBreakdown === undefined ||
    quote.annualProjectedRevenue === undefined;

  if (isLegacy) {
    checkPageBreak(30);
    setFillColor(doc, [254, 243, 199]);
    setDrawColor(doc, [251, 191, 36]);
    doc.roundedRect(MARGIN_X, currentY - 4, PAGE_WIDTH - MARGIN_X * 2, 25, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setTextColor(doc, [146, 64, 14]);
    doc.text("COMPATIBILIDAD CON PROPUESTA LEGACY", MARGIN_X + 6, currentY + 3);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(
      "Esta propuesta fue generada antes de la implementación del desglose avanzado de setup y costos de implementación.",
      MARGIN_X + 6,
      currentY + 12,
      { maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 12 }
    );
    currentY += 25;
  } else if (quote.pricingMode === "FOUNDER") {
    const includesHcm = quote.selectedModules.includes("AURA_HCM");
    const includesMaintenance = quote.selectedModules.includes("AURA_MAINTENANCE");

    checkPageBreak(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setTextColor(doc, TEXT_DARK);
    doc.text("Setup Comercial Fundador (Tarifa Fija Preferencial)", MARGIN_X, currentY);
    currentY += 6;

    checkPageBreak(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, TEXT_MUTED);
    doc.text("Producto / Servicio de Setup", MARGIN_X + 4, currentY);
    doc.text("Detalle / Alcance", 112, currentY);
    doc.text("Costo Setup (MXN)", 172, currentY);
    setDrawColor(doc, BORDER);
    doc.line(MARGIN_X, currentY + 2, PAGE_WIDTH - MARGIN_X, currentY + 2);
    currentY += 8;

    if (includesHcm) {
      checkPageBreak(7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setTextColor(doc, TEXT_DARK);
      doc.text("Aura HCM (Capital Humano)", MARGIN_X + 4, currentY);
      doc.text(`Nivel de Setup: ${quote.setupHcmTier || "Preferencial"}`, 112, currentY);
      doc.text(formatCurrency(quote.setupHcmFee !== undefined ? quote.setupHcmFee : 0), 172, currentY);
      currentY += 6;
    }

    if (includesMaintenance) {
      checkPageBreak(7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setTextColor(doc, TEXT_DARK);
      doc.text("Aura Maintenance OS", MARGIN_X + 4, currentY);
      doc.text(`Nivel de Setup: ${quote.setupMaintTier || "Preferencial"}`, 112, currentY);
      doc.text(formatCurrency(quote.setupMaintFee !== undefined ? quote.setupMaintFee : 0), 172, currentY);
      currentY += 6;
    }

    currentY += 4;

    checkPageBreak(35);
    setDrawColor(doc, BORDER);
    doc.line(MARGIN_X, currentY, PAGE_WIDTH - MARGIN_X, currentY);
    currentY += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Resumen de Setup Comercial", MARGIN_X, currentY);
    currentY += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Costo de Setup antes de descuento: ${formatCurrency(quote.setupFeeBeforeDiscount)}`, MARGIN_X, currentY);
    currentY += 5;

    if (quote.setupDiscountPercent > 0) {
      setTextColor(doc, [180, 110, 20]);
      doc.text(`Descuento Setup Adicional (${quote.setupDiscountPercent}%): -${formatCurrency(quote.setupDiscountAmount)}`, MARGIN_X, currentY);
      currentY += 5;
      setTextColor(doc, TEXT_DARK);
    }

    doc.setFont("helvetica", "bold");
    doc.text(`COSTO DE SETUP FINAL (PAGO ÚNICO): ${formatCurrency(quote.setupFee)}`, MARGIN_X, currentY);
    currentY += 12;

    checkPageBreak(30);
    const isFreeHcm = includesHcm && quote.setupHcmFee === 0;
    const isFreeMaint = includesMaintenance && quote.setupMaintFee === 0;
    const hasFreeSetup = isFreeHcm || isFreeMaint;

    setFillColor(doc, [239, 246, 255]);
    setDrawColor(doc, [96, 165, 250]);
    doc.roundedRect(MARGIN_X, currentY - 4, PAGE_WIDTH - MARGIN_X * 2, 28, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setTextColor(doc, [29, 78, 216]);
    doc.text("BENEFICIO CLIENTE FUNDADOR APLICADO", MARGIN_X + 6, currentY + 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let noteText = "Se ha aplicado una tarifa preferencial de implementación para clientes fundadores de Aura.\nEste beneficio permanecerá vigente mientras la suscripción permanezca activa y no exista un cambio de alcance contratado.";
    if (hasFreeSetup) {
      noteText += "\n* Setup incluido sin costo como beneficio para clientes fundadores.";
    }
    doc.text(noteText, MARGIN_X + 6, currentY + 10, { maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 12 });
    currentY += 28;
  } else {
    const includesHcm = quote.selectedModules.includes("AURA_HCM");
    const includesMaintenance = quote.selectedModules.includes("AURA_MAINTENANCE");

    if (includesHcm) {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setTextColor(doc, TEXT_DARK);
      doc.text("Desglose de Complejidad Aura HCM (Base: $19,900.00, Costo Pt: $2,500.00)", MARGIN_X, currentY);
      currentY += 6;

      checkPageBreak(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setTextColor(doc, TEXT_MUTED);
      doc.text("Métrica / Factor de Complejidad", MARGIN_X + 4, currentY);
      doc.text("Puntos", 112, currentY);
      doc.text("Monto (MXN)", 172, currentY);
      setDrawColor(doc, BORDER);
      doc.line(MARGIN_X, currentY + 2, PAGE_WIDTH - MARGIN_X, currentY + 2);
      currentY += 8;

      const hcmItems = quote.setupBreakdown.filter(i => i.product === "AURA_HCM");
      hcmItems.forEach((item) => {
        checkPageBreak(7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        setTextColor(doc, TEXT_DARK);
        doc.text(item.factor, MARGIN_X + 4, currentY);
        doc.text(`${item.score} Pts`, 112, currentY);
        doc.text(formatCurrency(item.amount || item.score * HCM_SETUP_POINT_PRICE), 172, currentY);
        currentY += 6;
      });
      currentY += 4;
    }

    if (includesMaintenance) {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setTextColor(doc, TEXT_DARK);
      doc.text("Desglose de Complejidad Aura Maintenance OS (Base: $12,900.00, Costo Pt: $2,000.00)", MARGIN_X, currentY);
      currentY += 6;

      checkPageBreak(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setTextColor(doc, TEXT_MUTED);
      doc.text("Métrica / Factor de Complejidad", MARGIN_X + 4, currentY);
      doc.text("Puntos", 112, currentY);
      doc.text("Monto (MXN)", 172, currentY);
      setDrawColor(doc, BORDER);
      doc.line(MARGIN_X, currentY + 2, PAGE_WIDTH - MARGIN_X, currentY + 2);
      currentY += 8;

      const maintItems = quote.setupBreakdown.filter(i => i.product === "AURA_MAINTENANCE");
      maintItems.forEach((item) => {
        checkPageBreak(7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        setTextColor(doc, TEXT_DARK);
        doc.text(item.factor, MARGIN_X + 4, currentY);
        doc.text(`${item.score} Pts`, 112, currentY);
        doc.text(formatCurrency(item.amount || item.score * MAINTENANCE_SETUP_POINT_PRICE), 172, currentY);
        currentY += 6;
      });
      currentY += 4;
    }

    checkPageBreak(45);
    setDrawColor(doc, BORDER);
    doc.line(MARGIN_X, currentY, PAGE_WIDTH - MARGIN_X, currentY);
    currentY += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Resumen de Setup Consolidados", MARGIN_X, currentY);
    currentY += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Costo de Setup Base Total: ${formatCurrency(quote.setupBasePrice)}`, MARGIN_X, currentY);
    currentY += 5;
    doc.text(`Puntos de Complejidad Totales (Con Topes Aplicados): ${quote.setupComplexityScore} Pts`, MARGIN_X, currentY);
    currentY += 5;
    doc.text(`Costo de Setup antes de descuento: ${formatCurrency(quote.setupFeeBeforeDiscount)}`, MARGIN_X, currentY);
    currentY += 5;

    if (quote.setupDiscountPercent > 0) {
      setTextColor(doc, [180, 110, 20]);
      let setupDiscLabel = `Descuento Setup Aplicado (${quote.setupDiscountPercent}%):`;
      if (quote.founderClient) {
        setupDiscLabel = quote.setupDiscountPercent === 100
          ? "Bonificación Especial Setup (Cliente Fundador 100%):"
          : `Descuento Cliente Fundador Setup (${quote.setupDiscountPercent}%):`;
      }
      doc.text(`${setupDiscLabel} -${formatCurrency(quote.setupDiscountAmount)}`, MARGIN_X, currentY);
      currentY += 5;
      setTextColor(doc, TEXT_DARK);
    }

    doc.setFont("helvetica", "bold");
    doc.text(`COSTO DE SETUP FINAL (PAGO ÚNICO): ${formatCurrency(quote.setupFee)}`, MARGIN_X, currentY);
    currentY += 12;

    if (quote.founderClient) {
      checkPageBreak(30);
      if (quote.setupFee === 0) {
        setFillColor(doc, [240, 253, 244]);
        setDrawColor(doc, [74, 222, 128]);
        doc.roundedRect(MARGIN_X, currentY - 4, PAGE_WIDTH - MARGIN_X * 2, 28, 3, 3, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        setTextColor(doc, [21, 128, 61]);
        doc.text("SETUP SIN COSTO POR PROMOCIÓN CLIENTE FUNDADOR", MARGIN_X + 6, currentY + 2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          "El costo de implementación ha sido bonificado como beneficio comercial por incorporación temprana al ecosistema Aura.\nEste beneficio aplica únicamente al alcance originalmente contratado y podrá revisarse si existen ampliaciones futuras.",
          MARGIN_X + 6,
          currentY + 10,
          { maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 12 }
        );
        currentY += 28;
      } else {
        setFillColor(doc, [239, 246, 255]);
        setDrawColor(doc, [96, 165, 250]);
        doc.roundedRect(MARGIN_X, currentY - 4, PAGE_WIDTH - MARGIN_X * 2, 28, 3, 3, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        setTextColor(doc, [29, 78, 216]);
        doc.text("DESCUENTO CLIENTE FUNDADOR (50% SETUP)", MARGIN_X + 6, currentY + 2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          "Por ser cliente fundador de Aura se aplica un descuento del 50% sobre el costo de implementación (setup).\nEste beneficio se mantiene vigente mientras el cliente conserve el plan originalmente contratado.",
          MARGIN_X + 6,
          currentY + 10,
          { maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 12 }
        );
        currentY += 28;
      }
    }
  }
}

function addDetailsAndTermsPage(doc: jsPDF, quote: PlatformQuote, logo: string | null) {
  doc.addPage();
  addTopBrandBar(doc);

  if (logo) {
    doc.addImage(logo, "PNG", MARGIN_X, 24, 30, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setTextColor(doc, TEXT_DARK);
  doc.text("Detalles de Servicio y Términos", 58, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setTextColor(doc, TEXT_MUTED);
  doc.text(
    "Propuesta técnica de implementación, valor de negocio y condiciones comerciales.",
    58,
    39
  );

  let currentY = 48;
  
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > 265) {
      doc.addPage();
      addTopBrandBar(doc);
      if (logo) {
        doc.addImage(logo, "PNG", MARGIN_X, 24, 30, 18);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      setTextColor(doc, TEXT_DARK);
      doc.text("Detalles de Servicio y Términos (Continuación)", 58, 34);
      currentY = 48;
    }
  };

  const includesHcm = quote.selectedModules.includes("AURA_HCM");
  const includesMaint = quote.selectedModules.includes("AURA_MAINTENANCE");

  // Section 1: ¿Qué incluye el Setup?
  checkPageBreak(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setTextColor(doc, TEXT_DARK);
  doc.text("1. ¿Qué incluye el Setup / Implementación?", MARGIN_X, currentY);
  
  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, currentY + 2.5, PAGE_WIDTH - MARGIN_X, currentY + 2.5);
  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT_DARK);

  let setupBullets: string[] = [];
  if (includesHcm && includesMaint) {
    setupBullets = [
      "Configuración y despliegue de tenants dedicados para Aura HCM y Aura Maintenance OS.",
      "Parametrización de estructura organizacional, organigramas, ubicaciones y sucursales operativas.",
      "Configuración de perfiles de usuarios administradores, colaboradores y técnicos de campo.",
      "Carga inicial asistida de datos históricos de colaboradores, activos fijos y catálogos de repuestos.",
      "Generación y asignación de códigos QR masivos para el control físico de activos.",
      "Capacitación inicial integral para líderes del proyecto, administradores y personal clave.",
      "Soporte preferente de arranque y acompañamiento operativo en la puesta en marcha.",
    ];
  } else if (includesHcm) {
    setupBullets = [
      "Configuración inicial del tenant exclusivo de Aura HCM en la nube.",
      "Parametrización inicial de estructura de puestos, áreas y organigrama empresarial.",
      "Configuración de módulos contratados, roles de seguridad y accesos de usuarios.",
      "Carga inicial asistida del histórico y catálogo vigente de colaboradores.",
      "Capacitación inicial técnica y operativa orientada a administradores de RH.",
      "Soporte de arranque y acompañamiento continuo en las primeras etapas de implementación.",
    ];
  } else if (includesMaint) {
    setupBullets = [
      "Configuración de ubicaciones físicas, sucursales y áreas lógicas de trabajo.",
      "Configuración del catálogo de activos fijos, categorías operativas y niveles de criticidad.",
      "Configuración del inventario base, almacenes y repuestos iniciales de operación.",
      "Configuración de perfiles de técnicos, contratistas y flujos de órdenes de trabajo.",
      "Generación y vinculación de códigos QR masivos para el inventario de activos físicos.",
      "Capacitación inicial técnica para programadores de mantenimiento y técnicos de campo.",
    ];
  } else {
    setupBullets = [
      "Configuración y despliegue del tenant en la infraestructura en la nube de Aura.",
      "Parametrización operativa inicial de catálogos generales según necesidades comerciales.",
      "Carga inicial asistida de información base y registros requeridos para operar.",
      "Configuración de accesos, usuarios administradores y políticas de seguridad.",
      "Capacitación inicial de uso del sistema a administradores designados.",
    ];
  }

  setupBullets.forEach((bullet) => {
    checkPageBreak(7);
    doc.text(`• ${bullet}`, MARGIN_X, currentY, { maxWidth: PAGE_WIDTH - MARGIN_X * 2 });
    currentY += 6;
  });
  currentY += 6;

  // Section 2: ¿Qué incluye el Plan?
  checkPageBreak(45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setTextColor(doc, TEXT_DARK);
  doc.text("2. ¿Qué incluye el Plan Contratado?", MARGIN_X, currentY);

  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, currentY + 2.5, PAGE_WIDTH - MARGIN_X, currentY + 2.5);
  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT_DARK);

  const planBullets = [
    "Acceso total ilimitado a la plataforma web de Aura según el plan de licenciamiento seleccionado.",
    "Límites contractuales asignados para número de colaboradores, sucursales y empresas legales.",
    "Actualizaciones de software continuas, parches de seguridad y mejoras de plataforma sin costo.",
    "Hospedaje de bases de datos de alta disponibilidad y seguridad avanzada en nube cifrada.",
    "Respaldos diarios automatizados y almacenamiento redundante histórico de datos.",
    "Soporte preferente empresarial y Mesa de Ayuda técnica autorizada.",
  ];

  planBullets.forEach((bullet) => {
    checkPageBreak(7);
    doc.text(`• ${bullet}`, MARGIN_X, currentY, { maxWidth: PAGE_WIDTH - MARGIN_X * 2 });
    currentY += 6;
  });
  currentY += 6;

  // Section 3: Beneficio de Negocio
  checkPageBreak(45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setTextColor(doc, TEXT_DARK);
  doc.text("3. Beneficio de Negocio Autorizado", MARGIN_X, currentY);

  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, currentY + 2.5, PAGE_WIDTH - MARGIN_X, currentY + 2.5);
  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT_DARK);

  let benefits: string[] = [];
  if (includesHcm && includesMaint) {
    benefits = [
      "Centralización integral y digitalización completa del capital humano y la operación física de mantenimiento.",
      "Reducción sustancial del trabajo administrativo y reprocesos mediante flujos automatizados de aprobación.",
      "Expedientes digitales seguros para un acceso inmediato que reduce la búsqueda física de documentos.",
      "Firma electrónica integrada que acelera los tiempos de contratación y formalización de documentos operacionales.",
      "Trazabilidad operativa total en órdenes de trabajo que reduce fallas y tiempos de paro no programados.",
      "Acceso a información estratégica e inteligencia operativa consolidada para decisiones oportunas de negocio.",
    ];
  } else if (includesHcm) {
    benefits = [
      "Centralización estratégica de los procesos clave del departamento de Talento Humano.",
      "Reducción drástica de la carga administrativa en tareas rutinarias como control de asistencia y vacaciones.",
      "Expedientes digitales seguros organizados jerárquicamente para consulta en tiempo real.",
      "Automatización en solicitudes de permisos, justificaciones y vacaciones autogestionadas.",
      "Firma electrónica integrada con plena validez legal que optimiza tiempos de contratación y cumplimiento.",
      "Mayor trazabilidad y preparación automática ante auditorías del departamento de recursos humanos.",
    ];
  } else if (includesMaint) {
    benefits = [
      "Control físico estructurado y trazabilidad de activos fijos de la organización.",
      "Reducción notable de los tiempos de respuesta ante incidentes operativos urgentes.",
      "Planificación automatizada y seguimiento estricto del programa de mantenimiento preventivo.",
      "Gestión móvil en tiempo real para optimizar la jornada de trabajo del personal técnico.",
      "Historial de mantenimiento detallado y auditoría por activo físico para decisiones de renovación.",
      "Reducción de paros imprevistos e incremento en la vida útil de los equipos e instalaciones.",
    ];
  } else {
    benefits = [
      "Mayor eficiencia interna a través de la digitalización de flujos de trabajo tradicionales.",
      "Disponibilidad de información centralizada en la nube accesible desde cualquier lugar.",
      "Trazabilidad de operaciones que reduce errores humanos y optimiza la productividad del equipo.",
    ];
  }

  benefits.forEach((benefit) => {
    checkPageBreak(7);
    doc.text(`• ${benefit}`, MARGIN_X, currentY, { maxWidth: PAGE_WIDTH - MARGIN_X * 2 });
    currentY += 6;
  });
  currentY += 6;

  // Section 4: Cronograma
  checkPageBreak(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setTextColor(doc, TEXT_DARK);
  doc.text("4. Cronograma Estimado de Entrega", MARGIN_X, currentY);

  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, currentY + 2.5, PAGE_WIDTH - MARGIN_X, currentY + 2.5);
  currentY += 8;

  const isLegacy =
    quote.setupFee === undefined ||
    quote.setupBreakdown === undefined ||
    quote.annualProjectedRevenue === undefined;

  const complexity = isLegacy ? 0 : quote.setupComplexityScore;
  const isSimple = complexity <= 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT_DARK);

  if (isSimple) {
    doc.text("Proyecto de Complejidad Simple (Estimación: 2 semanas):", MARGIN_X, currentY);
    currentY += 6;
    
    checkPageBreak(30);
    setFillColor(doc, [240, 253, 244]);
    setDrawColor(doc, [74, 222, 128]);
    doc.roundedRect(MARGIN_X, currentY, PAGE_WIDTH - MARGIN_X * 2, 26, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, [21, 128, 61]);
    doc.text("Semana 1: Kickoff, Configuración y Carga inicial", MARGIN_X + 6, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_DARK);
    doc.text("— Puesta en marcha inicial del tenant en la nube, configuración de roles y carga base de catálogos.", MARGIN_X + 6, currentY + 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, [21, 128, 61]);
    doc.text("Semana 2: Capacitación operativa y Arranque productivo", MARGIN_X + 6, currentY + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_DARK);
    doc.text("— Sesiones de capacitación práctica a usuarios finales y salida oficial a producción.", MARGIN_X + 6, currentY + 23);

    currentY += 32;
  } else {
    doc.text("Proyecto de Complejidad Estándar (Estimación: 4 semanas):", MARGIN_X, currentY);
    currentY += 6;

    checkPageBreak(50);
    setFillColor(doc, [248, 250, 252]);
    setDrawColor(doc, BORDER);
    doc.roundedRect(MARGIN_X, currentY, PAGE_WIDTH - MARGIN_X * 2, 45, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, TEXT_DARK);
    
    doc.text("Semana 1: Kickoff del proyecto y Parametrización inicial", MARGIN_X + 6, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_MUTED);
    doc.text("— Alineación del plan de trabajo, definición de estructuras base y definición de accesos.", MARGIN_X + 6, currentY + 10);

    doc.setFont("helvetica", "bold");
    setTextColor(doc, TEXT_DARK);
    doc.text("Semana 2: Configuración de módulos y Carga inicial asistida", MARGIN_X + 6, currentY + 17);
    doc.setFont("helvetica", "normal");
    doc.text("— Carga masiva asistida de datos de colaboradores, activos e inventario en la base de datos.", MARGIN_X + 6, currentY + 21);

    doc.setFont("helvetica", "bold");
    setTextColor(doc, TEXT_DARK);
    doc.text("Semana 3: Capacitación técnica y funcional de perfiles", MARGIN_X + 6, currentY + 28);
    doc.setFont("helvetica", "normal");
    doc.text("— Sesiones operativas enfocadas a líderes del proyecto, administradores y personal técnico.", MARGIN_X + 6, currentY + 32);

    doc.setFont("helvetica", "bold");
    setTextColor(doc, TEXT_DARK);
    doc.text("Semana 4: Puesta en marcha, acompañamiento y salida a producción", MARGIN_X + 6, currentY + 39);
    doc.setFont("helvetica", "normal");
    doc.text("— Arranque formal de operaciones controladas y soporte preferencial en sitio/remoto.", MARGIN_X + 6, currentY + 43);

    currentY += 51;
  }
  currentY += 6;

  // Section 5: Resumen de Primer Pago
  checkPageBreak(65);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setTextColor(doc, TEXT_DARK);
  doc.text("5. Resumen Comercial de Primer Pago", MARGIN_X, currentY);

  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, currentY + 2.5, PAGE_WIDTH - MARGIN_X, currentY + 2.5);
  currentY += 8;

  const boxHeight = quote.pricingMode === "FOUNDER" ? 36 : 42;
  setFillColor(doc, [245, 248, 252]);
  setDrawColor(doc, BORDER);
  doc.roundedRect(MARGIN_X, currentY, PAGE_WIDTH - MARGIN_X * 2, boxHeight, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT_DARK);

  const paddingLeft = MARGIN_X + 8;
  const valueRight = PAGE_WIDTH - MARGIN_X - 8;

  doc.text("Subtotal Licenciamiento Recurrente:", paddingLeft, currentY + 7);
  doc.text(formatCurrency(quote.subtotal), valueRight, currentY + 7, { align: "right" });

  doc.text("Costo de Setup (Cálculo Único de Implementación):", paddingLeft, currentY + 13);
  const setupVal = isLegacy ? 0 : (quote.pricingMode === "FOUNDER" ? quote.setupFee : quote.setupFeeBeforeDiscount);
  doc.text(formatCurrency(setupVal), valueRight, currentY + 13, { align: "right" });

  let offset = 0;
  if (quote.pricingMode !== "FOUNDER") {
    doc.text("Descuento Setup Aplicado (Cliente Fundador):", paddingLeft, currentY + 19);
    const setupDisc = isLegacy ? 0 : quote.setupDiscountAmount;
    doc.text(`-${formatCurrency(setupDisc)}`, valueRight, currentY + 19, { align: "right" });
    offset = 6;
  }

  setDrawColor(doc, BORDER);
  doc.line(paddingLeft, currentY + 17 + offset, valueRight, currentY + 17 + offset);

  // Highlighted Total Box
  setFillColor(doc, AURA_NAVY);
  doc.rect(paddingLeft - 2, currentY + 20 + offset, valueRight - paddingLeft + 4, 11, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, [255, 255, 255]);
  
  doc.text("TOTAL DEL PRIMER PAGO (MÁS IVA):", paddingLeft, currentY + 27 + offset);
  const totalFirstSub = isLegacy ? quote.subtotal : quote.firstPaymentSubtotal;
  doc.text(formatCurrency(totalFirstSub), valueRight, currentY + 27 + offset, { align: "right" });

  currentY += boxHeight + 6;

  // Annual projected revenue
  if (!isLegacy) {
    checkPageBreak(20);
    setFillColor(doc, [236, 253, 245]);
    setDrawColor(doc, [167, 243, 208]);
    doc.roundedRect(MARGIN_X, currentY, PAGE_WIDTH - MARGIN_X * 2, 12, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(doc, [6, 95, 70]);
    doc.text("Ingreso Anual Proyectado (ARR):", paddingLeft, currentY + 4.5);
    doc.text(formatCurrency(quote.annualProjectedRevenue), valueRight, currentY + 4.5, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("— Representa la proyección de licenciamiento anual consolidado + setup neto final.", paddingLeft, currentY + 9.5);
    currentY += 18;
  } else {
    currentY += 6;
  }

  // Section 6: Condiciones y Vigencia
  checkPageBreak(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setTextColor(doc, TEXT_DARK);
  doc.text("6. Condiciones Comerciales y Vigencia", MARGIN_X, currentY);

  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, currentY + 2.5, PAGE_WIDTH - MARGIN_X, currentY + 2.5);
  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, TEXT_DARK);

  if (quote.founderClient || quote.pricingMode === "FOUNDER") {
    checkPageBreak(25);
    doc.setFont("helvetica", "bold");
    doc.text("Condición Especial de Cliente Fundador:", MARGIN_X, currentY);
    doc.setFont("helvetica", "normal");
    const condText = quote.pricingMode === "FOUNDER"
      ? "La tarifa preferencial de setup otorgada bajo el esquema Founder Pricing permanecerá vigente mientras la suscripción permanezca activa y el alcance contratado no cambie sustancialmente.\nCualquier cambio de plan, incremento de alcance, contratación de nuevos módulos o reimplementación podrá generar una actualización de precios conforme a las condiciones comerciales vigentes en ese momento."
      : "La tarifa preferencial otorgada como Cliente Fundador permanecerá vigente mientras el cliente conserve el plan, módulos y alcance originalmente contratados.\nCualquier cambio de plan, incremento de alcance, contratación de nuevos módulos o reimplementación podrá generar una actualización de precios conforme a las condiciones comerciales vigentes en ese momento.";
    doc.text(
      condText,
      MARGIN_X,
      currentY + 4,
      { maxWidth: PAGE_WIDTH - MARGIN_X * 2, align: "justify" }
    );
    currentY += 20;
  }

  checkPageBreak(25);
  doc.setFont("helvetica", "bold");
  doc.text("Plazo y Cláusula de Vigencia de Propuesta:", MARGIN_X, currentY);
  doc.setFont("helvetica", "normal");
  const validityText = 
    "Esta propuesta comercial tiene una vigencia de 30 días naturales a partir de su fecha de emisión.\nDespués de dicho periodo, Aura podrá actualizar precios, promociones y condiciones comerciales conforme a la lista de precios comercial vigente.\nLa aceptación de la propuesta implica la aceptación de los términos comerciales descritos en este documento.";
  doc.text(validityText, MARGIN_X, currentY + 4, { maxWidth: PAGE_WIDTH - MARGIN_X * 2, align: "justify" });
}

export async function downloadProposalPdf(quote: PlatformQuote): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const logo = await loadImageAsDataUrl(LOGO_PATH);

  addCoverPage(doc, quote, logo);
  addExecutiveSummaryPage(doc, quote, logo);
  addPricingPage(doc, quote);
  addDetailsAndTermsPage(doc, quote, logo);

  // Post-process to write footers to all generated pages (except the cover)
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  const fileName = `${quote.folio}-${safeFileName(
    quote.prospectName || "propuesta"
  )}.pdf`;

  doc.save(fileName);
}