/**
 * Aura Industry Resolver Engine
 * Centraliza la traducción de sectores oficiales del SCIAN (INEGI) a categorías comerciales de la UI.
 */

export interface IndustryMapping {
  commercial: string;      // Nombre comercial expuesto en la UI
  scianKeywords: string[];  // Palabras clave oficiales del SCIAN que activan esta categoría
}

export const INDUSTRY_MAPPINGS: IndustryMapping[] = [
  {
    commercial: "Hoteles y Hospedaje",
    scianKeywords: ["alojamiento temporal", "hoteles", "moteles", "hospedaje"],
  },
  {
    commercial: "Restaurantes y Alimentos",
    scianKeywords: ["preparacion de alimentos", "preparacion de bebidas", "bebidas y alimentos", "restaurantes", "cafeterias", "bares"],
  },
  {
    commercial: "Hospitales",
    scianKeywords: ["servicios de salud", "hospital", "clinica", "medicos", "consultorios", "salud y asistencia"],
  },
  {
    commercial: "Manufactura",
    scianKeywords: ["industrias manufactureras", "manufactura", "fabrica", "produccion", "maquiladora"],
  },
  {
    commercial: "Comercio Mayorista",
    scianKeywords: ["comercio al por mayor", "comercio mayorista", "mayorista"],
  },
  {
    commercial: "Comercio Minorista",
    scianKeywords: ["comercio al por menor", "comercio minorista", "minorista", "tienda", "comercio detallista"],
  },
  {
    commercial: "Construcción",
    scianKeywords: ["construccion", "edificacion", "obra civil"],
  },
  {
    commercial: "Educación",
    scianKeywords: ["servicios educativos", "educacion", "escuela", "colegio", "universidad", "docencia"],
  },
  {
    commercial: "Logística",
    scianKeywords: ["transportes y almacenamiento", "logistica", "transporte", "almacenamiento", "mudanzas"],
  },
  {
    commercial: "Gobierno",
    scianKeywords: ["administracion publica", "gobierno", "seguridad nacional", "legislativo", "judicial"],
  },
  {
    commercial: "Servicios Financieros",
    scianKeywords: ["servicios financieros", "servicios corporativos", "seguros", "bancos", "fianzas", "financiero"],
  },
  {
    commercial: "Medios y Telecomunicaciones",
    scianKeywords: ["informacion en medios", "medios masivos", "telecomunicaciones", "television", "radio", "periodico", "internet"],
  },
  {
    commercial: "Servicios Profesionales",
    scianKeywords: ["servicios profesionales", "cientificos y tecnicos", "servicios cientificos", "servicios tecnicos", "consultoria", "despacho"],
  }
];

/**
 * Normaliza un string removiendo acentos, minúsculas y caracteres especiales.
 */
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Traduce un sector del SCIAN a su categoría comercial normalizada.
 * Si no se encuentra coincidencia, retorna una versión limpia/capitalizada del sector original.
 */
export function resolveCommercialIndustry(scianSector: string): string {
  if (!scianSector) return "Otros Sectores";

  // Si el valor ingresado contiene un código numérico SCIAN, resolver por prefijo
  const codeMatch = scianSector.trim().match(/^\d+/);
  if (codeMatch) {
    const code = codeMatch[0];
    if (code.startsWith("721")) return "Hoteles y Hospedaje";
    if (code.startsWith("722")) return "Restaurantes y Alimentos";
    if (code.startsWith("72")) return "Restaurantes y Alimentos"; // Genérico 72
    if (code.startsWith("62")) return "Hospitales";
    if (code.startsWith("31") || code.startsWith("32") || code.startsWith("33")) return "Manufactura";
    if (code.startsWith("43")) return "Comercio Mayorista";
    if (code.startsWith("46")) return "Comercio Minorista";
    if (code.startsWith("23")) return "Construcción";
    if (code.startsWith("61")) return "Educación";
    if (code.startsWith("48") || code.startsWith("49")) return "Logística";
    if (code.startsWith("93")) return "Gobierno";
    if (code.startsWith("52") || code.startsWith("55")) return "Servicios Financieros";
    if (code.startsWith("51")) return "Medios y Telecomunicaciones";
    if (code.startsWith("54")) return "Servicios Profesionales";
  }
  
  const normSector = normalizeText(scianSector);
  
  // Buscar en el diccionario
  for (const mapping of INDUSTRY_MAPPINGS) {
    for (const keyword of mapping.scianKeywords) {
      const normKeyword = normalizeText(keyword);
      if (normSector.includes(normKeyword) || normKeyword.includes(normSector)) {
        return mapping.commercial;
      }
    }
  }
  
  // Si no hay mapeo específico, retornar un valor por defecto o la descripción simplificada
  if (normSector.includes("servicio")) {
    return "Servicios Generales";
  }
  
  // Capitalizar primer caracter
  const clean = scianSector.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/**
 * Retorna todos los sectores comerciales únicos para listados o dropdowns de filtros.
 */
export function getCommercialSectorsDropdown(): { label: string; value: string }[] {
  const list = INDUSTRY_MAPPINGS.map(m => ({ label: m.commercial, value: m.commercial }));
  return [
    { label: "Todos los sectores", value: "" },
    ...list,
    { label: "Servicios Generales", value: "Servicios Generales" },
    { label: "Otros Sectores", value: "Otros Sectores" }
  ];
}

const industryResolverService = {
  resolveCommercialIndustry,
  getCommercialSectorsDropdown,
  INDUSTRY_MAPPINGS
};

export default industryResolverService;
