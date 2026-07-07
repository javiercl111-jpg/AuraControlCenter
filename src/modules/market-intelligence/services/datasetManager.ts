import type { InegiCompany } from "../types/inegi";
import { generateAuraSalesAdvice } from "./auraSalesAdvisorService";
import { resolveCommercialIndustry } from "./industryResolverService";

export interface DatasetMetadata {
  stateName: string;
  count: number;
  loadedAt: string; // ISO String
  sourceVersion: string;
  source: string;
  industryDistribution: Record<string, number>;
  estimatedMrr: number;
  highPriorityCount: number;
  topIndustries: { industry: string; count: number }[];
}

export interface DatasetCacheEntry {
  companies: InegiCompany[];
  metadata: DatasetMetadata;
}

// Mapa de caché para almacenar los conjuntos de datos en memoria por estado.
// La clave "" (string vacío) representa el dataset de límite seguro (global).
const datasetCache = new Map<string, DatasetCacheEntry>();

/**
 * Genera metadatos y analíticas consolidadas para un conjunto de datos.
 */
export function generateMetadata(
  stateName: string,
  companies: InegiCompany[]
): DatasetMetadata {
  const industryDistribution: Record<string, number> = {};
  let estimatedMrr = 0;
  let highPriorityCount = 0;

  companies.forEach((company) => {
    // Clasificar industria
    const resolvedIndustry = resolveCommercialIndustry(company.sector) || "Otros Sectores";
    industryDistribution[resolvedIndustry] = (industryDistribution[resolvedIndustry] || 0) + 1;

    // Calcular analítica de ventas del asesor
    const advice = generateAuraSalesAdvice(company);
    estimatedMrr += advice.estimatedMrr;
    if (advice.priorityLabel === "CRITICAL" || advice.priorityLabel === "HIGH") {
      highPriorityCount++;
    }
  });

  // Obtener las industrias top ordenadas por volumen
  const topIndustries = Object.entries(industryDistribution)
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    stateName: stateName || "Todos los Estados (Muestra)",
    count: companies.length,
    loadedAt: new Date().toISOString(),
    sourceVersion: "DENUE-2026",
    source: "INEGI",
    industryDistribution,
    estimatedMrr,
    highPriorityCount,
    topIndustries,
  };
}

/**
 * Recupera un dataset del caché.
 */
export function getDataset(stateName: string): DatasetCacheEntry | undefined {
  const key = stateName || "";
  return datasetCache.get(key);
}

/**
 * Almacena un dataset en caché y genera sus metadatos automáticamente.
 */
export function setDataset(stateName: string, companies: InegiCompany[]): DatasetCacheEntry {
  const key = stateName || "";
  const metadata = generateMetadata(stateName, companies);
  const entry: DatasetCacheEntry = { companies, metadata };
  datasetCache.set(key, entry);
  return entry;
}

/**
 * Comprueba si un dataset está en caché.
 */
export function hasDataset(stateName: string): boolean {
  const key = stateName || "";
  return datasetCache.has(key);
}

/**
 * Limpia todo el caché.
 */
export function clear(): void {
  datasetCache.clear();
}

/**
 * Invalida (elimina) un estado específico del caché y la muestra global.
 */
export function invalidateDataset(stateName: string): void {
  const key = stateName || "";
  datasetCache.delete(key);
  datasetCache.delete(""); // Invalida también la muestra global
}

const datasetManager = {
  getDataset,
  setDataset,
  hasDataset,
  clear,
  invalidateDataset,
  generateMetadata,
};

export default datasetManager;
