import { utils } from "xlsx";
import type {
  InegiCompany,
  OpportunityScoreBreakdown,
  RecommendedSuite,
} from "../types/inegi";
import { resolveCanonicalIndustry } from "./industryResolverService";
import { getNormalizedStateName, normalizeState } from "./marketQueryEngine";

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

/**
 * Genera la información estratégica del Aura Commercial Advisor basándose en reglas de negocio.
 */
export function generateCommercialAdvisorInfo(
  opportunityScore: number,
  tamano: string,
  sector: string,
  email: string,
  telefono: string,
  sitioWeb: string,
  actividad: string
): {
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  motives: string[];
  nextAction: string;
} {
  const motives: string[] = [];

  // 1. Evaluar prioridad
  let priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (opportunityScore >= 85) priorityLevel = "CRITICAL";
  else if (opportunityScore >= 70) priorityLevel = "HIGH";
  else if (opportunityScore >= 45) priorityLevel = "MEDIUM";

  // 2. Construir motivos basados en reglas
  const cleanSector = (sector || "").toLowerCase();
  const cleanTamano = (tamano || "").toLowerCase();
  const cleanActividad = (actividad || "").toLowerCase();

  // Motivos del giro
  if (cleanSector.includes("alojamiento") || cleanActividad.includes("hotel")) {
    motives.push("Giro de Alojamiento/Hotelería: Alta rotación operativa. Crítico digitalizar control de turnos.");
  } else if (cleanSector.includes("alimentos") || cleanActividad.includes("restaurante")) {
    motives.push("Giro de Restaurante/Alimentos: Foco en contratación rápida y expedientes digitales.");
  } else if (cleanSector.includes("manufactur") || cleanSector.includes("industria")) {
    motives.push("Sector Industrial: Complejidad operativa. Oportunidad en Operations & People Suite.");
  } else if (cleanSector.includes("financier") || cleanSector.includes("seguro")) {
    motives.push("Servicios Financieros: Alto potencial presupuestario para la línea Intelligence Suite.");
  } else {
    motives.push("Giro comercial idóneo para el ecosistema de automatización Aura.");
  }

  // Motivos del tamaño
  if (cleanTamano.includes("grande") || cleanTamano.includes("mediana")) {
    motives.push(`Estructura corporativa clasificada como ${tamano} (Requiere tabuladores complejos).`);
  } else {
    motives.push("Pyme ágil ideal para adopción rápida en la nube.");
  }

  // Motivos de contacto
  if (email && email !== "no disponible" && email !== "no aplica") {
    motives.push("Canal de email verificado: Permite enviar presentación comercial digital.");
  }
  if (telefono && telefono !== "no disponible" && telefono !== "no aplica") {
    motives.push("Contacto telefónico disponible: Apto para prospección telefónica directa.");
  }
  
  const cleanWeb = (sitioWeb || "").toLowerCase().trim();
  const hasWeb = cleanWeb && cleanWeb !== "no disponible" && cleanWeb !== "n/a" && cleanWeb !== "no aplica";
  if (hasWeb) {
    motives.push("Sitio web activo: Refleja infraestructura y madurez tecnológica compatible.");
  }

  // 3. Siguiente acción recomendada
  let nextAction = "Registrar prospecto y validar datos generales en base local.";
  if (priorityLevel === "CRITICAL") {
    nextAction = "Llamada comercial prioritaria: Agendar demo de 15 min enfocada en Operations & People Suite.";
  } else if (priorityLevel === "HIGH") {
    nextAction = "Enviar correo de contacto personalizado con folleto de Sales & Compensation Suite.";
  } else if (priorityLevel === "MEDIUM") {
    nextAction = "Validar tomador de decisiones (RRHH/Operaciones) mediante llamada exploratoria.";
  }

  return {
    priorityLevel,
    motives,
    nextAction,
  };
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
  
  const advisor = generateCommercialAdvisorInfo(
    opportunityScore,
    tamano,
    sector,
    email,
    telefono,
    sitioWeb,
    actividad
  );

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
    priorityLevel: advisor.priorityLevel,
    motives: advisor.motives,
    nextAction: advisor.nextAction,
    status: "NEW",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    commercialIndustryCode: resolveCanonicalIndustry({ scian, actividad, sector }).code,
    commercialIndustryLabel: resolveCanonicalIndustry({ scian, actividad, sector }).label,
  };
}

export interface HeaderMap {
  razonSocialIdx: number;
  nombreComercialIdx: number;
  sectorIdx: number;
  tamanoIdx: number;
  rangoPersonalIdx: number;
  telefonoIdx: number;
  emailIdx: number;
  sitioWebIdx: number;
  direccionIdx: number;
  municipioIdx: number;
  estadoIdx: number;
  cpIdx: number;
  scianIdx: number;
  actividadIdx: number;
  latitudIdx: number;
  longitudIdx: number;
  altaDenueIdx: number;
  scoreIdx: number;
}

// Scanea filas 2D y detecta encabezados del DENUE
export function detectHeaderRowAndBuildMap(rows2D: any[][]): {
  headerRowIndex: number;
  headerMap: HeaderMap;
  headers: string[];
} {
  for (let r = 0; r < Math.min(rows2D.length, 30); r++) {
    const row = rows2D[r];
    if (!row || !Array.isArray(row)) continue;

    const cleanCells = row.map((cell) => String(cell || "").trim().toLowerCase());

    const matches = cleanCells.filter((cell) => {
      return (
        cell.includes("razon social") ||
        cell.includes("razón social") ||
        cell.includes("denominacion") ||
        cell.includes("denominación") ||
        cell.includes("nombre comercial") ||
        cell.includes("establecimiento") ||
        cell.includes("unidad economica") ||
        cell.includes("unidad económica") ||
        cell.includes("scian") ||
        cell.includes("actividad")
      );
    });

    if (matches.length >= 2) {
      const headers = row.map((cell) => String(cell || "").trim());
      const headerMap = mapHeadersToIndices(headers);
      return {
        headerRowIndex: r,
        headerMap,
        headers,
      };
    }
  }

  throw new Error(
    "No se pudo detectar la fila de encabezados del DENUE en el archivo Excel. Asegúrate de incluir al menos columnas de identificación comercial como 'Razón Social' (Denominación) o 'Nombre Comercial'."
  );
}

function mapHeadersToIndices(headers: string[]): HeaderMap {
  const cleanHeaders = headers.map(h => h.trim().toLowerCase());

  const findIndex = (aliases: string[]): number => {
    return cleanHeaders.findIndex(header => 
      aliases.some(alias => header === alias || header.includes(alias))
    );
  };

  const map: HeaderMap = {
    razonSocialIdx: findIndex([
      "razón social", "razon social", "denominación", "denominacion", "nombre o razón", "nombre o razon"
    ]),
    nombreComercialIdx: findIndex([
      "nombre comercial", "nombre_comercial", "nombre del establecimiento", "nom_estab", "nom_establecimiento", "establecimiento", "unidad económica", "unidad economica"
    ]),
    sectorIdx: findIndex([
      "sector económico", "sector economico", "sector_economico", "sector"
    ]),
    tamanoIdx: findIndex([
      "tamaño de la unidad", "tamaño", "tamano", "estratificación", "estratificacion"
    ]),
    rangoPersonalIdx: findIndex([
      "rango de personal", "rango personal", "personal ocupado", "personal_ocupado", "rango_personal"
    ]),
    telefonoIdx: findIndex([
      "teléfono", "telefono", "tel", "móvil", "movil", "fijo"
    ]),
    emailIdx: findIndex([
      "correo electrónico", "correo electronico", "correo", "email", "e-mail"
    ]),
    sitioWebIdx: findIndex([
      "sitio web", "sitio_web", "sitio internet", "pagina web", "pagina_web", "url", "web"
    ]),
    direccionIdx: findIndex([
      "dirección", "direccion", "domicilio", "calle"
    ]),
    municipioIdx: findIndex([
      "municipio", "nom_mun", "delegación", "delegacion"
    ]),
    estadoIdx: findIndex([
      "estado", "entidad", "nom_ent", "provincia"
    ]),
    cpIdx: findIndex([
      "c.p.", "cp", "código postal", "codigo postal", "postal"
    ]),
    scianIdx: findIndex([
      "scian", "clase de actividad", "clase_actividad"
    ]),
    actividadIdx: findIndex([
      "actividad", "nombre de la clase de actividad", "nombre_actividad"
    ]),
    latitudIdx: findIndex([
      "latitud", "lat"
    ]),
    longitudIdx: findIndex([
      "longitud", "lon", "lng"
    ]),
    altaDenueIdx: findIndex([
      "alta denue", "fecha de incorporación", "alta_denue", "fecha_alta"
    ]),
    scoreIdx: findIndex([
      "score", "calificación", "calificacion"
    ])
  };

  // Validación de campos mandatorios
  if (map.razonSocialIdx === -1 && map.nombreComercialIdx === -1) {
    throw new Error(
      "No se pudo mapear las columnas requeridas del DENUE. Faltan columnas críticas de identificación: Razón Social (Denominación) o Nombre Comercial."
    );
  }

  return map;
}

// Normaliza fila Array de Excel usando el mapa de índices
export function normalizeRowWithMap(rowArray: any[], map: HeaderMap): InegiCompany {
  const getValue = (idx: number, fallback: string = ""): string => {
    if (idx === -1 || idx >= rowArray.length) return fallback;
    const val = rowArray[idx];
    return val !== undefined && val !== null ? String(val).trim() : fallback;
  };

  const getNumber = (idx: number, fallback: number = 0): number => {
    if (idx === -1 || idx >= rowArray.length) return fallback;
    const val = Number(rowArray[idx]);
    return isNaN(val) ? fallback : val;
  };

  const razonSocial = getValue(map.razonSocialIdx);
  const nombreComercial = getValue(map.nombreComercialIdx);
  const sector = getValue(map.sectorIdx);
  const tamano = getValue(map.tamanoIdx, "Micro");
  const rangoPersonal = getValue(map.rangoPersonalIdx, "0 a 5 personas");
  
  const rawTelefono = getValue(map.telefonoIdx);
  const rawEmail = getValue(map.emailIdx);
  const sitioWeb = getValue(map.sitioWebIdx);
  
  const direccion = getValue(map.direccionIdx);
  const municipio = getValue(map.municipioIdx);
  const estado = getValue(map.estadoIdx);
  const cp = getValue(map.cpIdx);
  const scian = getValue(map.scianIdx);
  const actividad = getValue(map.actividadIdx);
  
  const latitud = getNumber(map.latitudIdx);
  const longitud = getNumber(map.longitudIdx);
  const altaDenue = getValue(map.altaDenueIdx);
  
  const email = normalizeEmail(rawEmail);
  const telefono = normalizePhone(rawTelefono);
  
  const rawSourceScore = getNumber(map.scoreIdx, 0);
  
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

  const advisor = generateCommercialAdvisorInfo(
    opportunityScore,
    tamano,
    sector,
    email,
    telefono,
    sitioWeb,
    actividad
  );

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
    priorityLevel: advisor.priorityLevel,
    motives: advisor.motives,
    nextAction: advisor.nextAction,
    status: "NEW",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    commercialIndustryCode: resolveCanonicalIndustry({ scian, actividad, sector }).code,
    commercialIndustryLabel: resolveCanonicalIndustry({ scian, actividad, sector }).label,
  };
}

/**
 * Procesa un objeto workbook de XLSX, busca la hoja adecuada (ej. "Datos" o la primera),
 * detecta la fila de cabeceras, normaliza los registros y devuelve la lista de empresas.
 */
export function parseExcelWorkbook(
  workbook: any,
  customState?: string,
  filename?: string
): {
  sheetName: string;
  sheetNames: string[];
  totalRows: number;
  headerRowIndex: number;
  headerMap: any;
  headers: string[];
  companies: InegiCompany[];
} {
  console.log(`[NormalizationService] Iniciando parseo de workbook. Hojas disponibles:`, workbook.SheetNames);
  
  // Buscar la hoja llamada "Datos" (case-insensitive) o usar la primera
  const sheetName =
    workbook.SheetNames.find(
      (name: string) => name.toLowerCase() === "datos"
    ) || workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("El archivo Excel no contiene ninguna hoja.");
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`No se pudo leer la hoja '${sheetName}' en el Excel.`);
  }

  // Convertir a matriz 2D
  const rows2D = utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  console.log(`[NormalizationService] Hoja seleccionada: "${sheetName}". Filas físicas leídas: ${rows2D.length}`);

  if (rows2D.length === 0) {
    throw new Error(`La hoja '${sheetName}' está vacía.`);
  }

  // Detectar cabeceras y construir mapa de índices
  const { headerRowIndex, headerMap, headers } = detectHeaderRowAndBuildMap(rows2D);
  console.log(`[NormalizationService] Encabezados detectados en fila ${headerRowIndex + 1}:`, headers);

  const dataRows = rows2D.slice(headerRowIndex + 1);
  const companies: InegiCompany[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowArray = dataRows[i];
    if (!rowArray || rowArray.length === 0) continue;

    try {
      const company = normalizeRowWithMap(rowArray, headerMap);
      company.estado = getNormalizedStateName(customState || company.estado, filename);
      (company as any).estadoNormalized = normalizeState(company.estado);
      const excelStateVal = headerMap.estadoIdx !== -1 && headerMap.estadoIdx < rowArray.length ? String(rowArray[headerMap.estadoIdx] || "").trim() : "";
      (company as any).sourceState = excelStateVal || "No Especificado";
      
      if (company.razonSocial || company.nombreComercial) {
        companies.push(company);
      }
    } catch (err) {
      // Ignorar fila inválida de forma individual
    }
  }

  console.log(`[NormalizationService] Total filas de datos: ${dataRows.length}. Empresas normalizadas válidas: ${companies.length}`);

  return {
    sheetName,
    sheetNames: workbook.SheetNames,
    totalRows: rows2D.length,
    headerRowIndex,
    headerMap,
    headers,
    companies,
  };
}

const NormalizationService = {
  normalizeEmail,
  normalizePhone,
  generateDeterministicId,
  calculateOpportunityScore,
  determineRecommendedSuites,
  generateCommercialAdvisorInfo,
  normalizeRow,
  detectHeaderRowAndBuildMap,
  normalizeRowWithMap,
  parseExcelWorkbook,
};

export default NormalizationService;
