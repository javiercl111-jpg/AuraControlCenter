import type {
  InegiCompany,
  OpportunityScoreBreakdown,
  RecommendedSuite,
} from "../types/inegi";

// Normalización de emails: Limpieza, minúsculas, validación de placeholders
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  const cleaned = email.trim().toLowerCase();
  
  // Lista de marcadores de posición comunes en el DENUE
  const placeholders = [
    "no disponible",
    "n/a",
    "no aplica",
    "sin correo",
    "no_disponible",
    "noreply",
    "sin_correo",
    "none",
    "null",
  ];
  
  if (placeholders.some(p => cleaned.includes(p))) {
    return "";
  }
  
  // Validación básica de expresión regular
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return "";
  }
  
  return cleaned;
}

// Normalización de teléfonos: Sólo dígitos, estándar 10 caracteres (México), descartar placeholders
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Eliminar todo lo que no sea número
  const cleaned = phone.replace(/\D/g, "");
  
  const placeholders = [
    "0000000000",
    "1234567890",
    "1111111111",
  ];
  
  if (placeholders.includes(cleaned) || cleaned.length < 8 || cleaned.length > 15) {
    return "";
  }
  
  // Devolver estándar de 10 dígitos si aplica (e.g. si viene con 52 prefix, recortar)
  if (cleaned.length === 12 && cleaned.startsWith("52")) {
    return cleaned.slice(2);
  }
  
  return cleaned;
}

// Generación de ID determinístico para evitar duplicados y proteger costo de Firestore (0 reads en inserción)
export function generateDeterministicId(
  razonSocial: string | null | undefined,
  nombreComercial: string | null | undefined,
  municipio: string | null | undefined,
  scian: string | null | undefined
): string {
  const cleanStr = (str: string | null | undefined) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/[^a-z0-9]/g, "") // Eliminar caracteres especiales
      .trim();

  const partName = cleanStr(razonSocial) || cleanStr(nombreComercial) || "empresa";
  const partMun = cleanStr(municipio) || "sinmunicipio";
  const partScian = cleanStr(scian) || "sinscian";

  return `inegi_${partName}_${partMun}_${partScian}`.slice(0, 100);
}

// Cálculo del Aura Opportunity Score
export function calculateOpportunityScore(
  rawSourceScore: number | null | undefined,
  tamano: string | null | undefined,
  sector: string | null | undefined,
  emailValido: string,
  telefonoValido: string,
  sitioWeb: string | null | undefined
): OpportunityScoreBreakdown {
  // 1. Base INEGI Score (Max 25 pts)
  let rawScore = Number(rawSourceScore) || 0;
  // Si el score viene en escala de 0 a 10 (típico de algunos tops), normalizar a 100
  if (rawScore > 0 && rawScore <= 10) {
    rawScore = rawScore * 10;
  }
  const sourceScore = Math.min(25, Math.round(rawScore * 0.25));

  // 2. Tamaño de la Empresa (Max 20 pts)
  let companySizeScore = 5; // Base para Micro
  const cleanTamano = (tamano || "").toLowerCase();
  if (cleanTamano.includes("grande") || cleanTamano.includes("251") || cleanTamano.includes("101")) {
    companySizeScore = 20;
  } else if (cleanTamano.includes("mediana") || cleanTamano.includes("51") || cleanTamano.includes("31")) {
    companySizeScore = 15;
  } else if (cleanTamano.includes("pequeña") || cleanTamano.includes("11") || cleanTamano.includes("pequena")) {
    companySizeScore = 10;
  }

  // 3. Sector Económico SCIAN (Max 20 pts)
  let sectorScore = 5; // Base
  const cleanSector = (sector || "").toLowerCase();
  
  // Sectores de alto valor para Aura (Finanzas, Tecnología, Servicios Profesionales)
  if (
    cleanSector.includes("financier") || 
    cleanSector.includes("seguro") || 
    cleanSector.includes("tecnolog") ||
    cleanSector.includes("informacion") || 
    cleanSector.includes("profesional") ||
    cleanSector.includes("cientific") ||
    cleanSector.includes("corporativo")
  ) {
    sectorScore = 20;
  } else if (cleanSector.includes("manufactur") || cleanSector.includes("industr")) {
    sectorScore = 15;
  } else if (cleanSector.includes("comercio") || cleanSector.includes("servicios")) {
    sectorScore = 10;
  }

  // 4. Medios de Contacto y Alcance (Max 35 pts)
  let reachabilityScore = 0;
  if (emailValido) reachabilityScore += 15;
  if (telefonoValido) reachabilityScore += 10;
  
  const cleanWeb = (sitioWeb || "").toLowerCase().trim();
  const hasWeb = cleanWeb && cleanWeb !== "no disponible" && cleanWeb !== "n/a" && cleanWeb !== "no aplica";
  if (hasWeb) reachabilityScore += 10;

  const total = sourceScore + companySizeScore + sectorScore + reachabilityScore;

  return {
    total,
    sourceScore,
    companySizeScore,
    sectorScore,
    reachabilityScore,
  };
}

// Mapeo automático de suites recomendadas
export function determineRecommendedSuites(
  sector: string | null | undefined,
  tamano: string | null | undefined,
  rangoPersonal: string | null | undefined,
  scoreTotal: number
): RecommendedSuite[] {
  const suites: RecommendedSuite[] = [];
  const cleanSector = (sector || "").toLowerCase();
  const cleanTamano = (tamano || "").toLowerCase();
  const cleanRango = (rangoPersonal || "").toLowerCase();

  const esGrandeOMediana = 
    cleanTamano.includes("grande") || 
    cleanTamano.includes("mediana") || 
    cleanRango.includes("50") || 
    cleanRango.includes("100") || 
    cleanRango.includes("250");

  // People Suite: Foco en empresas medianas/grandes, o sectores de alta mano de obra (Manufactura, Comercio grande)
  if (esGrandeOMediana || cleanSector.includes("manufactur") || cleanSector.includes("comercio")) {
    suites.push("People Suite");
  }

  // Sales Suite: Sectores con enfoque comercial o servicios financieros
  if (
    cleanSector.includes("comercio") || 
    cleanSector.includes("financier") || 
    cleanSector.includes("servicios") ||
    cleanSector.includes("seguro") ||
    cleanSector.includes("alojamiento") ||
    cleanSector.includes("alimentos")
  ) {
    suites.push("Sales Suite");
  }

  // Compensation Suite: Foco en grandes/medianas con estructuras salariales complejas
  if (esGrandeOMediana) {
    suites.push("Compensation Suite");
  }

  // Operations Suite: Manufactura, construcción, transporte y logística
  if (
    cleanSector.includes("manufactur") || 
    cleanSector.includes("construc") || 
    cleanSector.includes("transport") || 
    cleanSector.includes("logistica")
  ) {
    suites.push("Operations Suite");
  }

  // Intelligence Suite: Oportunidades con alto score (>= 60) o gran tamaño
  if (scoreTotal >= 60 || esGrandeOMediana) {
    suites.push("Intelligence Suite");
  }

  // Digital Trust Suite: Servicios financieros, legales, de seguros o consultoría corporativa
  if (
    cleanSector.includes("financier") || 
    cleanSector.includes("seguro") || 
    cleanSector.includes("profesional") ||
    cleanSector.includes("juridic") ||
    cleanSector.includes("consultor")
  ) {
    suites.push("Digital Trust Suite");
  }

  // Asegurar al menos una suite recomendada
  if (suites.length === 0) {
    suites.push("Sales Suite");
  }

  return suites;
}

// Normalización de una fila del Excel del DENUE
export function normalizeRow(row: any): InegiCompany {
  // Mapear campos con fallbacks por diferencias de cabeceras en distintos estados del INEGI
  const razonSocial = String(row["Razón Social"] || row["Razon Social"] || row["RAZON SOCIAL"] || "").trim();
  const nombreComercial = String(row["Nombre Comercial"] || row["Nombre comercial"] || row["NOMBRE COMERCIAL"] || "").trim();
  const sector = String(row["Sector"] || row["SECTOR"] || "").trim();
  const tamano = String(row["Tamaño"] || row["Tamaño de la unidad económica"] || row["TAMANO"] || "Micro").trim();
  const rangoPersonal = String(row["Rango Personal"] || row["Rango personal"] || row["Personal ocupado"] || "0 a 5 personas").trim();
  
  const rawTelefono = String(row["Teléfono"] || row["Telefono"] || row["TELEFONO"] || "").trim();
  const rawEmail = String(row["Email"] || row["Correo electrónico"] || row["EMAIL"] || "").trim();
  const sitioWeb = String(row["Sitio Web"] || row["Sitio internet"] || row["SITIO WEB"] || "").trim();
  
  const direccion = String(row["Dirección"] || row["Direccion"] || row["DIRECCION"] || "").trim();
  const municipio = String(row["Municipio"] || row["MUNICIPIO"] || "").trim();
  const estado = String(row["Estado"] || row["ESTADO"] || "").trim();
  const cp = String(row["C.P."] || row["CP"] || row["Codigo postal"] || "").trim();
  const scian = String(row["SCIAN"] || row["Código de la clase de actividad SCIAN"] || "").trim();
  const actividad = String(row["Actividad"] || row["Nombre de la clase de actividad"] || "").trim();
  
  const latitud = Number(row["Latitud"] || row["LATITUD"] || 0);
  const longitud = Number(row["Longitud"] || row["LONGITUD"] || 0);
  const altaDenue = String(row["Alta DENUE"] || row["Fecha de incorporación al DENUE"] || row["ALTA DENUE"] || "").trim();
  
  // Normalizar contactos
  const email = normalizeEmail(rawEmail);
  const telefono = normalizePhone(rawTelefono);
  
  // Score de la fuente (INEGI/DENUE) - típicamente es 0-100 o un ranking.
  const rawSourceScore = Number(row["Score"] || row["SCORE"] || 0);
  
  // Calcular Aura Opportunity Score
  const scoreBreakdown = calculateOpportunityScore(
    rawSourceScore,
    tamano,
    sector,
    email,
    telefono,
    sitioWeb
  );

  const opportunityScore = scoreBreakdown.total;
  const recommendedSuites = determineRecommendedSuites(sector, tamano, rangoPersonal, opportunityScore);
  const id = generateDeterministicId(razonSocial, nombreComercial, municipio, scian);

  return {
    id,
    razonSocial,
    nombreComercial,
    sector,
    tamano,
    rangoPersonal,
    telefono,
    email,
    sitioWeb,
    direccion,
    municipio,
    estado,
    cp,
    scian,
    actividad,
    latitud,
    longitud,
    altaDenue,
    sourceScore: rawSourceScore,
    opportunityScore,
    scoreBreakdown,
    recommendedSuites,
    status: "NEW",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const NormalizationService = {
  normalizeEmail,
  normalizePhone,
  generateDeterministicId,
  calculateOpportunityScore,
  determineRecommendedSuites,
  normalizeRow,
};

export default NormalizationService;
