import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as XLSX from "xlsx";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { generateDeterministicId } from "./utils/identityUtils";

admin.initializeApp();

const db = admin.firestore();

// ----------------- Interfaces -----------------
interface OpportunityScoreBreakdown {
  total: number;
  sourceScore: number;
  companySizeScore: number;
  sectorScore: number;
  reachabilityScore: number;
}

interface HeaderMap {
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
  cleeIdx: number;
}

// ----------------- Normalization Helpers -----------------
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  const cleaned = email.trim().toLowerCase();

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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");

  const placeholders = [
    "0000000000",
    "1234567890",
    "1111111111",
  ];

  if (placeholders.includes(cleaned) || cleaned.length < 8 || cleaned.length > 15) {
    return "";
  }

  if (cleaned.length === 12 && cleaned.startsWith("52")) {
    return cleaned.slice(2);
  }

  return cleaned;
}

function normalizeState(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getNormalizedStateName(stateVal: string, filename?: string): string {
  const cleanVal = (stateVal || "").trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (cleanVal.includes("queretaro") || cleanVal.includes("22")) return "Querétaro";
  if (cleanVal.includes("tabasco") || cleanVal.includes("27")) return "Tabasco";
  if (cleanVal.includes("jalisco") || cleanVal.includes("14")) return "Jalisco";
  if (cleanVal.includes("nuevo leon") || cleanVal.includes("19")) return "Nuevo León";
  if (cleanVal.includes("cdmx") || cleanVal.includes("ciudad de mexico") || cleanVal.includes("distrito federal") || cleanVal.includes("09")) return "Ciudad de México";

  if (filename) {
    const cleanFile = filename.toLowerCase();
    if (cleanFile.includes("queretaro") || cleanFile.includes("22_")) return "Querétaro";
    if (cleanFile.includes("tabasco") || cleanFile.includes("27_")) return "Tabasco";
    if (cleanFile.includes("jalisco") || cleanFile.includes("14_")) return "Jalisco";
    if (cleanFile.includes("nuevo") || cleanFile.includes("19_")) return "Nuevo León";
    if (cleanFile.includes("cdmx") || cleanFile.includes("09_") || cleanFile.includes("ciudad de mexico") || cleanFile.includes("ciudad de me")) return "Ciudad de México";
  }

  if (cleanVal === "tab") return "Tabasco";
  if (cleanVal === "qro") return "Querétaro";
  if (cleanVal === "jal") return "Jalisco";
  if (cleanVal === "nl") return "Nuevo León";
  if (cleanVal === "df" || cleanVal === "distrito federal") return "Ciudad de México";

  return stateVal && cleanVal !== "no especificado" && cleanVal !== "null" ? stateVal : "No Especificado";
}

// Deterministic ID logic has been moved to utils/identityUtils.ts

function calculateOpportunityScore(
  rawSourceScore: number | null | undefined,
  tamano: string | null | undefined,
  sector: string | null | undefined,
  emailValido: string,
  telefonoValido: string,
  sitioWeb: string | null | undefined
): OpportunityScoreBreakdown {
  let rawScore = Number(rawSourceScore) || 0;
  if (rawScore > 0 && rawScore <= 10) {
    rawScore = rawScore * 10;
  }
  const sourceScore = Math.min(25, Math.round(rawScore * 0.25));

  let companySizeScore = 5;
  const cleanTamano = (tamano || "").toLowerCase();
  if (cleanTamano.includes("grande") || cleanTamano.includes("251") || cleanTamano.includes("101")) {
    companySizeScore = 20;
  } else if (cleanTamano.includes("mediana") || cleanTamano.includes("51") || cleanTamano.includes("31")) {
    companySizeScore = 15;
  } else if (cleanTamano.includes("pequeña") || cleanTamano.includes("11") || cleanTamano.includes("pequena")) {
    companySizeScore = 10;
  }

  let sectorScore = 5;
  const cleanSector = (sector || "").toLowerCase();

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
  } else if (cleanSector.includes("manufactur") || cleanSector.includes("industria")) {
    sectorScore = 15;
  } else if (cleanSector.includes("comercio") || cleanSector.includes("servicios")) {
    sectorScore = 10;
  }

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

function determineRecommendedSuites(
  sector: string | null | undefined,
  tamano: string | null | undefined,
  rangoPersonal: string | null | undefined,
  scoreTotal: number
): string[] {
  const suites: string[] = [];
  const cleanSector = (sector || "").toLowerCase();
  const cleanTamano = (tamano || "").toLowerCase();
  const cleanRango = (rangoPersonal || "").toLowerCase();

  const esGrandeOMediana =
    cleanTamano.includes("grande") ||
    cleanTamano.includes("mediana") ||
    cleanRango.includes("50") ||
    cleanRango.includes("100") ||
    cleanRango.includes("250");

  if (esGrandeOMediana || cleanSector.includes("manufactur") || cleanSector.includes("comercio")) {
    suites.push("People Suite");
  }

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

  if (esGrandeOMediana) {
    suites.push("Compensation Suite");
  }

  if (
    cleanSector.includes("manufactur") ||
    cleanSector.includes("construc") ||
    cleanSector.includes("transport") ||
    cleanSector.includes("logistica")
  ) {
    suites.push("Operations Suite");
  }

  if (scoreTotal >= 60 || esGrandeOMediana) {
    suites.push("Intelligence Suite");
  }

  if (
    cleanSector.includes("financier") ||
    cleanSector.includes("seguro") ||
    cleanSector.includes("profesional") ||
    cleanSector.includes("juridic") ||
    cleanSector.includes("consultor")
  ) {
    suites.push("Digital Trust Suite");
  }

  if (suites.length === 0) {
    suites.push("Sales Suite");
  }

  return suites;
}

function generateCommercialAdvisorInfo(
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
  let priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (opportunityScore >= 85) priorityLevel = "CRITICAL";
  else if (opportunityScore >= 70) priorityLevel = "HIGH";
  else if (opportunityScore >= 45) priorityLevel = "MEDIUM";

  const cleanSector = (sector || "").toLowerCase();
  const cleanTamano = (tamano || "").toLowerCase();
  const cleanActividad = (actividad || "").toLowerCase();

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

  if (cleanTamano.includes("grande") || cleanTamano.includes("mediana")) {
    motives.push(`Estructura corporativa clasificada como ${tamano} (Requiere tabuladores complejos).`);
  } else {
    motives.push("Pyme ágil ideal para adopción rápida en la nube.");
  }

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

function detectHeaderRowAndBuildMap(rows: any[][]): { headerRowIndex: number; headerMap: HeaderMap } {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(cell => typeof cell === "string" && /razon|denominacion|nombre/i.test(cell))) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (rows[headerRowIndex] || []).map(cell => (cell !== undefined && cell !== null ? String(cell).trim().toLowerCase() : ""));
  const findIndex = (possibleNames: string[]) => {
    return headers.findIndex(h => possibleNames.some(name => h === name || h.includes(name)));
  };

  const headerMap: HeaderMap = {
    razonSocialIdx: findIndex(["razon social", "razon_social", "denominacion", "nombre o razon social"]),
    nombreComercialIdx: findIndex(["nombre comercial", "nombre_comercial", "establecimiento", "negocio"]),
    sectorIdx: findIndex(["sector", "actividad sectorial", "nombre de la clase de actividad"]),
    tamanoIdx: findIndex(["tamano", "tamaño", "estrato"]),
    rangoPersonalIdx: findIndex(["personal", "rango de personal", "rango_personal"]),
    telefonoIdx: findIndex(["telefono", "teléfono", "tel"]),
    emailIdx: findIndex(["email", "correo", "e-mail", "correo electronico"]),
    sitioWebIdx: findIndex(["sitio web", "sitio_web", "web", "pagina"]),
    direccionIdx: findIndex(["direccion", "dirección", "calle"]),
    municipioIdx: findIndex(["municipio", "municipio_nom", "nom_mun"]),
    estadoIdx: findIndex(["estado", "entidad", "nom_ent", "provincia"]),
    cpIdx: findIndex(["c.p.", "cp", "código postal", "codigo postal"]),
    scianIdx: findIndex(["scian", "clase de actividad", "clase_actividad"]),
    actividadIdx: findIndex(["actividad", "nombre de la clase de actividad"]),
    latitudIdx: findIndex(["latitud", "lat"]),
    longitudIdx: findIndex(["longitud", "lon", "lng"]),
    altaDenueIdx: findIndex(["alta denue", "fecha_alta"]),
    scoreIdx: findIndex(["score", "calificación", "calificacion"]),
    cleeIdx: findIndex(["clee", "id", "identificador", "clave"]),
  };

  if (headerMap.razonSocialIdx === -1 && headerMap.nombreComercialIdx === -1) {
    throw new Error("No se pudo mapear las columnas requeridas del DENUE.");
  }

  return { headerRowIndex, headerMap };
}

interface CanonicalIndustry {
  code: string;
  label: string;
}

function resolveCanonicalIndustry(company: {
  scian?: string | null;
  actividad?: string | null;
  nombreActividad?: string | null;
  descripcionActividad?: string | null;
  claseActividad?: string | null;
  sector?: string | null;
}): CanonicalIndustry {
  const getScianCode = (): string => {
    if (company.scian) {
      const match = String(company.scian).trim().match(/^\d+/);
      if (match) return match[0];
    }
    const fields = [
      company.actividad,
      company.nombreActividad,
      company.descripcionActividad,
      company.claseActividad,
      company.sector
    ];
    for (const f of fields) {
      if (f) {
        const match = String(f).trim().match(/^\d+/);
        if (match) return match[0];
      }
    }
    return "";
  };

  const scianCode = getScianCode();

  if (scianCode) {
    if (scianCode.startsWith("721")) {
      return { code: "HOTELS_LODGING", label: "Hoteles y Hospedaje" };
    }
    if (scianCode.startsWith("722")) {
      return { code: "RESTAURANTS_FOOD", label: "Restaurantes y Alimentos" };
    }
    if (scianCode.startsWith("31") || scianCode.startsWith("32") || scianCode.startsWith("33")) {
      return { code: "MANUFACTURING", label: "Manufactura" };
    }
    if (scianCode.startsWith("23")) {
      return { code: "CONSTRUCTION", label: "Construcción" };
    }
    if (scianCode.startsWith("62")) {
      return { code: "HEALTHCARE", label: "Hospitales" };
    }
    if (scianCode.startsWith("61")) {
      return { code: "EDUCATION", label: "Educación" };
    }
    if (scianCode.startsWith("54")) {
      return { code: "PROFESSIONAL_SERVICES", label: "Servicios Profesionales" };
    }
    if (scianCode.startsWith("46")) {
      return { code: "RETAIL", label: "Comercio Minorista" };
    }
    if (scianCode.startsWith("43")) {
      return { code: "WHOLESALE", label: "Comercio Mayorista" };
    }
    if (scianCode.startsWith("48") || scianCode.startsWith("49")) {
      return { code: "TRANSPORT_LOGISTICS", label: "Logística" };
    }
    if (scianCode.startsWith("51")) {
      return { code: "TECHNOLOGY", label: "Medios y Telecomunicaciones" };
    }
    if (scianCode.startsWith("93")) {
      return { code: "GOVERNMENT", label: "Gobierno" };
    }
    if (scianCode.startsWith("52") || scianCode.startsWith("55")) {
      return { code: "FINANCIAL_SERVICES", label: "Servicios Financieros" };
    }
  }

  const checkTextMatch = (text: string): CanonicalIndustry | null => {
    const norm = (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!norm) return null;

    if (
      norm.includes("hotel") ||
      norm.includes("hospedaje") ||
      norm.includes("motel") ||
      norm.includes("alojamiento")
    ) {
      return { code: "HOTELS_LODGING", label: "Hoteles y Hospedaje" };
    }

    if (
      norm.includes("restaurante") ||
      norm.includes("alimento") ||
      norm.includes("comida") ||
      norm.includes("bar") ||
      norm.includes("cafeteria") ||
      norm.includes("bebida")
    ) {
      return { code: "RESTAURANTS_FOOD", label: "Restaurantes y Alimentos" };
    }

    if (norm.includes("hospital") || norm.includes("clinica") || norm.includes("medico") || norm.includes("consultorio") || norm.includes("salud")) {
      return { code: "HEALTHCARE", label: "Hospitales" };
    }

    if (norm.includes("manufactura") || norm.includes("fabrica") || norm.includes("produccion") || norm.includes("maquila") || norm.includes("industrial")) {
      return { code: "MANUFACTURING", label: "Manufactura" };
    }

    if (norm.includes("construccion") || norm.includes("edificacion") || norm.includes("obra civil")) {
      return { code: "CONSTRUCTION", label: "Construcción" };
    }

    if (norm.includes("educacion") || norm.includes("escuela") || norm.includes("colegio") || norm.includes("universidad")) {
      return { code: "EDUCATION", label: "Educación" };
    }

    if (norm.includes("profesional") || norm.includes("cientifico") || norm.includes("tecnico") || norm.includes("consultoria") || norm.includes("despacho")) {
      return { code: "PROFESSIONAL_SERVICES", label: "Servicios Profesionales" };
    }

    if (norm.includes("comercio al por menor") || norm.includes("minorista") || norm.includes("tienda")) {
      return { code: "RETAIL", label: "Comercio Minorista" };
    }

    if (norm.includes("comercio al por mayor") || norm.includes("mayorista")) {
      return { code: "WHOLESALE", label: "Comercio Mayorista" };
    }

    if (norm.includes("transporte") || norm.includes("almacenamiento") || norm.includes("logistica")) {
      return { code: "TRANSPORT_LOGISTICS", label: "Logística" };
    }

    if (norm.includes("telecomunicacion") || norm.includes("television") || norm.includes("radio") || norm.includes("internet") || norm.includes("medios masivos")) {
      return { code: "TECHNOLOGY", label: "Medios y Telecomunicaciones" };
    }

    if (norm.includes("gobierno") || norm.includes("administracion publica")) {
      return { code: "GOVERNMENT", label: "Gobierno" };
    }

    if (norm.includes("financiero") || norm.includes("banco") || norm.includes("seguro") || norm.includes("fianza")) {
      return { code: "FINANCIAL_SERVICES", label: "Servicios Financieros" };
    }

    if (norm.includes("servicio")) {
      return { code: "GENERAL_SERVICES", label: "Servicios Generales" };
    }

    return null;
  };

  const fieldsToTest = [
    company.actividad,
    company.nombreActividad,
    company.descripcionActividad,
    company.claseActividad,
    company.sector
  ];

  for (const f of fieldsToTest) {
    if (f) {
      const match = checkTextMatch(f);
      if (match) return match;
    }
  }

  return { code: "OTHER", label: "Otros Sectores" };
}

function normalizeRowWithMap(rowArray: any[], map: HeaderMap): any {
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
  const rawEstado = getValue(map.estadoIdx);
  const estado = getNormalizedStateName(rawEstado);
  const sourceState = rawEstado || "No Especificado";
  const estadoNormalized = normalizeState(estado);
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

  const clee = getValue(map.cleeIdx);
  const rowStringFallback = String(rowArray).substring(0, 100);

  const id = generateDeterministicId(clee, razonSocial, nombreComercial, municipio, cp, scian, telefono, direccion, rowStringFallback);

  const advisor = generateCommercialAdvisorInfo(
    opportunityScore,
    tamano,
    sector,
    email,
    telefono,
    sitioWeb,
    actividad
  );

  const canonical = resolveCanonicalIndustry({ scian, actividad, sector });

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
    sourceState,
    estadoNormalized,
    commercialIndustryCode: canonical.code,
    commercialIndustryLabel: canonical.label,
  };
}

const STATE_MAP: Record<string, { code: string; inegiCode: string; label: string; normalized: string }> = {
  "aguascalientes": { code: "AGS", inegiCode: "01", label: "Aguascalientes", normalized: "aguascalientes" },
  "baja california": { code: "BC", inegiCode: "02", label: "Baja California", normalized: "baja california" },
  "baja california sur": { code: "BCS", inegiCode: "03", label: "Baja California Sur", normalized: "baja california sur" },
  "campeche": { code: "CAMP", inegiCode: "04", label: "Campeche", normalized: "campeche" },
  "coahuila": { code: "COAH", inegiCode: "05", label: "Coahuila", normalized: "coahuila" },
  "colima": { code: "COL", inegiCode: "06", label: "Colima", normalized: "colima" },
  "chiapas": { code: "CHIS", inegiCode: "07", label: "Chiapas", normalized: "chiapas" },
  "chihuahua": { code: "CHIH", inegiCode: "08", label: "Chihuahua", normalized: "chihuahua" },
  "ciudad de mexico": { code: "CDMX", inegiCode: "09", label: "Ciudad de México", normalized: "ciudad de mexico" },
  "distrito federal": { code: "CDMX", inegiCode: "09", label: "Ciudad de México", normalized: "ciudad de mexico" },
  "durango": { code: "DUR", inegiCode: "10", label: "Durango", normalized: "durango" },
  "guanajuato": { code: "GTO", inegiCode: "11", label: "Guanajuato", normalized: "guanajuato" },
  "guerrero": { code: "GRO", inegiCode: "12", label: "Guerrero", normalized: "guerrero" },
  "hidalgo": { code: "HGO", inegiCode: "13", label: "Hidalgo", normalized: "hidalgo" },
  "jalisco": { code: "JAL", inegiCode: "14", label: "Jalisco", normalized: "jalisco" },
  "estado de mexico": { code: "MEX", inegiCode: "15", label: "Estado de México", normalized: "estado de mexico" },
  "mexico": { code: "MEX", inegiCode: "15", label: "Estado de México", normalized: "estado de mexico" },
  "michoacan": { code: "MICH", inegiCode: "16", label: "Michoacán", normalized: "michoacan" },
  "morelos": { code: "MOR", inegiCode: "17", label: "Morelos", normalized: "morelos" },
  "nayarit": { code: "NAY", inegiCode: "18", label: "Nayarit", normalized: "nayarit" },
  "nuevo leon": { code: "NL", inegiCode: "19", label: "Nuevo León", normalized: "nuevo leon" },
  "oaxaca": { code: "OAX", inegiCode: "20", label: "Oaxaca", normalized: "oaxaca" },
  "puebla": { code: "PUE", inegiCode: "21", label: "Puebla", normalized: "puebla" },
  "queretaro": { code: "QRO", inegiCode: "22", label: "Querétaro", normalized: "queretaro" },
  "quintana roo": { code: "QR", inegiCode: "23", label: "Quintana Roo", normalized: "quintana roo" },
  "san luis potosi": { code: "SLP", inegiCode: "24", label: "San Luis Potosí", normalized: "san luis potosi" },
  "sinaloa": { code: "SIN", inegiCode: "25", label: "Sinaloa", normalized: "sinaloa" },
  "sonora": { code: "SON", inegiCode: "26", label: "Sonora", normalized: "sonora" },
  "tabasco": { code: "TAB", inegiCode: "27", label: "Tabasco", normalized: "tabasco" },
  "tamaulipas": { code: "TAM", inegiCode: "28", label: "Tamaulipas", normalized: "tamaulipas" },
  "tlaxcala": { code: "TLAX", inegiCode: "29", label: "Tlaxcala", normalized: "tlaxcala" },
  "veracruz": { code: "VER", inegiCode: "30", label: "Veracruz", normalized: "veracruz" },
  "yucatan": { code: "YUC", inegiCode: "31", label: "Yucatán", normalized: "yucatan" },
  "zacatecas": { code: "ZAC", inegiCode: "32", label: "Zacatecas", normalized: "zacatecas" }
};

async function updateStateMetadataAndList(stateName: string, totalRecords: number, jobId: string, fingerprint: string) {
  if (!stateName || stateName === "No Especificado") return;

  const datasetMetaRef = db.collection("market_dataset_metadata").doc(stateName);
  await datasetMetaRef.set({
    state: stateName,
    totalRecords,
    lastImportJobId: jobId,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    fingerprint: fingerprint || "",
  }, { merge: true });

  const companiesMetaRef = db.collection("market_companies_metadata").doc(stateName);
  await companiesMetaRef.set({
    state: stateName,
    totalRecords,
    lastImportJobId: jobId,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    fingerprint: fingerprint || "",
  }, { merge: true });

  const cleanState = stateName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const info = STATE_MAP[cleanState];
  if (info) {
    const platformMetaRef = db.collection("platform_market_state_metadata").doc(info.code);
    await platformMetaRef.set({
      stateCode: info.code,
      inegiCode: info.inegiCode,
      stateLabel: info.label,
      normalizedState: info.normalized,
      imported: true,
      companyCount: totalRecords,
      lastImportAt: admin.firestore.FieldValue.serverTimestamp(),
      lastImportJobId: jobId,
      schemaVersion: "1.0",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const statesRef = db.collection("market_companies_metadata").doc("states");
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(statesRef);
    let currentStates: string[] = ["Querétaro", "Nuevo León"];
    if (snap.exists) {
      const data = snap.data();
      if (data && Array.isArray(data.states)) {
        currentStates = data.states;
      }
    }
    if (!currentStates.includes(stateName)) {
      const merged = Array.from(new Set([...currentStates, stateName])).sort();
      transaction.set(statesRef, { states: merged });
    }
  });
}

// ----------------- Cloud Function Trigger -----------------
export const processMarketImportJob = onDocumentCreated(
  {
    document: "market_import_jobs/{jobId}",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    if (!data || data.status !== "queued") {
      return;
    }

    const jobId = event.params.jobId;
    console.log(`[processMarketImportJob] Iniciando procesamiento para el job: ${jobId}`);
    const startTime = Date.now();

    try {
      await snapshot.ref.update({
        status: "processing",
        currentStage: "Descargando archivo Excel desde Storage...",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const storagePath = data.storagePath;
      const bucket = admin.storage().bucket();
      const tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${data.filename}`);

      await bucket.file(storagePath).download({ destination: tempFilePath });

      await snapshot.ref.update({
        currentStage: "Analizando y mapeando archivo Excel...",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const workbook = XLSX.readFile(tempFilePath);
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

      let validationErrors: string[] = [];
      let missingRequiredFieldsCount = 0;
      let rowsRead = 0;
      let rowsAccepted = 0;
      let rowsRejected = 0;
      let idCollisions = 0;
      let trueDuplicates = 0;
      let documentsCreated = 0;
      let documentsUpdated = 0;

      const rows2D = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      rowsRead = rows2D.length;
      const { headerRowIndex, headerMap } = detectHeaderRowAndBuildMap(rows2D);
      const dataRows = rows2D.slice(headerRowIndex + 1);
      const totalRows = dataRows.length;

      await snapshot.ref.update({
        total: totalRows,
        currentStage: `Normalizando y cargando ${totalRows.toLocaleString()} prospectos...`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      let processed = 0;
      let added = 0;
      let overwritten = 0;
      let omitted = 0;
      let failed = 0;

      let unresolvedStateCount = 0;
      let resolvedStateCount = 0;
      const stateDistribution: Record<string, number> = {};
      const sectorDistribution: Record<string, number> = {};

      const nowStr = new Date().toISOString();
      const customState = (data.states && data.states.length > 0) ? data.states[0] : null;

      for (let i = 0; i < totalRows; i += 100) {
        const chunkRows = dataRows.slice(i, i + 100);
        const companies: any[] = [];

        for (const row of chunkRows) {
          if (!row || row.length === 0) continue;
          try {
            const companyRaw = normalizeRowWithMap(row, headerMap);
            const latitud = headerMap.latitudIdx !== -1 && headerMap.latitudIdx < row.length ? parseFloat(row[headerMap.latitudIdx]) || null : null;
            const longitud = headerMap.longitudIdx !== -1 && headerMap.longitudIdx < row.length ? parseFloat(row[headerMap.longitudIdx]) || null : null;
            const altaDenue = headerMap.altaDenueIdx !== -1 && headerMap.altaDenueIdx < row.length ? String(row[headerMap.altaDenueIdx] || "").trim() : "";
            const clee = headerMap.cleeIdx !== -1 && headerMap.cleeIdx < row.length ? String(row[headerMap.cleeIdx] || "").trim() : "";

            const razonSocial = companyRaw.razonSocial;
            const nombreComercial = companyRaw.nombreComercial;
            const municipio = companyRaw.municipio;
            const cp = companyRaw.cp;
            const scian = companyRaw.scian;
            const rawEmail = companyRaw.email;
            const rawTelefono = companyRaw.telefono;
            const direccion = companyRaw.direccion;

            const email = normalizeEmail(rawEmail);
            const telefono = normalizePhone(rawTelefono);
            const rowStringFallback = JSON.stringify(row);

            const company: any = {
              ...companyRaw,
              id: generateDeterministicId(clee, razonSocial, nombreComercial, municipio, cp, scian, telefono, direccion, rowStringFallback),
              estado: getNormalizedStateName(customState || companyRaw.estado, data.filename || ""),
              latitud,
              longitud,
              altaDenue,
              email,
              telefono,
            };

            if (company.estado === "No Especificado") {
              const munNorm = normalizeState(company.municipio || "");
              if (munNorm) {
                if (munNorm.includes("queretaro")) {
                  company.estado = "Querétaro";
                } else if (munNorm.includes("villahermosa") || munNorm === "centro" || munNorm.includes("centrotabasco") || munNorm.includes("cardenas") || munNorm.includes("comalcalco") || munNorm.includes("paraiso")) {
                  company.estado = "Tabasco";
                } else {
                  const munLower = munNorm.toLowerCase();
                  if (munLower.includes("monterrey") || munLower.includes("sannicolas") || munLower.includes("apodaca") || munLower.includes("guadalupe") || munLower.includes("santacatarina") || munLower.includes("sanpedro") || munLower.includes("garcia") || munLower.includes("escobedo") || munLower.includes("juarez") || munLower.includes("cadereyta")) {
                    company.estado = "Nuevo León";
                  } else if (munLower.includes("guadalajara") || munLower.includes("zapopan") || munLower.includes("tlaquepaque") || munLower.includes("tonala") || munLower.includes("tlajomulco")) {
                    company.estado = "Jalisco";
                  } else if (munLower.includes("miguelhidalgo") || munLower.includes("cuauhtemoc") || munLower.includes("benitojuarez") || munLower.includes("coyoacan")) {
                    company.estado = "Ciudad de México";
                  }
                }
              }
            }
            company.estadoNormalized = normalizeState(company.estado);
            if (!company.sourceState) {
              const excelStateVal = headerMap.estadoIdx !== -1 && headerMap.estadoIdx < row.length ? String(row[headerMap.estadoIdx] || "").trim() : "";
              company.sourceState = excelStateVal || "No Especificado";
            }
            company.importJobId = jobId;
            company.fingerprint = data.fingerprint || "";
            company.sourceFile = data.filename || "";

            const isUnresolved = !company.estado || company.estado === "No Especificado" || !company.estadoNormalized;
            if (isUnresolved) {
              unresolvedStateCount++;
            } else {
              resolvedStateCount++;
            }

            stateDistribution[company.estado] = (stateDistribution[company.estado] || 0) + 1;
            const sectorNorm = company.sector || "Otros Sectores";
            sectorDistribution[sectorNorm] = (sectorDistribution[sectorNorm] || 0) + 1;

            const missingFields = [];
            if (!company.estado) missingFields.push("estado");
            if (!company.estadoNormalized) missingFields.push("estadoNormalized");
            if (!company.sourceState) missingFields.push("sourceState");
            if (!company.sourceFile) missingFields.push("sourceFile");
            if (!company.importJobId) missingFields.push("importJobId");
            if (!company.fingerprint) missingFields.push("fingerprint");

            if (missingFields.length > 0 && validationErrors.length < 50) {
              missingRequiredFieldsCount++;
              validationErrors.push(`Fila le faltan campos: ${missingFields.join(", ")}`);
            }

            if (company.razonSocial || company.nombreComercial) {
              rowsAccepted++;
              companies.push(company);
            } else {
              rowsRejected++;
            }
          } catch (e) {
            rowsRejected++;
            failed++;
          }
        }

        if (companies.length > 0) {
          const idSet = new Set<string>();
          for (const c of companies) {
            if (idSet.has(c.id)) {
              idCollisions++;
            }
            idSet.add(c.id);
          }

          const uniqueCompanies = Array.from(new Map(companies.map(item => [item.id, item])).values());

          const docRefs = uniqueCompanies.map(c => db.collection("market_companies").doc(c.id));
          const snapshots = await db.getAll(...docRefs);
          const existingDocsMap = new Map<string, any>();

          snapshots.forEach(snap => {
            if (snap.exists) {
              existingDocsMap.set(snap.id, snap.data());
            }
          });

          const batch = db.batch();

          const cleanStrLocal = (str: string | null | undefined) =>
            (str || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]/g, "")
              .trim();

          for (const company of uniqueCompanies) {
            let finalCompany = company;
            let existing = existingDocsMap.get(company.id);
            let docRef = db.collection("market_companies").doc(company.id);

            if (existing) {
              const isTrueDuplicate =
                cleanStrLocal(existing.razonSocial) === cleanStrLocal(company.razonSocial) &&
                cleanStrLocal(existing.nombreComercial) === cleanStrLocal(company.nombreComercial) &&
                cleanStrLocal(existing.direccion) === cleanStrLocal(company.direccion) &&
                cleanStrLocal(existing.municipio) === cleanStrLocal(company.municipio);

              if (!isTrueDuplicate) {
                // Conflict! Regenerate with hash tie-breaker
                const hashId = generateDeterministicId(
                  company.clee,
                  company.razonSocial,
                  company.nombreComercial,
                  company.municipio,
                  company.cp,
                  company.scian,
                  company.telefono,
                  company.direccion,
                  "TIE_BREAKER:" + JSON.stringify(company)
                );
                finalCompany = { ...company, id: hashId };
                docRef = db.collection("market_companies").doc(hashId);
                existing = undefined; // Force write as new document since ID changed
              }
            }

            if (!existing) {
              batch.set(docRef, {
                ...finalCompany,
                firstImportedAt: nowStr,
                lastImportAt: nowStr,
                lastUpdatedAt: nowStr,
                importCount: 1,
                source: "INEGI",
                sourceVersion: "DENUE-2026",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              added++;
            } else {
              trueDuplicates++;
              const hasChanged =
                existing.razonSocial !== finalCompany.razonSocial ||
                existing.nombreComercial !== finalCompany.nombreComercial ||
                existing.sector !== finalCompany.sector ||
                existing.tamano !== finalCompany.tamano ||
                existing.rangoPersonal !== finalCompany.rangoPersonal ||
                existing.telefono !== finalCompany.telefono ||
                existing.email !== finalCompany.email ||
                existing.sitioWeb !== finalCompany.sitioWeb ||
                existing.direccion !== finalCompany.direccion ||
                existing.municipio !== finalCompany.municipio ||
                existing.estado !== finalCompany.estado ||
                existing.estadoNormalized !== finalCompany.estadoNormalized ||
                existing.sourceState !== finalCompany.sourceState ||
                existing.cp !== finalCompany.cp ||
                existing.scian !== finalCompany.scian ||
                existing.actividad !== finalCompany.actividad;

              if (!hasChanged) {
                omitted++;
              } else {
                batch.set(docRef, {
                  ...existing,
                  ...finalCompany,
                  lastImportAt: nowStr,
                  lastUpdatedAt: nowStr,
                  importCount: (existing.importCount || 1) + 1,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                overwritten++;
              }
            }
          }

          await batch.commit();
        }

        processed += chunkRows.length;

        await snapshot.ref.update({
          processed,
          added,
          overwritten,
          omitted,
          failed,
          progress: Math.round((processed / totalRows) * 100),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.warn("No se pudo eliminar el archivo temporal:", e);
      }

      await db.collection("market_imports_history").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        filename: data.filename,
        totalProcessed: totalRows,
        newAdded: added,
        updated: overwritten,
        omitted: omitted,
        failed: failed,
        timeMs: Date.now() - startTime,
        source: "INEGI",
        sourceVersion: "DENUE-2026",
        fingerprint: data.fingerprint || "",
        user: data.createdBy || "",
      });

      const unresolvedPercentage = totalRows > 0 ? (unresolvedStateCount / totalRows) * 100 : 0;
      const validationStatus = unresolvedPercentage > 1.0 ? "needs_review" : "valid";

      if (validationStatus === "needs_review") {
        validationErrors.push(`Más del 1% del dataset (${unresolvedPercentage.toFixed(2)}%) tiene estado vacío o No Especificado.`);
      }

      if (validationStatus === "valid") {
        const targetState = (data.states && data.states.length > 0) ? data.states[0] : null;
        if (targetState && targetState !== "No Especificado") {
          await updateStateMetadataAndList(targetState, totalRows, jobId, data.fingerprint || "");
        }
      }

      await snapshot.ref.update({
        status: validationStatus === "valid" ? "completed" : "needs_review",
        currentStage: validationStatus === "valid" ? "completed" : "needs_review",
        validationStatus,
        validationErrors,
        unresolvedStateCount,
        resolvedStateCount,
        stateDistribution,
        sectorDistribution,
        total: totalRows,
        processed,
        added,
        overwritten,
        omitted,
        failed,
        metrics: {
          rowsRead,
          rowsAccepted,
          rowsRejected,
          idCollisions,
          trueDuplicates,
          documentsCreated,
          documentsUpdated,
          missingRequiredFieldsCount
        },
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (err: any) {
      console.error("Error al procesar el job en el backend:", err);
      await snapshot.ref.update({
        status: "failed",
        currentStage: "failed",
        errorMessage: err.message || "Error desconocido en el servidor de importación masiva.",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
export * from './intelligence/evaluateConversation';
export { evaluateConversation } from "./intelligence/evaluateConversation";
// --- Discovery ---
export { createDiscoveryLead } from "./discovery/createDiscoveryLead";
export { completeDiscoverySession } from "./discovery/completeDiscoverySession";
export { resolveDiscoverySession } from "./discovery/resolveDiscoverySession";
export { exchangeDiscoveryToken } from "./discovery/exchangeDiscoveryToken";
export { generateDiscoveryReport } from "./discovery/reports/generateDiscoveryReport";
export { requestExecutiveDocument } from "./discovery/reports/requestExecutiveDocument";

// --- Sales Advisors ---
export { createSalesAdvisorUser } from "./advisors/createSalesAdvisorUser";
export { provisionCommercialAdvisor } from "./advisors/provisionCommercialAdvisor";
export { resolveAdvisorByCode } from "./advisors/resolveAdvisorByCode";
export { manageAdvisorAccess } from "./advisors/manageAdvisorAccess";

// --- Prospects ---
export { processProspectLifecycle } from "./prospects/processProspectLifecycle";
export { updateProspectCommercialStage } from "./prospects/updateProspectCommercialStage";
export { replenishAdvisorPipeline } from "./prospects/replenishAdvisorPipeline";
export { discardPipelineProspect } from "./prospects/discardPipelineProspect";
export { reactivatePipelineProspect } from "./prospects/reactivatePipelineProspect";
export { emitDiscoveryCompletedNotification } from "./notifications/emitDiscoveryCompletedNotification";
export { markNotificationAsRead } from "./notifications/markNotificationAsRead";