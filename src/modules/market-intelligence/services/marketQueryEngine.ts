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

  const result = companies.filter((company) => {
    // 1. Filtro de Estado
    if (!isEmptyFilter(filters.estado)) {
      const isFilterNoEspecificado = normalizeState(filters.estado!) === "noespecificado";
      const docState = company.estado || "";
      const isDocNoEspecificado = !docState || docState.trim() === "" || normalizeState(docState) === "noespecificado";

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
      const normDoc = normalizeString(company.sector || "");
      const normFilter = normalizeString(filters.sector!);
      if (normDoc !== normFilter) return false;
    }

    // 4. Filtro de Tamaño
    if (!isEmptyFilter(filters.tamano)) {
      const normDoc = normalizeString(company.tamano || "");
      const normFilter = normalizeString(filters.tamano!);
      if (normDoc !== normFilter) return false;
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
