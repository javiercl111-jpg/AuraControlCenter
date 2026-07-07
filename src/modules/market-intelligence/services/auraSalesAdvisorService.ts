import type { InegiCompany } from "../types/inegi";
import { resolveCommercialIndustry } from "./industryResolverService";

export interface RecommendedSolution {
  product: string;
  suite: string;
  description: string;
}

export interface AuraSalesAdvice {
  conversionProbability: number; // 0 to 100
  confidenceLevel: "Alta" | "Media" | "Baja";
  priorityLabel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  whyContact: string;
  recommendedSolutions: RecommendedSolution[];
  openingSpeech: string;
  discoveryQuestions: string[];
  possibleObjections: string[];
  objectionResponses: string[];
  nextRecommendedAction: string;
  estimatedMrr: number;
  estimatedArr: number;
  recommendedFirstProduct: string;
}

/**
 * Normaliza la cantidad de personal o rango a un grupo específico.
 */
function getCompanySizeGroup(
  rangoPersonal: string | null | undefined,
  tamano: string | null | undefined
): "0-5" | "6-30" | "31-100" | "101-250" | "250+" {
  const cleanRango = (rangoPersonal || "").toLowerCase().trim();
  const cleanTamano = (tamano || "").toLowerCase().trim();

  if (cleanRango.includes("0 a 5") || cleanRango === "0-5" || cleanRango.includes("1 a 5")) {
    return "0-5";
  }
  if (
    cleanRango.includes("6 a 10") ||
    cleanRango.includes("11 a 30") ||
    cleanRango.includes("6 a 30")
  ) {
    return "6-30";
  }
  if (
    cleanRango.includes("31 a 50") ||
    cleanRango.includes("51 a 100") ||
    cleanRango.includes("31 a 100")
  ) {
    return "31-100";
  }
  if (cleanRango.includes("101 a 250")) {
    return "101-250";
  }
  if (
    cleanRango.includes("251") ||
    cleanRango.includes("250") ||
    cleanRango.includes("mas") ||
    cleanRango.includes("más") ||
    cleanTamano.includes("grande")
  ) {
    return "250+";
  }

  // Búsqueda de números como fallback
  const numbers = cleanRango.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    const maxVal = Math.max(...numbers.map(Number));
    if (maxVal <= 5) return "0-5";
    if (maxVal <= 30) return "6-30";
    if (maxVal <= 100) return "31-100";
    if (maxVal <= 250) return "101-250";
    return "250+";
  }

  // Fallback por texto del tamaño de unidad económica
  if (cleanTamano.includes("micro") || cleanTamano.includes("pequeñ")) {
    return "0-5";
  }
  if (cleanTamano.includes("median")) {
    return "31-100";
  }
  return "6-30";
}

/**
 * Genera el análisis de ventas (Aura Sales Advisor) para una compañía DENUE.
 */
export function generateAuraSalesAdvice(company: InegiCompany): AuraSalesAdvice {
  const industry = resolveCommercialIndustry(company.sector);
  const sizeGroup = getCompanySizeGroup(company.rangoPersonal, company.tamano);

  const hasEmail = company.email && company.email !== "no disponible" && company.email.includes("@");
  const hasPhone = company.telefono && company.telefono !== "no disponible" && company.telefono.trim().length >= 8;
  const hasContact = hasEmail || hasPhone;

  // 1. Determinar prioridad, probabilidad y confianza
  let priorityLabel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
  let conversionProbability = 30;
  let confidenceLevel: "Alta" | "Media" | "Baja" = "Media";

  const score = company.opportunityScore || 0;

  if (sizeGroup === "0-5") {
    priorityLabel = "LOW";
    conversionProbability = hasContact ? 40 : 20;
    confidenceLevel = "Baja";
  } else if (sizeGroup === "250+") {
    priorityLabel = score >= 75 ? "CRITICAL" : "HIGH";
    conversionProbability = score >= 75 ? 90 : 75;
    confidenceLevel = "Alta";
  } else {
    // 6-30, 31-100, 101-250
    if (score >= 85) {
      priorityLabel = "CRITICAL";
      conversionProbability = 88;
      confidenceLevel = "Alta";
    } else if (score >= 70) {
      priorityLabel = "HIGH";
      conversionProbability = 72;
      confidenceLevel = "Alta";
    } else if (score >= 45) {
      priorityLabel = "MEDIUM";
      conversionProbability = 52;
      confidenceLevel = "Media";
    } else {
      priorityLabel = "LOW";
      conversionProbability = 35;
      confidenceLevel = "Baja";
    }
  }

  // 2. Determinar primer producto recomendado
  let recommendedFirstProduct = "Aura HCM";
  if (sizeGroup === "0-5") {
    recommendedFirstProduct = "Aura Base";
  } else if (industry === "Manufactura" || industry === "Hoteles y Hospedaje") {
    if (sizeGroup === "101-250" || sizeGroup === "250+") {
      recommendedFirstProduct = "Aura Maintenance";
    } else {
      recommendedFirstProduct = "Aura HCM";
    }
  } else if (industry.includes("Comercio")) {
    recommendedFirstProduct = "Aura HCM"; // HCM es el core en empresas comerciales medianas
  }

  // 3. Determinar soluciones recomendadas (Producto + Suite)
  const solutions: RecommendedSolution[] = [];

  const catalog = {
    base: { product: "Aura Base", suite: "Sales Suite", description: "CRM simplificado y módulo de ventas para pequeños negocios." },
    hcm: { product: "Aura HCM", suite: "People Suite", description: "Gestión avanzada de talento, asistencia, vacaciones y nómina." },
    hcmBasic: { product: "Aura HCM Básico", suite: "People Suite", description: "Módulo esencial de recursos humanos y expedientes." },
    maintenance: { product: "Aura Maintenance", suite: "Operations Suite", description: "Control preventivo de activos, equipos e instalaciones críticas." },
    maintenanceLight: { product: "Aura Maintenance Ligero", suite: "Operations Suite", description: "Bitácoras rápidas y reportes sencillos de mantenimiento." },
    intel: { product: "Aura Intelligence", suite: "Analytics & Advisor", description: "Dashboard directivo, analítica predictiva y reportes avanzados." },
    intelLite: { product: "Aura Intelligence Lite", suite: "Analytics & Advisor", description: "Reportería de KPIs básicos y visualización operativa." },
    sig: { product: "Aura Signature", suite: "Digital Trust", description: "Firmas digitales con validez legal, contratos y cumplimiento." },
    sales: { product: "Aura CRM", suite: "Sales Suite", description: "Seguimiento de prospectos, cotizaciones y cálculo de comisiones." },
  };

  // Lógica de recomendación de soluciones por tamaño
  if (sizeGroup === "0-5") {
    solutions.push(catalog.base);
    if (hasContact) {
      solutions.push(catalog.sales);
    }
  } else if (sizeGroup === "6-30") {
    solutions.push(catalog.hcmBasic);
    // Posible Sales Suite
    if (hasContact || industry.includes("Comercio")) {
      solutions.push(catalog.sales);
    }
    // Industria específica pequeña
    if (industry === "Restaurantes y Alimentos") {
      solutions.push(catalog.maintenanceLight);
    } else if (industry === "Hoteles y Hospedaje") {
      solutions.push(catalog.maintenance);
    }
  } else if (sizeGroup === "31-100") {
    solutions.push(catalog.hcm);
    solutions.push(catalog.sig);
    solutions.push(catalog.intelLite);
    if (industry === "Manufactura" || industry === "Hoteles y Hospedaje") {
      solutions.push(catalog.maintenance);
    } else if (industry === "Restaurantes y Alimentos") {
      solutions.push(catalog.maintenanceLight);
    }
  } else if (sizeGroup === "101-250") {
    solutions.push(catalog.hcm);
    solutions.push(catalog.sig);
    solutions.push(catalog.intel);
    // Si industria aplica
    if (
      industry === "Manufactura" ||
      industry === "Hoteles y Hospedaje" ||
      industry === "Restaurantes y Alimentos"
    ) {
      solutions.push(industry === "Restaurantes y Alimentos" ? catalog.maintenanceLight : catalog.maintenance);
    }
  } else {
    // 250+ (Enterprise)
    solutions.push(catalog.hcm);
    solutions.push(catalog.maintenance);
    solutions.push(catalog.intel);
    solutions.push(catalog.sig);
  }

  // 4. Dolor principal e Speech Inicial
  let mainPain = "los expedientes de su personal, la nómina y el control de asistencia diario";
  let whyContact = `Empresa con score de ${score}/100 que representa una oportunidad para digitalizar procesos manuales y optimizar tiempos.`;

  if (industry === "Hoteles y Hospedaje") {
    mainPain = "el mantenimiento de habitaciones y el control de asistencia de turnos 24/7";
    whyContact = `Establecimiento hotelero con alta carga de personal en turnos rotativos. Requiere coordinar mantenimiento de instalaciones críticas y automatizar el control de asistencia biométrica.`;
  } else if (industry === "Restaurantes y Alimentos") {
    mainPain = "la rotación de su personal de piso y cocina y el mantenimiento de sus equipos";
    whyContact = `Negocio de alimentos que presenta típicamente alta rotación laboral. Requiere simplificar el onboarding de personal y mantener activos de cocina de forma preventiva.`;
  } else if (industry === "Manufactura") {
    mainPain = "los planes de mantenimiento preventivo de maquinaria y el control de turnos del personal de planta";
    whyContact = `Planta de manufactura con activos industriales costosos. Necesita minimizar paros no programados mediante Aura Maintenance y agilizar turnos rotativos.`;
  } else if (industry === "Hospitales") {
    mainPain = "los turnos del personal médico y la firma electrónica de expedientes clínicos";
    whyContact = `Institución médica con estrictos requisitos normativos. La firma digital de contratos y la optimización de roles del personal son prioridades clave.`;
  } else if (industry.includes("Comercio")) {
    mainPain = "la fuerza de ventas, el pago de comisiones y el registro de entradas y salidas de tienda";
    whyContact = `Empresa comercializadora que requiere integrar su CRM de ventas con la administración de recursos humanos, controlando comisiones de asesores.`;
  } else if (industry === "Servicios Profesionales") {
    mainPain = "la firma de contratos de servicios y el expediente digital de sus colaboradores";
    whyContact = `Organización de servicios intensiva en talento. Se beneficia enormemente de la firma remota de contratos (Aura Signature) y el expediente digital de empleados.`;
  }

  const cleanRangoText = company.rangoPersonal || "0 a 5 personas";
  const cleanIndustryText = industry || "su sector comercial";

  const openingSpeech = `“Hola, soy Javier de Aura. Revisando su empresa, veo que operan en el sector de ${cleanIndustryText} y cuentan con aproximadamente ${cleanRangoText}. Quisiera hacerle una pregunta: ¿cómo administran actualmente ${mainPain}?”`;

  // 5. Preguntas Discovery (Generar entre 5 y 7)
  const discoveryQuestions: string[] = [];

  // Agregar preguntas según las soluciones recomendadas
  const hasHcm = solutions.some((s) => s.product.startsWith("Aura HCM"));
  const hasMaint = solutions.some((s) => s.product.startsWith("Aura Maintenance"));
  const hasSales = solutions.some((s) => s.product === "Aura CRM" || s.product === "Aura Base");
  const hasSignature = solutions.some((s) => s.product === "Aura Signature");

  if (hasHcm) {
    discoveryQuestions.push("¿Cuántos colaboradores administran actualmente en su nómina y operación?");
    discoveryQuestions.push("¿Cómo controlan actualmente la asistencia y retardos?");
    discoveryQuestions.push("¿De qué forma gestionan las vacaciones, los expedientes y los documentos del personal?");
  }

  if (hasMaint) {
    discoveryQuestions.push("¿Cómo administran actualmente el mantenimiento preventivo de sus activos o instalaciones?");
    discoveryQuestions.push("¿Utilizan QR o algún historial digital para registrar las órdenes de trabajo?");
  }

  if (hasSales) {
    discoveryQuestions.push("¿Cómo distribuyen y miden las metas de venta de sus asesores?");
    discoveryQuestions.push("¿Qué proceso siguen para cotizar y calcular las comisiones de su equipo comercial?");
  }

  if (hasSignature && discoveryQuestions.length < 6) {
    discoveryQuestions.push("¿Cuánto tiempo les toma recabar firmas en contratos laborales o comerciales?");
  }

  // Asegurar que haya mínimo 5 y máximo 7 preguntas
  if (discoveryQuestions.length < 5) {
    discoveryQuestions.push("¿Qué proceso administrativo les consume más tiempo hoy en día?");
    discoveryQuestions.push("¿Utilizan Excel para la gestión operativa o cuentan con algún sistema?");
  }
  if (discoveryQuestions.length > 7) {
    discoveryQuestions.splice(7);
  }

  // 6. Objeciones y Respuestas
  const possibleObjections = [
    "Ya tenemos sistema.",
    "No tenemos presupuesto.",
    "No es prioridad.",
    "Mándame información.",
    "Lo reviso después.",
  ];

  const objectionResponses = [
    "Entiendo. Aura no necesariamente reemplaza todo lo que tienen; se integra para potenciar áreas específicas como el control de asistencia biométrico o firmas digitales, reduciendo hasta un 30% los tiempos administrativos.",
    "Lo comprendo. De hecho, Aura se paga solo al automatizar tareas operativas y evitar multas o errores de nómina. Contamos con planes escalables desde $1,500 MXN mensuales para que comiencen a ver el retorno de inversión de inmediato.",
    "Claro, las prioridades operativas mandan. Sin embargo, digitalizar este proceso ahora liberará tiempo de su equipo clave para enfocarse en sus verdaderas prioridades comerciales. ¿Qué tal una llamada de 10 minutos para evaluar la viabilidad?",
    "Con gusto le envío la información, pero para que sea verdaderamente útil para usted, ¿me permite hacerle 2 preguntas rápidas para enviarle solo lo que aplica a su tamaño e industria?",
    "Entiendo que esté ocupado. Agendemos una breve llamada de 10 minutos para la próxima semana; así podré resumirle el valor en lugar de que dedique tiempo a leer PDFs largos.",
  ];

  // 7. Siguiente acción recomendada
  let nextRecommendedAction = "";
  if (priorityLabel === "CRITICAL") {
    nextRecommendedAction = `Llamada comercial prioritaria hoy: Agendar Demo interactiva de 15 minutos enfocada en ${recommendedFirstProduct} y presentar propuesta económica inicial.`;
  } else if (priorityLabel === "HIGH") {
    nextRecommendedAction = `Llamada comercial: Presentar caso de éxito del sector ${industry} y coordinar sesión de Discovery detallada.`;
  } else if (priorityLabel === "MEDIUM") {
    nextRecommendedAction = `Enviar correo personalizado con los beneficios de ${recommendedFirstProduct} y dar seguimiento telefónico en 48 horas.`;
  } else {
    nextRecommendedAction = `Agregar a campaña de nutrición por correo sobre digitalización empresarial y validar si surge interacción.`;
  }

  // 8. MRR / ARR Estimado en Pesos MXN
  let estimatedMrr = 1500;
  if (sizeGroup === "0-5") {
    estimatedMrr = hasContact ? 2500 : 1500;
  } else if (sizeGroup === "6-30") {
    estimatedMrr = 4500 + (solutions.some((s) => s.product === "Aura CRM") ? 2000 : 0);
  } else if (sizeGroup === "31-100") {
    estimatedMrr = 9500;
  } else if (sizeGroup === "101-250") {
    estimatedMrr = 18500 + (solutions.some((s) => s.product.startsWith("Aura Maintenance")) ? 5000 : 0);
  } else {
    // 250+ (Enterprise)
    estimatedMrr = 38000;
  }

  const estimatedArr = estimatedMrr * 12;

  return {
    conversionProbability,
    confidenceLevel,
    priorityLabel,
    whyContact,
    recommendedSolutions: solutions,
    openingSpeech,
    discoveryQuestions,
    possibleObjections,
    objectionResponses,
    nextRecommendedAction,
    estimatedMrr,
    estimatedArr,
    recommendedFirstProduct,
  };
}

const auraSalesAdvisorService = {
  generateAuraSalesAdvice,
};

export default auraSalesAdvisorService;
