import { useEffect, useState } from "react";
import { FilterX, Search, SlidersHorizontal } from "lucide-react";
import type { CompanyStatus } from "../types/inegi";

interface FiltersState {
  estado: string;
  status: string;
  tamano: string;
  sector: string;
  municipio: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  minScore: number;
  search: string;
  scian: string;
  sortBy: string;
}

interface MarketCompaniesFiltersProps {
  filters: FiltersState;
  onFilterChange: (newFilters: FiltersState) => void;
  onClearFilters: () => void;
  availableStates: string[];
  sectorCounts: Record<string, number>;
}

import { getCommercialSectorsDropdown } from "../services/industryResolverService";

const SECTORS = getCommercialSectorsDropdown();

const SIZES = [
  { label: "Todos los tamaños", value: "" },
  { label: "Micro", value: "Micro" },
  { label: "Pequeña", value: "Pequeña" },
  { label: "Mediana", value: "Mediana" },
  { label: "Grande", value: "Grande" },
];

const STATUSES: { label: string; value: CompanyStatus | "" }[] = [
  { label: "Todos los estatus", value: "" },
  { label: "Nuevo (NEW)", value: "NEW" },
  { label: "Calificado (QUALIFIED)", value: "QUALIFIED" },
  { label: "Contactado (CONTACTED)", value: "CONTACTED" },
  { label: "Convertido (CONVERTED)", value: "CONVERTED" },
  { label: "Descartado (DISCARDED)", value: "DISCARDED" },
];

const SORT_OPTIONS = [
  { label: "Score (Mayor a menor)", value: "scoreDesc" },
  { label: "Score (Menor a mayor)", value: "scoreAsc" },
  { label: "Nombre (A-Z)", value: "nameAsc" },
  { label: "Nombre (Z-A)", value: "nameDesc" },
  { label: "Fecha de alta (Recientes)", value: "dateDesc" },
];

export default function MarketCompaniesFilters({
  filters,
  onFilterChange,
  onClearFilters,
  availableStates,
  sectorCounts,
}: MarketCompaniesFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search || "");

  // Sincronizar búsqueda local si cambia desde el exterior
  useEffect(() => {
    setLocalSearch(filters.search || "");
  }, [filters.search]);

  // Aplicar debounce de 300ms al valor de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== (filters.search || "")) {
        onFilterChange({
          ...filters,
          search: localSearch,
        });
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch]);

  function handleChange(field: keyof FiltersState, value: any) {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
      <div className="mb-6 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-cyan-200">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros de Segmentación
        </h4>
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-300"
        >
          <FilterX className="h-3 w-3" />
          Limpiar filtros
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {/* Búsqueda por Texto */}
        <div className="relative">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Buscar Razón Social / Actividad
          </label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Ej. Bimbo o Panificación..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Estado (Piloto)
          </label>
          <select
            value={filters.estado}
            onChange={(e) => handleChange("estado", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
          >
            <option value="">Todos los estados</option>
            {availableStates
              .filter((st) => st && st.trim() !== "" && st !== "No Especificado")
              .map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            {availableStates.some((st) => !st || st.trim() === "" || st === "No Especificado") && (
              <option value="No Especificado">No Especificado</option>
            )}
          </select>
        </div>

        {/* Estatus */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Estatus Comercial
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleChange("status", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
          >
            {STATUSES.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sector */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Sector Económico
          </label>
          <select
            value={filters.sector}
            onChange={(e) => handleChange("sector", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
          >
            {SECTORS.map((item) => {
              if (item.value === "") {
                return (
                  <option key={item.label} value={item.value}>
                    {item.label}
                  </option>
                );
              }
              const count = sectorCounts[item.value] || 0;
              return (
                <option key={item.value} value={item.value}>
                  {item.label} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Tamaño */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Tamaño de Unidad
          </label>
          <select
            value={filters.tamano}
            onChange={(e) => handleChange("tamano", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
          >
            {SIZES.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* SCIAN */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Clase SCIAN
          </label>
          <input
            type="text"
            value={filters.scian}
            onChange={(e) => handleChange("scian", e.target.value)}
            placeholder="Ej. 72 o 721110"
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-cyan-400"
          />
        </div>

        {/* Ordenar por */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Ordenar Por
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => handleChange("sortBy", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
          >
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-800/60 pt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Slider de Score */}
        <div className="flex flex-col justify-center">
          <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Score de Oportunidad Aura</span>
            <span className="text-cyan-400 font-bold">{filters.minScore}+ pts</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={filters.minScore}
            onChange={(e) => handleChange("minScore", Number(e.target.value))}
            className="mt-3 h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-cyan-400"
          />
        </div>

        {/* Toggles de Disponibilidad de Contactos */}
        <div className="lg:col-span-2 flex flex-wrap gap-x-6 gap-y-3 items-center mt-2 lg:mt-0">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hasEmail}
              onChange={(e) => handleChange("hasEmail", e.target.checked)}
              className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-cyan-400 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-medium hover:text-white transition">
              Solo con Email Disponible
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hasPhone}
              onChange={(e) => handleChange("hasPhone", e.target.checked)}
              className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-cyan-400 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-medium hover:text-white transition">
              Solo con Teléfono Disponible
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hasWebsite}
              onChange={(e) => handleChange("hasWebsite", e.target.checked)}
              className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-cyan-400 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-medium hover:text-white transition">
              Solo con Sitio Web Activo
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
