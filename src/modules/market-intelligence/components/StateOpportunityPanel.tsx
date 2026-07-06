import { MapPin } from "lucide-react";
import type { CommercialAdvisorReport } from "../services/commercialAdvisorService";

interface StateOpportunityPanelProps {
  report: CommercialAdvisorReport;
}

export default function StateOpportunityPanel({ report }: StateOpportunityPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
      <h3 className="text-sm font-semibold tracking-wide text-white mb-4 flex items-center gap-2">
        <MapPin className="h-4.5 w-4.5 text-cyan-400" />
        Oportunidad Geográfica por Estado
      </h3>

      <div className="divide-y divide-slate-800/40">
        {report.opportunityByState.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No hay datos por estado para analizar.</p>
        ) : (
          report.opportunityByState.map((st) => (
            <div
              key={st.state}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-white">{st.state}</h4>
                <div className="mt-1 flex gap-1.5">
                  {st.dominantSuites.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-slate-800 px-1 py-0.5 text-[8px] text-slate-400 font-semibold"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6 sm:justify-end">
                <div className="text-center sm:text-right">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Prospectos
                  </span>
                  <span className="block text-sm font-extrabold text-white mt-0.5">
                    {st.totalCount}
                  </span>
                </div>

                <div className="text-center sm:text-right">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Afinidad Promedio
                  </span>
                  <span className="block text-sm font-extrabold text-cyan-400 mt-0.5">
                    {st.avgScore}%
                  </span>
                </div>

                <div className="text-right">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Críticos
                  </span>
                  <span className="block text-sm font-extrabold text-rose-400 mt-0.5">
                    {st.criticalCount}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
