import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import type { InegiCompany } from "../types/inegi";
import { resolveCommercialIndustry } from "../services/industryResolverService";

interface MarketCompaniesTableProps {
  companies: InegiCompany[];
  isLoading: boolean;
  onSelectCompany: (company: InegiCompany) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  hasMore: boolean;
  currentPage: number;
  filters?: {
    estado: string;
    sector: string;
  };
  sectorCounts?: Record<string, number>;
}

export default function MarketCompaniesTable({
  companies,
  isLoading,
  onSelectCompany,
  onNextPage,
  onPrevPage,
  hasMore,
  currentPage,
  filters,
  sectorCounts,
}: MarketCompaniesTableProps) {
  
  // Render de insignias de estatus
  function renderStatusBadge(status: string) {
    const styles: Record<string, string> = {
      NEW: "border-slate-800 bg-slate-900 text-slate-400",
      QUALIFIED: "border-amber-500/20 bg-amber-500/10 text-amber-300",
      CONTACTED: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
      CONVERTED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      DISCARDED: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    };

    const labelMap: Record<string, string> = {
      NEW: "Nuevo",
      QUALIFIED: "Calificado",
      CONTACTED: "Contactado",
      CONVERTED: "Convertido",
      DISCARDED: "Descartado",
    };

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
          styles[status] || styles.NEW
        }`}
      >
        {labelMap[status] || status}
      </span>
    );
  }

  // Render de barra de score visual
  function renderScoreIndicator(score: number) {
    let colorClass = "bg-rose-500 text-rose-300";
    if (score >= 75) {
      colorClass = "bg-cyan-500 text-cyan-300";
    } else if (score >= 45) {
      colorClass = "bg-indigo-500 text-indigo-300";
    }

    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${colorClass.split(" ")[0]}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-200">{score}%</span>
      </div>
    );
  }

  // Render de estado vacío interactivo con sugerencias inteligentes
  function renderEmptyState() {
    const hasActiveFilters = filters && (filters.estado || filters.sector);
    
    if (hasActiveFilters && sectorCounts) {
      const activeState = filters.estado || "Todos los estados";
      const activeSector = filters.sector || "Todos los sectores";

      // Encontrar el sector con más registros para la sugerencia
      const sortedSectors = Object.entries(sectorCounts)
        .filter(([name, count]) => name && name !== "Otros Sectores" && count > 0)
        .sort((a, b) => b[1] - a[1]);

      const suggestion = sortedSectors[0]; // [sectorName, count]

      return (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/10 p-6 text-center backdrop-blur">
          <Building2Icon className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-300">
            No hay prospectos de "{activeSector}" en {activeState === "No Especificado" ? "No Especificado" : activeState} dentro del dataset cargado.
          </p>
          {suggestion ? (
            <p className="mt-3.5 text-xs text-cyan-400 font-semibold max-w-md bg-cyan-950/20 border border-cyan-500/10 px-3.5 py-2.5 rounded-xl">
              💡 Sugerencia: Prueba "{suggestion[0]}", donde existen {suggestion[1]} prospectos.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500 max-w-sm">
              Intenta cambiar los filtros, borrar la búsqueda o recargar datos.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/10 p-6 text-center backdrop-blur">
        <Building2Icon className="h-10 w-10 text-slate-600 mb-3" />
        <p className="text-sm font-semibold text-slate-300">No se encontraron prospectos</p>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Intenta cambiar los filtros, borrar la búsqueda, o carga la muestra piloto desde la cabecera.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/10 backdrop-blur">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-400">Cargando prospectos de mercado...</p>
        </div>
      ) : companies.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {/* VISTA MOBILE: Tarjetas responsivas (Mobile-first) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/30 p-5 hover:border-cyan-500/30 hover:bg-slate-900/50 transition-all duration-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">
                        {company.nombreComercial || company.razonSocial}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        SCIAN: {company.scian}
                      </p>
                    </div>
                    {renderStatusBadge(company.status)}
                  </div>

                  <p className="mt-3 text-xs text-slate-400 line-clamp-2">
                    {resolveCommercialIndustry(company.sector)}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{company.municipio || "Sin municipio"}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-4">
                    <div className="flex items-center gap-3">
                      <Mail
                        className={`h-4 w-4 ${
                          company.email ? "text-cyan-400" : "text-slate-700"
                        }`}
                      />
                      <Phone
                        className={`h-4 w-4 ${
                          company.telefono ? "text-cyan-400" : "text-slate-700"
                        }`}
                      />
                      <Globe
                        className={`h-4 w-4 ${
                          company.sitioWeb &&
                          company.sitioWeb !== "no disponible" &&
                          company.sitioWeb !== "n/a"
                            ? "text-cyan-400"
                            : "text-slate-700"
                        }`}
                      />
                    </div>
                    {renderScoreIndicator(company.opportunityScore)}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => onSelectCompany(company)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Detalles y Conversión
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* VISTA DESKTOP: Tabla estructurada premium */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur lg:block">
            <table className="w-full border-collapse text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">Empresa / SCIAN</th>
                  <th className="px-6 py-4">Sector Económico</th>
                  <th className="px-6 py-4">Municipio</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4 text-center">Contactos</th>
                  <th className="px-6 py-4">Estatus</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="transition hover:bg-cyan-500/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {company.nombreComercial || company.razonSocial}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {company.razonSocial && company.nombreComercial
                          ? company.razonSocial
                          : `SCIAN: ${company.scian || "N/A"}`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="line-clamp-2 text-xs text-slate-400 max-w-[220px]">
                        {resolveCommercialIndustry(company.sector)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-medium">
                      {company.municipio || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      {renderScoreIndicator(company.opportunityScore)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-3">
                        <span title={company.email || "No disponible"}>
                          <Mail
                            className={`h-4 w-4 ${
                              company.email ? "text-cyan-400" : "text-slate-700"
                            }`}
                          />
                        </span>
                        <span title={company.telefono || "No disponible"}>
                          <Phone
                            className={`h-4 w-4 ${
                              company.telefono ? "text-cyan-400" : "text-slate-700"
                            }`}
                          />
                        </span>
                        <span title={company.sitioWeb || "No disponible"}>
                          <Globe
                            className={`h-4 w-4 ${
                              company.sitioWeb &&
                              company.sitioWeb !== "no disponible" &&
                              company.sitioWeb !== "n/a"
                                ? "text-cyan-400"
                                : "text-slate-700"
                            }`}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {renderStatusBadge(company.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCompany(company)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/10"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINACIÓN CON COSTO PROTEGIDO */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 sm:px-6">
            <div className="hidden sm:block">
              <p className="text-xs text-slate-500">
                Página actual: <span className="font-semibold text-slate-300">{currentPage}</span>
              </p>
            </div>
            <div className="flex flex-1 justify-between sm:justify-end gap-3">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={currentPage <= 1 || isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                onClick={onNextPage}
                disabled={!hasMore || isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Icono auxiliar para vista vacía
function Building2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
