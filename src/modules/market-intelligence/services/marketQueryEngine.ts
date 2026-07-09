import type { InegiCompany } from "../types/inegi";

export interface QueryFilters {
  estado?: string;
  status?: string;
  tamano?: string;
  sector?: string;
  municipio?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebsite?: boolean;
  minScore?: number;
  search?: string;
  scian?: string;
  sortBy?: string;
}

/**
 * Normaliza un nombre de estado para comparaciones estrictas (remueve acentos, espacios, guiones y mayúsculas).
 */
export function normalizeState(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[^a-z0-9]/g, ""); // Eliminar espacios, guiones y números
}

/**
 * Resuelve de forma robusta el estado de una compañía a partir de múltiples posibles propiedades.
 * Realiza inferencia por municipio si el campo de estado está vacío.
 */
export function getNormalizedStateName(stateVal: string, filename?: string): string {
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

export function getCompanyState(company: any): string {
  if (!company) return "";
  
  // 1. Intentar resolver por propiedades directas en orden
  const val = (
    company.estado ||
    company.state ||
    company.entidad ||
    company.entidadFederativa ||
    company.nomEnt ||
    ""
  ).trim();

  const normalized = getNormalizedStateName(val);
  if (normalized && normalized !== "No Especificado") {
    return normalized;
  }

  // 2. Inferir por municipio si está vacío
  const munNorm = normalizeState(company.municipio || "");
  if (munNorm) {
    if (munNorm.includes("queretaro")) {
      return "Querétaro";
    }
    if (munNorm.includes("villahermosa") || munNorm === "centro" || munNorm.includes("centrotabasco") || munNorm.includes("cardenas") || munNorm.includes("comalcalco") || munNorm.includes("paraiso")) {
      return "Tabasco";
    }
    const nlMunicipios = [
      "monterrey",
      "sannicolas",
      "apodaca",
      "guadalupe",
      "santacatarina",
      "sanpedrogarza",
      "sanpedrogarcia",
      "garcia",
      "escobedo"
    ];
    if (nlMunicipios.some(m => munNorm.includes(m))) {
      return "Nuevo León";
    }
  }

  return "No Especificado";
}

/**
 * Normaliza un string para comparaciones tolerantes a acentos, mayúsculas y espacios.
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .trim();
}

/**
 * Verifica si un valor de filtro representa la ausencia de filtrado.
 * Normaliza cadenas visuales genéricas como "Todos", "ALL", "Todos los estados", etc.
 */
export function isEmptyFilter(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string") {
    const clean = val.trim().toLowerCase();
    return (
      clean === "" ||
      clean === "all" ||
      clean === "todos" ||
      clean === "todos los estados" ||
      clean === "todos los sectores" ||
      clean === "todos los tamaños" ||
      clean === "todos los estatus" ||
      clean === "todos los tamanos"
    );
  }
  return false;
}

/**
 * Categoriza de forma flexible los tamaños de las unidades económicas.
 */
export function getNormalizedSizeCategory(tamano: string): string {
  const clean = (tamano || "").toLowerCase();
  if (clean.includes("grande") || clean.includes("251") || clean.includes("101")) {
    return "grande";
  }
  if (clean.includes("mediana") || clean.includes("51") || clean.includes("31")) {
    return "mediana";
  }
  if (clean.includes("pequeña") || clean.includes("pequena") || clean.includes("11")) {
    return "pequeña";
  }
  return "micro";
}

import { resolveCommercialIndustry } from "./industryResolverService";

/**
 * Resuelve de forma robusta la descripción de industria de una compañía
 * y la traduce a su sector comercial normalizado.
 */
export function getCompanyIndustry(company: any): string {
  if (!company) return "";
  const rawVal = (
    company.sector ||
    company.actividad ||
    company.nombreActividad ||
    company.descripcionActividad ||
    company.scianDescription ||
    company.claseActividad ||
    company.scian ||
    ""
  ).trim();
  return resolveCommercialIndustry(rawVal);
}

/**
 * Realiza una comparación flexible e inteligente de sectores económicos.
 */
export function matchesSector(company: any, filterSector: string): boolean {
  const docCommercial = getCompanyIndustry(company);
  return normalizeString(docCommercial) === normalizeString(filterSector);
}

/**
 * Filtra un conjunto de prospectos del mercado de forma acumulativa y normalizada.
 * Este motor de consultas es agnóstico y reutilizable por CRM, Sales OS, etc.
 */
export function filterMarketCompanies(
  companies: InegiCompany[],
  filters: QueryFilters
): InegiCompany[] {
  console.log("=== MarketQueryEngine Audit Logs ===");
  console.log("- Filters antes de aplicar:", filters);
  console.log("- Selected estado raw:", filters.estado);
  console.log("- Selected estado normalized:", filters.estado ? normalizeState(filters.estado) : "ninguno");
  console.log("- Total antes de filtro:", companies.length);

  // Auditoría temporal de los primeros 20 registros
  const debugSlice = companies.slice(0, 20);
  const auditLogs = debugSlice.map((company) => {
    const docState = getCompanyState(company);
    const normDoc = normalizeState(docState);
    const normFilter = filters.estado ? normalizeState(filters.estado) : "";
    const isFilterNoEspecificado = normFilter === "noespecificado";
    const isDocNoEspecificado = docState === "No Especificado" || normDoc === "noespecificado";

    let matchState = true;
    let exclusionReason = "Aprobado";

    if (!isEmptyFilter(filters.estado)) {
      if (isFilterNoEspecificado) {
        matchState = isDocNoEspecificado;
        if (!matchState) exclusionReason = "Excluido por filtro No Especificado";
      } else {
        matchState = normDoc === normFilter;
        if (!matchState) exclusionReason = `Excluido por discrepancia de Estado ("${normDoc}" !== "${normFilter}")`;
      }
    }

    if (matchState) {
      if (!isEmptyFilter(filters.status) && normalizeString(company.status || "") !== normalizeString(filters.status!)) {
        exclusionReason = "Excluido por Estatus";
      } else if (!isEmptyFilter(filters.sector) && !matchesSector(company, filters.sector!)) {
        exclusionReason = "Excluido por Sector";
      } else if (!isEmptyFilter(filters.tamano) && getNormalizedSizeCategory(company.tamano || "") !== getNormalizedSizeCategory(filters.tamano!)) {
        exclusionReason = "Excluido por Tamaño";
      }
    }

    return {
      companyName: company.nombreComercial || company.razonSocial || "Sin Nombre",
      "estado raw": company.estado || (company as any).state || (company as any).entidad || "(ninguno)",
      "estado resolved": docState,
      "estado normalized": normDoc,
      municipio: company.municipio || "(ninguno)",
      "filters.estado raw": filters.estado || "(vacío)",
      "filters.estado normalized": normFilter || "(vacío)",
      "matchState": matchState,
      "razón de exclusión": exclusionReason
    };
  });
  console.log("=== AUDITORÍA TEMPORAL DE FILTRO DE ESTADO (Primeros 20) ===");
  console.table(auditLogs);

  // Auditoría de Sector para los primeros 50 registros
  const debugSectorSlice = companies.slice(0, 50);
  const sectorAuditLogs = debugSectorSlice.map((company) => {
    const rawSec = company.sector || "";
    const rawAct = company.actividad || "";
    const rawSci = company.scian || "";
    const resolvedSec = resolveCommercialIndustry(rawSec);
    const resolvedAct = resolveCommercialIndustry(rawAct);
    const resolvedComp = getCompanyIndustry(company);

    const normFilter = filters.sector ? normalizeString(filters.sector) : "";
    const matchSector = isEmptyFilter(filters.sector) || normalizeString(resolvedComp) === normFilter;

    let exclusionReason = "Aprobado";
    if (!matchSector) {
      exclusionReason = `Excluido por discrepancia de Sector (resolved: "${resolvedComp}" !== filter: "${filters.sector || ""}")`;
    }

    return {
      companyName: company.nombreComercial || company.razonSocial || "Sin Nombre",
      "sector raw": rawSec,
      "actividad raw": rawAct,
      "scian raw": rawSci,
      "resolved sector": resolvedSec,
      "resolved actividad": resolvedAct,
      "getCompanyIndustry()": resolvedComp,
      "filter.sector raw": filters.sector || "(vacío)",
      "filter.sector normalized": normFilter || "(vacío)",
      "matchSector": matchSector,
      "razón de exclusión": exclusionReason
    };
  });
  console.log("=== AUDITORÍA TEMPORAL DE FILTRO DE SECTOR (Primeros 50) ===");
  console.table(sectorAuditLogs);

  const result = companies.filter((company) => {
    // 1. Filtro de Estado
    if (!isEmptyFilter(filters.estado)) {
      const docState = getCompanyState(company);
      const isFilterNoEspecificado = normalizeState(filters.estado!) === "noespecificado";
      const isDocNoEspecificado = docState === "No Especificado" || normalizeState(docState) === "noespecificado";

      if (isFilterNoEspecificado) {
        if (!isDocNoEspecificado) return false;
      } else {
        const normDoc = normalizeState(docState);
        const normFilter = normalizeState(filters.estado!);
        if (normDoc !== normFilter) return false;
      }
    }

    // 2. Filtro de Estatus Comercial
    if (!isEmptyFilter(filters.status)) {
      const normDoc = normalizeString(company.status || "");
      const normFilter = normalizeString(filters.status!);
      if (normDoc !== normFilter) return false;
    }

    // 3. Filtro de Sector
    if (!isEmptyFilter(filters.sector)) {
      if (!matchesSector(company, filters.sector!)) return false;
    }

    // 4. Filtro de Tamaño
    if (!isEmptyFilter(filters.tamano)) {
      const docCategory = getNormalizedSizeCategory(company.tamano || "");
      const filterCategory = getNormalizedSizeCategory(filters.tamano!);
      if (docCategory !== filterCategory) return false;
    }

    // 5. Filtro de Municipio
    if (!isEmptyFilter(filters.municipio)) {
      const normDoc = normalizeString(company.municipio || "");
      const normFilter = normalizeString(filters.municipio!);
      if (normDoc !== normFilter) return false;
    }

    // 6. Filtro de Disponibilidad de Email (Si es true, excluir vacíos)
    if (filters.hasEmail && !company.email) {
      return false;
    }

    // 7. Filtro de Disponibilidad de Teléfono (Si es true, excluir vacíos)
    if (filters.hasPhone && !company.telefono) {
      return false;
    }

    // 8. Filtro de Disponibilidad de Sitio Web (Si es true, excluir vacíos)
    if (filters.hasWebsite) {
      const cleanWeb = (company.sitioWeb || "").toLowerCase();
      const hasWeb =
        cleanWeb &&
        cleanWeb !== "no disponible" &&
        cleanWeb !== "n/a" &&
        cleanWeb !== "no aplica";
      if (!hasWeb) return false;
    }

    // 9. Filtro de Score Mínimo (Oportunidad)
    if (filters.minScore !== undefined && filters.minScore > 0) {
      if (company.opportunityScore < filters.minScore) return false;
    }

    // 10. Filtro de Búsqueda Textual
    if (filters.search) {
      const searchNorm = normalizeString(filters.search);
      const nameNorm = normalizeString(company.nombreComercial || "");
      const razonNorm = normalizeString(company.razonSocial || "");
      const actividadNorm = normalizeString(company.actividad || "");
      
      const match =
        nameNorm.includes(searchNorm) ||
        razonNorm.includes(searchNorm) ||
        actividadNorm.includes(searchNorm);
      if (!match) return false;
    }

    // 11. Filtro de Clase SCIAN (Coincidencia parcial)
    if (filters.scian) {
      const docScian = (company.scian || "").trim();
      const filterScian = filters.scian.trim();
      if (!docScian.startsWith(filterScian) && !docScian.includes(filterScian)) {
        return false;
      }
    }

    return true;
  });

  console.log("- Total después de filtro:", result.length);
  if (result.length === 0 && companies.length > 0) {
    console.log("- Razón de 0 resultados: Ningún registro en base local coincide con los filtros aplicados.");
  }
  return result;
}

/**
 * Ordena un listado de prospectos de mercado según el criterio seleccionado.
 */
export function sortMarketCompanies(
  companies: InegiCompany[],
  sortBy: string
): InegiCompany[] {
  const sorted = [...companies];
  return sorted.sort((a, b) => {
    switch (sortBy) {
      case "scoreDesc":
        return b.opportunityScore - a.opportunityScore;
      case "scoreAsc":
        return a.opportunityScore - b.opportunityScore;
      case "nameAsc":
        return (a.nombreComercial || a.razonSocial || "").localeCompare(
          b.nombreComercial || b.razonSocial || ""
        );
      case "nameDesc":
        return (b.nombreComercial || b.razonSocial || "").localeCompare(
          a.nombreComercial || a.razonSocial || ""
        );
      case "dateDesc": {
        const timeA = new Date(a.createdAt as string).getTime();
        const timeB = new Date(b.createdAt as string).getTime();
        return timeB - timeA;
      }
      default:
        return b.opportunityScore - a.opportunityScore;
    }
  });
}

const MarketQueryEngine = {
  normalizeString,
  normalizeState,
  filterMarketCompanies,
  sortMarketCompanies,
};

export default MarketQueryEngine;
