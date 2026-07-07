import { Building2, ArrowUpRight } from "lucide-react";
import type { InegiCompany } from "../types/inegi";

interface TopProspectsPanelProps {
  companies: InegiCompany[];
  onSelectCompany: (company: InegiCompany) => void;
}

export default function TopProspectsPanel({
  companies,
  onSelectCompany,
}: TopProspectsPanelProps) {
  // Tomar las 5 mejores compañías ordenadas por score desc
  const topProspects = [...companies]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
      <h3 className="text-sm font-semibold tracking-wide text-white mb-4 flex items-center gap-2">
        <Building2 className="h-4.5 w-4.5 text-cyan-400" />
        Top 5 Prospectos del Día
      </h3>

      <div className="divide-y divide-slate-800/40">
        {topProspects.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No hay prospectos con alta prioridad cargados.</p>
        ) : (
          topProspects.map((company) => {
            const priority =
              company.priorityLevel ||
              (company.opportunityScore >= 85
                ? "CRITICAL"
                : company.opportunityScore >= 70
                ? "HIGH"
                : "MEDIUM");

            return (
              <div
                key={company.id}
                className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-900/10 px-2 rounded-xl transition"
              >
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {company.nombreComercial || company.razonSocial}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {company.municipio}, {company.estado}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(company.recommendedSuites || []).slice(0, 2).map((suite) => (
                      <span
                        key={suite}
                        className="rounded-md bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400"
                      >
                        {suite}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-right">
                    <span className="block text-xs font-extrabold text-white">
                      {company.opportunityScore} pts
                    </span>
                    <span
                      className={`inline-block text-[8px] font-bold uppercase tracking-wider mt-0.5 px-1.5 py-0.2 rounded-full ${
                        priority === "CRITICAL"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                          : priority === "HIGH"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                          : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25"
                      }`}
                    >
                      {priority}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectCompany(company)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 transition hover:bg-slate-900 hover:text-white"
                    title="Ver prospecto"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
