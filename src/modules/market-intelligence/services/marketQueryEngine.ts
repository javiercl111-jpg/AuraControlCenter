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
 * Filtra un conjunto de prospectos del mercado de forma acumulativa y normalizada.
 * Este motor de consultas es agnóstico y reutilizable por CRM, Sales OS, etc.
 */
export function filterMarketCompanies(
  companies: InegiCompany[],
  filters: QueryFilters
): InegiCompany[] {
  console.log(`[MarketQueryEngine] Procesando ${companies.length} registros en el pipeline...`);

  const result = companies.filter((company) => {
    // 1. Filtro de Estado
    if (filters.estado) {
      const normDoc = normalizeString(company.estado || "");
      const normFilter = normalizeString(filters.estado);
      if (normDoc !== normFilter) return false;
    }

    // 2. Filtro de Estatus Comercial
    if (filters.status) {
      const normDoc = normalizeString(company.status || "");
      const normFilter = normalizeString(filters.status);
      if (normDoc !== normFilter) return false;
    }

    // 3. Filtro de Sector
    if (filters.sector) {
      const normDoc = normalizeString(company.sector || "");
      const normFilter = normalizeString(filters.sector);
      if (normDoc !== normFilter) return false;
    }

    // 4. Filtro de Tamaño
    if (filters.tamano) {
      const normDoc = normalizeString(company.tamano || "");
      const normFilter = normalizeString(filters.tamano);
      if (normDoc !== normFilter) return false;
    }

    // 5. Filtro de Municipio
    if (filters.municipio) {
      const normDoc = normalizeString(company.municipio || "");
      const normFilter = normalizeString(filters.municipio);
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

    return true;
  });

  console.log(`[MarketQueryEngine] Pipeline completado. ${result.length} registros aprobados.`);
  return result;
}

const MarketQueryEngine = {
  normalizeString,
  filterMarketCompanies,
};

export default MarketQueryEngine;
