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

export interface CanonicalIndustry {
  code: string;
  label: string;
}

/**
 * Resuelve de forma robusta la clasificación comercial canónica (código y etiqueta)
 * siguiendo un orden estricto de especificidad: SCIAN 6 dígitos -> SCIAN clase -> Actividad -> Sector.
 */
export function resolveCanonicalIndustry(company: {
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
    const norm = normalizeText(text);
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

/**
 * Resuelve de forma robusta la clasificación comercial canónica validando contra el catálogo permitido.
 * Si el código es inválido o falta su etiqueta, recalcula mediante resolveCanonicalIndustry.
 */
export function getCanonicalCommercialIndustry(company: {
  commercialIndustryCode?: string | null;
  commercialIndustryLabel?: string | null;
  scian?: string | null;
  actividad?: string | null;
  nombreActividad?: string | null;
  descripcionActividad?: string | null;
  claseActividad?: string | null;
  sector?: string | null;
}): CanonicalIndustry {
  const code = company.commercialIndustryCode;
  const label = company.commercialIndustryLabel;
  const allowed = new Set([
    "HOTELS_LODGING",
    "RESTAURANTS_FOOD",
    "MANUFACTURING",
    "CONSTRUCTION",
    "HEALTHCARE",
    "EDUCATION",
    "PROFESSIONAL_SERVICES",
    "RETAIL",
    "WHOLESALE",
    "TRANSPORT_LOGISTICS",
    "TECHNOLOGY",
    "GOVERNMENT",
    "FINANCIAL_SERVICES",
    "GENERAL_SERVICES",
    "OTHER"
  ]);

  if (code && allowed.has(code) && label) {
    return { code, label };
  }
  return resolveCanonicalIndustry(company);
}

/**
 * Traduce un sector del SCIAN a su categoría comercial normalizada.
 * Si no se encuentra coincidencia, retorna una versión limpia/capitalizada del sector original.
 * Conserva compatibilidad con firmas antiguas.
 */
export function resolveCommercialIndustry(scianSector: string): string {
  if (!scianSector) return "Otros Sectores";
  const canonical = getCanonicalCommercialIndustry({ sector: scianSector });
  if (canonical.code === "OTHER") {
    const clean = scianSector.trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }
  return canonical.label;
}

/**
 * Retorna todos los sectores comerciales únicos con sus valores canónicos (códigos) para filtros dropdown.
 */
export function getCommercialSectorsDropdown(): { label: string; value: string }[] {
  return [
    { label: "Todos los sectores", value: "" },
    { label: "Hoteles y Hospedaje", value: "HOTELS_LODGING" },
    { label: "Restaurantes y Alimentos", value: "RESTAURANTS_FOOD" },
    { label: "Manufactura", value: "MANUFACTURING" },
    { label: "Construcción", value: "CONSTRUCTION" },
    { label: "Hospitales", value: "HEALTHCARE" },
    { label: "Educación", value: "EDUCATION" },
    { label: "Servicios Profesionales", value: "PROFESSIONAL_SERVICES" },
    { label: "Comercio Minorista", value: "RETAIL" },
    { label: "Comercio Mayorista", value: "WHOLESALE" },
    { label: "Logística", value: "TRANSPORT_LOGISTICS" },
    { label: "Medios y Telecomunicaciones", value: "TECHNOLOGY" },
    { label: "Gobierno", value: "GOVERNMENT" },
    { label: "Servicios Financieros", value: "FINANCIAL_SERVICES" },
    { label: "Servicios Generales", value: "GENERAL_SERVICES" },
    { label: "Otros Sectores", value: "OTHER" }
  ];
}

const industryResolverService = {
  resolveCanonicalIndustry,
  resolveCommercialIndustry,
  getCommercialSectorsDropdown,
  getCanonicalCommercialIndustry,
  INDUSTRY_MAPPINGS
};

export default industryResolverService;
