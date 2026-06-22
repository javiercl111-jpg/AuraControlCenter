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

function addFooter(doc: jsPDF, pageNumber: number) {
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

  doc.text(`Página ${pageNumber}`, PAGE_WIDTH - MARGIN_X, 284, {
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

  addFooter(doc, 2);
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

  addSectionTitle(doc, "1. Costos de Licenciamiento Recurrentes", 45);

  let y = 65;

  setFillColor(doc, AURA_NAVY);
  doc.roundedRect(MARGIN_X, 55, PAGE_WIDTH - MARGIN_X * 2, 8, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setTextColor(doc, [255, 255, 255]);
  doc.text("Concepto de Licenciamiento", 22, 60.5);
  doc.text("Cantidad", 112, 60.5);
  doc.text("Precio Unitario", 142, 60.5);
  doc.text("Total", 176, 60.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT_DARK);

  quote.items.forEach((item, index) => {
    if (index % 2 === 0) {
      setFillColor(doc, [248, 250, 252]);
      doc.rect(MARGIN_X, y - 4, PAGE_WIDTH - MARGIN_X * 2, 7, "F");
    }

    doc.text(item.label, 22, y);
    doc.text(String(item.quantity), 116, y);
    doc.text(formatCurrency(item.unitPrice), 136, y);
    doc.text(formatCurrency(item.total), 172, y);
    y += 7;
  });

  y += 4;
  setDrawColor(doc, BORDER);
  doc.line(116, y, PAGE_WIDTH - MARGIN_X, y);
  y += 6;

  const summaryX = 112;
  const valueX = 188;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTextColor(doc, TEXT_DARK);

  if (quote.billingCycle === "YEARLY") {
    doc.text("Subtotal anual antes de descuentos", summaryX, y);
    doc.text(formatCurrency(quote.annualSubtotalBeforeDiscount), valueX, y, {
      align: "right",
    });
    y += 6;

    setTextColor(doc, [180, 110, 20]);
    const isSpecial = quote.discountPercent === 15 || (quote.discountPercent > 0 && quote.discountPercent !== 10);
    const discLabel = isSpecial 
      ? `Descuento Recurrente Anual Especial (${quote.discountPercent}%)`
      : `Descuento Recurrente Anual Estándar (${quote.discountPercent}%)`;

    doc.text(discLabel, summaryX, y);
    doc.text(`-${formatCurrency(quote.discountAmount)}`, valueX, y, {
      align: "right",
    });
    y += 6;
    setTextColor(doc, TEXT_DARK);
  }

  doc.text("Subtotal recurrente", summaryX, y);
  doc.text(formatCurrency(quote.subtotal), valueX, y, { align: "right" });
  y += 6;

  doc.text("IVA recurrente (16%)", summaryX, y);
  doc.text(formatCurrency(quote.ivaAmount), valueX, y, { align: "right" });
  y += 8;

  setFillColor(doc, AURA_NAVY);
  doc.roundedRect(110, y - 5, 82, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, [255, 255, 255]);
  doc.text("TOTAL RECURRENTE", 114, y + 1.5);
  doc.text(formatCurrency(quote.total), 187, y + 1.5, { align: "right" });

  setTextColor(doc, TEXT_DARK);
  y += 15;

  addSectionTitle(doc, "2. Costo Único de Implementación / Setup", y);
  y += 12;

  const isLegacy =
    quote.setupFee === undefined ||
    quote.setupBreakdown === undefined ||
    quote.annualProjectedRevenue === undefined;

  if (isLegacy) {
    setFillColor(doc, [254, 243, 199]);
    setDrawColor(doc, [251, 191, 36]);
    doc.roundedRect(MARGIN_X, y - 4, PAGE_WIDTH - MARGIN_X * 2, 25, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setTextColor(doc, [146, 64, 14]);
    doc.text("COMPATIBILIDAD CON PROPUESTA LEGACY", MARGIN_X + 6, y + 3);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(
      "Esta propuesta fue generada antes de la implementación del desglose avanzado de setup y costos de implementación.",
      MARGIN_X + 6,
      y + 12,
      { maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 12 }
    );
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(doc, TEXT_MUTED);
    doc.text("MÉTRICA / CONCEPTO", MARGIN_X, y);
    doc.text("VALOR / PUNTOS", 112, y);
    doc.text("MONTO", 176, y);

    setDrawColor(doc, BORDER);
    doc.line(MARGIN_X, y + 2.5, PAGE_WIDTH - MARGIN_X, y + 2.5);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setTextColor(doc, TEXT_DARK);

    doc.text("Precio Base de Implementación (Setup)", MARGIN_X, y);
    doc.text(formatCurrency(quote.setupBasePrice), 172, y);
    y += 6;

    doc.text("Puntos de Complejidad Calculados", MARGIN_X, y);
    doc.text(`${quote.setupComplexityScore} Pts`, 112, y);
    y += 6;

    doc.text("Setup antes de descuentos", MARGIN_X, y);
    doc.text(formatCurrency(quote.setupFeeBeforeDiscount), 172, y);
    y += 6;

    if (quote.setupDiscountPercent > 0) {
      setTextColor(doc, [180, 110, 20]);
      let setupDiscLabel = "Descuento Especial de Setup";
      if (quote.founderClient) {
        setupDiscLabel = quote.setupDiscountPercent === 100
          ? "Bonificación Total Setup (Cliente Fundador 100%)"
          : `Descuento Cliente Fundador Setup (${quote.setupDiscountPercent}%)`;
      }
      doc.text(setupDiscLabel, MARGIN_X, y);
      doc.text(`-${formatCurrency(quote.setupDiscountAmount)}`, 172, y);
      y += 6;
      setTextColor(doc, TEXT_DARK);
    }

    doc.setFont("helvetica", "bold");
    doc.text("Costo Final de Setup (Único Pago)", MARGIN_X, y);
    doc.text(formatCurrency(quote.setupFee), 172, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(doc, TEXT_DARK);
    doc.text("Desglose de Complejidad y Configuración (Setup):", MARGIN_X, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_MUTED);
    let breakdownLine = "";
    quote.setupBreakdown.forEach((item, idx) => {
      const prod = item.product === "AURA_HCM" ? "HCM" : "Maintenance";
      breakdownLine += `${item.factor} (${prod}): ${item.score} Pts`;
      if (idx < quote.setupBreakdown.length - 1) {
        breakdownLine += "  |  ";
      }
    });
    doc.text(breakdownLine, MARGIN_X, y, { maxWidth: PAGE_WIDTH - MARGIN_X * 2 });
    y += 12;

    if (quote.founderClient) {
      if (quote.setupFee === 0) {
        setFillColor(doc, [240, 253, 244]);
        setDrawColor(doc, [74, 222, 128]);
        doc.roundedRect(MARGIN_X, y - 4, PAGE_WIDTH - MARGIN_X * 2, 28, 3, 3, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        setTextColor(doc, [21, 128, 61]);
        doc.text("SETUP SIN COSTO POR PROMOCIÓN CLIENTE FUNDADOR", MARGIN_X + 6, y + 2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          "El costo de implementación ha sido bonificado como beneficio comercial por incorporación temprana al ecosistema Aura.\nEste beneficio aplica únicamente al alcance originalmente contratado y podrá revisarse si existen ampliaciones futuras.",
          MARGIN_X + 6,
          y + 10,
          { maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 12 }
        );
      } else {
        setFillColor(doc, [239, 246, 255]);
        setDrawColor(doc, [96, 165, 250]);
        doc.roundedRect(MARGIN_X, y - 4, PAGE_WIDTH - MARGIN_X * 2, 28, 3, 3, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        setTextColor(doc, [29, 78, 216]);
        doc.text("DESCUENTO CLIENTE FUNDADOR", MARGIN_X + 6, y + 2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          "Por ser cliente fundador de Aura se aplica un descuento del 50% sobre el costo de implementación (setup).\nEste beneficio se mantiene vigente mientras el cliente conserve el plan originalmente contratado.",
          MARGIN_X + 6,
          y + 10,
          { maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 12 }
        );
      }
    }
  }

  addFooter(doc, 3);
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

  const colW = 82;
  const colGap = 10;
  const col1X = MARGIN_X;
  const col2X = MARGIN_X + colW + colGap;

  // --- LEFT COLUMN ---
  let yL = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);
  doc.text("1. ¿Qué incluye el Setup / Implementación?", col1X, yL);
  
  setDrawColor(doc, BORDER);
  doc.line(col1X, yL + 2, col1X + colW, yL + 2);
  yL += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, TEXT_DARK);

  const includesHcm = quote.selectedModules.includes("AURA_HCM");
  const includesMaint = quote.selectedModules.includes("AURA_MAINTENANCE");

  let setupBullets: string[] = [];
  if (includesHcm && includesMaint) {
    setupBullets = [
      "Configuración y despliegue de tenants HCM y Maintenance.",
      "Parametrización de estructura organizacional y ubicaciones.",
      "Configuración de perfiles de usuarios y técnicos base.",
      "Carga inicial asistida de colaboradores, activos y catálogos.",
      "Generación de QR masivos para control físico de activos.",
      "Capacitación inicial integral para líderes y administradores.",
      "Soporte preferente y acompañamiento en puesta en marcha.",
    ];
  } else if (includesHcm) {
    setupBullets = [
      "Configuración inicial del tenant exclusivo de Aura HCM.",
      "Parametrización inicial de estructura organizacional.",
      "Configuración de módulos contratados y usuarios base.",
      "Carga inicial asistida de colaboradores e históricos.",
      "Capacitación inicial técnica y operativa a administradores.",
      "Soporte de arranque y acompañamiento continuo en implementación.",
    ];
  } else if (includesMaint) {
    setupBullets = [
      "Configuración de ubicaciones, sucursales y áreas de trabajo.",
      "Configuración de activos, categorías y criticidades.",
      "Configuración de inventario base y repuestos iniciales.",
      "Configuración de perfiles de técnicos y flujos de trabajo.",
      "Generación y asignación de códigos QR masivos para activos.",
      "Capacitación inicial y soporte operativo en arranque.",
    ];
  } else {
    setupBullets = [
      "Configuración y despliegue del tenant en la infraestructura Aura.",
      "Parametrización operativa inicial según necesidades de negocio.",
      "Carga inicial de catálogos y datos de sistema base.",
      "Configuración de usuarios base y permisos de seguridad.",
      "Capacitación inicial para administradores clave.",
    ];
  }

  setupBullets.forEach((bullet) => {
    doc.text(`• ${bullet}`, col1X, yL, { maxWidth: colW });
    yL += 6;
  });

  // Business Benefits
  yL = 103;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);
  doc.text("2. Beneficio de Negocio Autorizado", col1X, yL);

  setDrawColor(doc, BORDER);
  doc.line(col1X, yL + 2, col1X + colW, yL + 2);
  yL += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, TEXT_DARK);

  let benefits: string[] = [];
  if (includesHcm && includesMaint) {
    benefits = [
      "Centralización total del capital humano y control operativo.",
      "Reducción de carga administrativa mediante automatización.",
      "Expedientes digitales y control centralizado de activos.",
      "Firma electrónica integrada y menor tiempo de respuesta.",
      "Trazabilidad operativa integral y reducción de fallas.",
      "Información estratégica consolidada para la toma de decisiones.",
    ];
  } else if (includesHcm) {
    benefits = [
      "Centralización de procesos clave de recursos humanos.",
      "Reducción drástica del trabajo administrativo rutinario.",
      "Expedientes digitales seguros para consulta en tiempo real.",
      "Automatización de solicitudes, incidencias y asistencia.",
      "Firma electrónica integrada con plena validez legal.",
      "Mayor trazabilidad y cumplimiento en auditorías y regulaciones.",
    ];
  } else if (includesMaint) {
    benefits = [
      "Control físico y trazabilidad completa de activos críticos.",
      "Reducción en tiempos de respuesta ante incidentes operativos.",
      "Planificación y control del mantenimiento preventivo.",
      "Gestión móvil para optimizar la jornada de los técnicos.",
      "Historial de mantenimiento y auditoría por activo.",
      "Reducción sustancial de paros operativos inesperados.",
    ];
  } else {
    benefits = [
      "Mayor eficiencia y digitalización en la gestión interna.",
      "Disponibilidad de información centralizada en la nube.",
      "Trazabilidad de operaciones y reducción de reprocesos.",
    ];
  }

  benefits.forEach((benefit) => {
    doc.text(`• ${benefit}`, col1X, yL, { maxWidth: colW });
    yL += 6;
  });

  // Timeline
  yL = 152;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);
  doc.text("3. Cronograma Estimado de Entrega", col1X, yL);

  setDrawColor(doc, BORDER);
  doc.line(col1X, yL + 2, col1X + colW, yL + 2);
  yL += 7;

  const isLegacy =
    quote.setupFee === undefined ||
    quote.setupBreakdown === undefined ||
    quote.annualProjectedRevenue === undefined;

  const complexity = isLegacy ? 0 : quote.setupComplexityScore;
  const isSimple = complexity <= 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, TEXT_DARK);

  if (isSimple) {
    doc.text("Proyecto de Complejidad Simple (2 semanas estimadas):", col1X, yL, { maxWidth: colW });
    yL += 5;
    
    setFillColor(doc, [240, 253, 244]);
    setDrawColor(doc, [74, 222, 128]);
    doc.roundedRect(col1X, yL, colW, 28, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, [21, 128, 61]);
    doc.text("Semana 1: Kickoff, Configuración y Carga", col1X + 4, yL + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_DARK);
    doc.text("— Puesta en marcha inicial del tenant y carga base.", col1X + 4, yL + 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, [21, 128, 61]);
    doc.text("Semana 2: Capacitación y Arranque", col1X + 4, yL + 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_DARK);
    doc.text("— Sesiones operativas y salida a producción activa.", col1X + 4, yL + 24);
  } else {
    doc.text("Proyecto de Complejidad Estándar (4 semanas estimadas):", col1X, yL, { maxWidth: colW });
    yL += 5;

    setFillColor(doc, [248, 250, 252]);
    setDrawColor(doc, BORDER);
    doc.roundedRect(col1X, yL, colW, 46, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setTextColor(doc, TEXT_DARK);
    
    doc.text("Semana 1: Kickoff y Parametrización", col1X + 4, yL + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setTextColor(doc, TEXT_MUTED);
    doc.text("— Alineación del proyecto y estructuras base.", col1X + 4, yL + 9);

    doc.setFont("helvetica", "bold");
    setTextColor(doc, TEXT_DARK);
    doc.text("Semana 2: Configuración y Carga Asistida", col1X + 4, yL + 16);
    doc.setFont("helvetica", "normal");
    doc.text("— Carga asistida de datos y alta de usuarios.", col1X + 4, yL + 20);

    doc.setFont("helvetica", "bold");
    setTextColor(doc, TEXT_DARK);
    doc.text("Semana 3: Capacitación Operativa", col1X + 4, yL + 27);
    doc.setFont("helvetica", "normal");
    doc.text("— Capacitación a administradores y técnicos.", col1X + 4, yL + 31);

    doc.setFont("helvetica", "bold");
    setTextColor(doc, TEXT_DARK);
    doc.text("Semana 4: Arranque Productivo", col1X + 4, yL + 38);
    doc.setFont("helvetica", "normal");
    doc.text("— Acompañamiento inicial y salida a producción.", col1X + 4, yL + 42);
  }

  // --- RIGHT COLUMN ---
  let yR = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);
  doc.text("4. ¿Qué incluye el Plan Contratado?", col2X, yR);

  setDrawColor(doc, BORDER);
  doc.line(col2X, yR + 2, col2X + colW, yR + 2);
  yR += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, TEXT_DARK);

  const planBullets = [
    "Acceso total a la plataforma según plan contratado.",
    "Límites asignados de colaboradores, sucursales y empresas.",
    "Actualizaciones de software continuas sin costo adicional.",
    "Hospedaje de bases de datos seguro en nube AWS/Firebase.",
    "Respaldos diarios automáticos e históricos de datos.",
    "Soporte preferente y Mesa de Ayuda técnica autorizada.",
  ];

  planBullets.forEach((bullet) => {
    doc.text(`• ${bullet}`, col2X, yR, { maxWidth: colW });
    yR += 6;
  });

  // First Payment Box
  yR = 103;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);
  doc.text("5. Resumen Comercial de Primer Pago", col2X, yR);

  setDrawColor(doc, BORDER);
  doc.line(col2X, yR + 2, col2X + colW, yR + 2);
  yR += 7;

  setFillColor(doc, [245, 248, 252]);
  setDrawColor(doc, BORDER);
  doc.roundedRect(col2X, yR, colW, 46, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, TEXT_DARK);

  doc.text("Subtotal Licenciamiento:", col2X + 4, yR + 6);
  doc.text(formatCurrency(quote.subtotal), col2X + colW - 4, yR + 6, { align: "right" });

  doc.text("Setup de Implementación:", col2X + 4, yR + 12);
  const setupVal = isLegacy ? 0 : quote.setupFeeBeforeDiscount;
  doc.text(formatCurrency(setupVal), col2X + colW - 4, yR + 12, { align: "right" });

  doc.text("Descuento Setup Aplicado:", col2X + 4, yR + 18);
  const setupDisc = isLegacy ? 0 : quote.setupDiscountAmount;
  doc.text(`-${formatCurrency(setupDisc)}`, col2X + colW - 4, yR + 18, { align: "right" });

  setDrawColor(doc, BORDER);
  doc.line(col2X + 4, yR + 22, col2X + colW - 4, yR + 22);

  doc.setFont("helvetica", "bold");
  doc.text("Subtotal Primer Pago:", col2X + 4, yR + 27);
  const subFirst = isLegacy ? quote.subtotal : quote.firstPaymentSubtotal;
  doc.text(formatCurrency(subFirst), col2X + colW - 4, yR + 27, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.text("IVA Primer Pago (16%):", col2X + 4, yR + 33);
  const ivaFirst = isLegacy ? quote.ivaAmount : quote.firstPaymentIvaAmount;
  doc.text(formatCurrency(ivaFirst), col2X + colW - 4, yR + 33, { align: "right" });

  setFillColor(doc, AURA_NAVY);
  doc.rect(col2X + 2, yR + 36, colW - 4, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setTextColor(doc, [255, 255, 255]);
  doc.text("TOTAL PRIMER PAGO:", col2X + 4, yR + 41.5);
  const totalFirst = isLegacy ? quote.total : quote.firstPaymentTotal;
  doc.text(formatCurrency(totalFirst), col2X + colW - 6, yR + 41.5, { align: "right" });

  yR += 46;

  if (!isLegacy) {
    yR += 4;
    setFillColor(doc, [236, 253, 245]);
    setDrawColor(doc, [167, 243, 208]);
    doc.roundedRect(col2X, yR, colW, 12, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, [6, 95, 70]);
    doc.text("Ingreso Anual Proyectado (ARR):", col2X + 4, yR + 4.5);
    doc.text(formatCurrency(quote.annualProjectedRevenue), col2X + colW - 4, yR + 4.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("— Licenciamiento anual consolidado + setup final.", col2X + 4, yR + 9.5);
    yR += 12;
  }

  // Conditions & Validity
  yR = 170;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);
  doc.text("6. Condiciones y Vigencia", col2X, yR);

  setDrawColor(doc, BORDER);
  doc.line(col2X, yR + 2, col2X + colW, yR + 2);
  yR += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, TEXT_DARK);

  if (quote.founderClient) {
    doc.setFont("helvetica", "bold");
    doc.text("Cláusula Cliente Fundador:", col2X, yR);
    doc.setFont("helvetica", "normal");
    doc.text(
      "La tarifa preferencial otorgada permanecerá vigente mientras se conserve el plan, módulos y alcance contratados originalmente. Cambios o reimplementaciones futuras podrán actualizar los costos.",
      col2X,
      yR + 3,
      { maxWidth: colW, align: "justify" }
    );
    yR += 18;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Cláusula de Vigencia Comercial:", col2X, yR);
  doc.setFont("helvetica", "normal");
  
  const validityText = 
    "Esta propuesta tiene una vigencia de 30 días naturales a partir de su fecha de emisión. Después de dicho periodo, Aura podrá actualizar precios, promociones y condiciones comerciales conforme a la lista vigente.\nLa aceptación de la propuesta implica la aceptación de los términos comerciales descritos en este documento.";
  doc.text(validityText, col2X, yR + 3, { maxWidth: colW, align: "justify" });

  addFooter(doc, 4);
}

export async function downloadProposalPdf(quote: PlatformQuote): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const logo = await loadImageAsDataUrl(LOGO_PATH);

  addCoverPage(doc, quote, logo);
  addExecutiveSummaryPage(doc, quote, logo);
  addPricingPage(doc, quote);
  addDetailsAndTermsPage(doc, quote, logo);

  const fileName = `${quote.folio}-${safeFileName(
    quote.prospectName || "propuesta"
  )}.pdf`;

  doc.save(fileName);
}