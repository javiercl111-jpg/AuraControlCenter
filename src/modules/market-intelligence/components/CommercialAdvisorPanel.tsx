import { AlertTriangle, CheckCircle2, Sparkles, Target, TrendingUp } from "lucide-react";
import type { CommercialAdvisorReport } from "../services/commercialAdvisorService";

interface CommercialAdvisorPanelProps {
  report: CommercialAdvisorReport;
}

export default function CommercialAdvisorPanel({ report }: CommercialAdvisorPanelProps) {
  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 backdrop-blur">
      <div className="flex items-center gap-2 text-indigo-300">
        <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Aura Intelligence</h3>
      </div>

      <div className="mt-4 space-y-4">
        {/* Resumen Ejecutivo */}
        <p className="text-sm text-slate-300 leading-relaxed font-medium">
          {report.executiveSummary}
        </p>

        {/* Foco de Prospección */}
        <div className="rounded-xl bg-indigo-950/30 border border-indigo-500/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
            <Target className="h-4 w-4" />
            Foco de Prospección Recomendado
          </div>
          <p className="mt-1 text-xs text-white leading-relaxed font-semibold">
            {report.recommendedFocus}
          </p>
        </div>

        {/* Módulos Estrella */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Suites Aura Prioritarias para Venta:
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.topRecommendedSuites.map((suite) => (
              <span
                key={suite}
                className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300 font-semibold"
              >
                {suite}
              </span>
            ))}
          </div>
        </div>

        {/* Acciones y Riesgos Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Siguientes Pasos */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
              Siguientes Acciones
            </h4>
            <ul className="space-y-1.5">
              {report.suggestedNextActions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Advertencias */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              Riesgos de Prospección
            </h4>
            <ul className="space-y-1.5">
              {report.riskWarnings.map((warning, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
