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
  doc.setFontSize(13);
  setTextColor(doc, TEXT_DARK);
  doc.text(title, MARGIN_X, y);

  setDrawColor(doc, BORDER);
  doc.line(MARGIN_X, y + 5, PAGE_WIDTH - MARGIN_X, y + 5);
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
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);
  doc.text(value || "Pendiente", x, y + 6);
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

  addSectionTitle(doc, "Datos generales", 62);

  addInfoRow(doc, "Cliente", quote.prospectName, MARGIN_X, 78);
  addInfoRow(doc, "Contacto", quote.contactName, 78, 78);
  addInfoRow(doc, "Correo", quote.contactEmail, 138, 78);

  addInfoRow(doc, "Industria", formatIndustry(quote.industry), MARGIN_X, 100);
  addInfoRow(doc, "Folio", quote.folio, 78, 100);
  addInfoRow(doc, "Vigencia", quote.validUntil, 138, 100);

  addSectionTitle(doc, "Alcance contratado", 130);

  const cardY = 146;
  const cardW = 38;
  const gap = 7;
  const cards = [
    ["Plan", quote.planName],
    ["Empleados", String(quote.employeeCount)],
    ["Ubicaciones", String(quote.locationCount)],
    ["Empresas", String(quote.companyCount)],
  ];

  cards.forEach(([label, value], index) => {
    const x = MARGIN_X + index * (cardW + gap);

    setFillColor(doc, [245, 248, 252]);
    setDrawColor(doc, BORDER);
    doc.roundedRect(x, cardY, cardW, 26, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setTextColor(doc, TEXT_MUTED);
    doc.text(label.toUpperCase(), x + 4, cardY + 8);

    doc.setFontSize(12);
    setTextColor(doc, TEXT_DARK);
    doc.text(value, x + 4, cardY + 18);
  });

  addSectionTitle(doc, "Productos Aura incluidos", 192);

  let y = 208;
  quote.selectedModules.forEach((moduleCode) => {
    setFillColor(doc, [235, 250, 252]);
    doc.circle(MARGIN_X + 3, y - 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setTextColor(doc, TEXT_DARK);
    doc.text(formatModuleName(moduleCode), MARGIN_X + 10, y);
    y += 9;
  });

  addFooter(doc, 2);
}

function addPricingPage(doc: jsPDF, quote: PlatformQuote) {
  doc.addPage();
  addTopBrandBar(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setTextColor(doc, TEXT_DARK);
  doc.text("Licenciamiento y Costos", MARGIN_X, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_MUTED);
  doc.text(
    `Facturación ${formatBillingCycle(quote.billingCycle).toLowerCase()} · Precios expresados en MXN más IVA.`,
    MARGIN_X,
    42
  );

  addSectionTitle(doc, "Conceptos cotizados", 62);

  let y = 82;

  setFillColor(doc, AURA_NAVY);
  doc.roundedRect(MARGIN_X, 70, PAGE_WIDTH - MARGIN_X * 2, 10, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setTextColor(doc, [255, 255, 255]);
  doc.text("Concepto", 22, 76.5);
  doc.text("Cantidad", 112, 76.5);
  doc.text("Precio", 142, 76.5);
  doc.text("Total", 176, 76.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTextColor(doc, TEXT_DARK);

  quote.items.forEach((item, index) => {
    if (index % 2 === 0) {
      setFillColor(doc, [248, 250, 252]);
      doc.rect(MARGIN_X, y - 5, PAGE_WIDTH - MARGIN_X * 2, 9, "F");
    }

    doc.text(item.label, 22, y);
    doc.text(String(item.quantity), 116, y);
    doc.text(formatCurrency(item.unitPrice), 136, y);
    doc.text(formatCurrency(item.total), 172, y);
    y += 10;
  });

  y += 8;
  setDrawColor(doc, BORDER);
  doc.line(116, y, PAGE_WIDTH - MARGIN_X, y);
  y += 8;

  const summaryX = 122;
  const valueX = 178;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);

  if (quote.billingCycle === "YEARLY") {
    doc.text("Subtotal anual antes de descuento", summaryX, y);
    doc.text(formatCurrency(quote.annualSubtotalBeforeDiscount), valueX, y, {
      align: "right",
    });
    y += 8;
  }

  if (quote.discountPercent > 0) {
    setTextColor(doc, [180, 110, 20]);
    doc.text(`Descuento (${quote.discountPercent}%)`, summaryX, y);
    doc.text(`-${formatCurrency(quote.discountAmount)}`, valueX, y, {
      align: "right",
    });
    y += 8;
    setTextColor(doc, TEXT_DARK);
  }

  doc.text("Subtotal", summaryX, y);
  doc.text(formatCurrency(quote.subtotal), valueX, y, { align: "right" });
  y += 8;

  doc.text("IVA", summaryX, y);
  doc.text(formatCurrency(quote.ivaAmount), valueX, y, { align: "right" });
  y += 12;

  setFillColor(doc, AURA_NAVY);
  doc.roundedRect(112, y - 7, 72, 16, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setTextColor(doc, [255, 255, 255]);
  doc.text("TOTAL", 118, y + 3);
  doc.text(formatCurrency(quote.total), 179, y + 3, { align: "right" });

  setTextColor(doc, TEXT_DARK);
  y += 30;

  addSectionTitle(doc, "Límites incluidos para provisioning", y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`• Empleados contratados: ${quote.employeesLimit}`, MARGIN_X, y);
  y += 8;
  doc.text(`• Ubicaciones contratadas: ${quote.locationsLimit}`, MARGIN_X, y);
  y += 8;
  doc.text(`• Empresas legales contratadas: ${quote.companiesLimit}`, MARGIN_X, y);
  y += 8;
  doc.text(`• Ciclo de facturación: ${formatBillingCycle(quote.billingCycle)}`, MARGIN_X, y);

  addFooter(doc, 3);
}

function addTermsPage(doc: jsPDF, quote: PlatformQuote, logo: string | null) {
  doc.addPage();
  addTopBrandBar(doc);

  if (logo) {
    doc.addImage(logo, "PNG", MARGIN_X, 24, 30, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setTextColor(doc, TEXT_DARK);
  doc.text("Términos Comerciales", 58, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_MUTED);
  doc.text(
    "Condiciones generales de la propuesta comercial Aura.",
    58,
    42
  );

  addSectionTitle(doc, "Condiciones", 64);

  const terms = [
    "Vigencia de la propuesta: 15 días naturales.",
    "Precios expresados en pesos mexicanos más IVA.",
    `Facturación ${formatBillingCycle(quote.billingCycle).toLowerCase()} según esta propuesta.`,
    "Implementación remota inicial incluida.",
    "Capacitación inicial incluida para usuarios clave.",
    "Soporte operativo inicial incluido durante arranque controlado.",
    "Sujeto a firma de contrato comercial y validación administrativa.",
    "Los módulos futuros o integraciones especiales podrán cotizarse por separado.",
  ];

  let y = 84;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setTextColor(doc, TEXT_DARK);

  terms.forEach((term) => {
    doc.text(`• ${term}`, MARGIN_X, y, { maxWidth: 170 });
    y += 10;
  });

  y += 10;

  addSectionTitle(doc, "Contacto comercial", y);
  y += 18;

  setFillColor(doc, [245, 248, 252]);
  setDrawColor(doc, BORDER);
  doc.roundedRect(MARGIN_X, y - 8, PAGE_WIDTH - MARGIN_X * 2, 42, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setTextColor(doc, TEXT_DARK);
  doc.text("Aura Nexus", MARGIN_X + 8, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("admin@auranexus.io", MARGIN_X + 8, y + 12);
  doc.text("442-350-8472", MARGIN_X + 8, y + 22);
  doc.text("auranexus.io", MARGIN_X + 8, y + 32);

  addFooter(doc, 4);
}

export async function downloadProposalPdf(quote: PlatformQuote): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const logo = await loadImageAsDataUrl(LOGO_PATH);

  addCoverPage(doc, quote, logo);
  addExecutiveSummaryPage(doc, quote, logo);
  addPricingPage(doc, quote);
  addTermsPage(doc, quote, logo);

  const fileName = `${quote.folio}-${safeFileName(
    quote.prospectName || "propuesta"
  )}.pdf`;

  doc.save(fileName);
}