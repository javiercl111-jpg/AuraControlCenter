import { useEffect, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Activity,
  ArrowRight,
  Info,
} from "lucide-react";
import type { InegiCompany } from "../types/inegi";
import AppAdapter from "../../intelligence/core/services/appAdapter";
import type { ExecutiveIntelligenceDashboard } from "../../intelligence/core/types/brains";

interface AuraIntelligenceRecommendationsPanelProps {
  companies: InegiCompany[];
}

export function AuraIntelligenceRecommendationsPanel({
  companies,
}: AuraIntelligenceRecommendationsPanelProps) {
  const [dashboard, setDashboard] = useState<ExecutiveIntelligenceDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      try {
        const result = await AppAdapter.generateDashboard(companies);
        if (active) {
          setDashboard(result);
          setError(null);
        }
      } catch (err) {
        console.error("Error generating intelligence recommendations dashboard:", err);
        if (active) {
          setError("No se pudieron cargar las recomendaciones de Aura Core.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [companies]);

  const getPriorityStyle = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "HIGH":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "MEDIUM":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      default:
        return "bg-slate-800/40 text-slate-400 border-slate-700/30";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "compliance":
        return <ShieldCheck className="h-4.5 w-4.5 text-rose-400" />;
      case "sales":
        return <TrendingUp className="h-4.5 w-4.5 text-cyan-400" />;
      case "success":
        return <Activity className="h-4.5 w-4.5 text-emerald-400" />;
      default:
        return <FileText className="h-4.5 w-4.5 text-indigo-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-6 space-y-4 animate-pulse">
        <div className="h-5 w-48 bg-slate-800 rounded"></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-20 bg-slate-900/60 rounded-xl"></div>
          <div className="h-20 bg-slate-900/60 rounded-xl"></div>
          <div className="h-20 bg-slate-900/60 rounded-xl"></div>
        </div>
        <div className="space-y-2">
          <div className="h-12 bg-slate-900/40 rounded-xl"></div>
          <div className="h-12 bg-slate-900/40 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-6 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-400" />
        <p className="text-xs text-rose-300 font-semibold">{error || "No hay datos de análisis."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-slate-950/40 to-slate-950 p-6 shadow-xl backdrop-blur relative overflow-hidden transition-all duration-300 hover:border-indigo-500/35">
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"></div>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-500/15 p-2 border border-indigo-500/25 text-indigo-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Recomendaciones de Aura Intelligence
            </h3>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Info className="h-3 w-3 shrink-0" />
              Resumen ejecutivo generado por Aura Intelligence
            </p>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 font-mono self-end sm:self-center">
          Última actualización: {new Date(dashboard.lastUpdated).toLocaleTimeString()}
        </div>
      </div>

      {/* Dashboard KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-3 mt-5">
        {/* Health gauge */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/50 p-4 flex flex-col justify-between">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Prioridad Comercial
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-3xl font-extrabold ${
                dashboard.overallHealthScore >= 85
                  ? "text-emerald-400"
                  : dashboard.overallHealthScore >= 60
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {dashboard.overallHealthScore}%
            </span>
          </div>
        </div>

        {/* Potential MRR */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/50 p-4 flex flex-col justify-between">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            MRR Potencial Estimado
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-white">
              ${dashboard.estimatedPotentialValue.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">MXN</span>
          </div>
        </div>

        {/* Primary Gaps Count */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/50 p-4 flex flex-col justify-between">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Brechas Críticas STPS / SAT
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-3xl font-extrabold ${
                dashboard.primaryGapsCount > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {dashboard.primaryGapsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">identificadas</span>
          </div>
        </div>
      </div>

      {/* Prioritized Action Queue */}
      <div className="mt-6 space-y-3.5">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Cola de Acciones Priorizadas:
        </h4>

        {dashboard.prioritizedActions.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No se han emitido alertas prioritarias hoy.</p>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {dashboard.prioritizedActions.map((action) => (
              <div
                key={action.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-900 bg-slate-950/20 p-4 hover:border-slate-800 hover:bg-slate-900/10 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/80 group-hover:border-slate-700 shrink-0">
                    {getCategoryIcon(action.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {action.title}
                      </h5>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[8px] font-extrabold border ${getPriorityStyle(
                          action.priorityLevel
                        )}`}
                      >
                        {action.priorityLevel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                      {action.description}{" "}
                      <span className="text-indigo-400 font-medium">
                        Sugerencia: {action.suggestedAction}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 px-2.5 py-1.5 text-[10px] font-bold text-indigo-300 hover:bg-indigo-500 hover:text-white transition duration-200"
                  >
                    <span>
                      {action.category === "compliance"
                        ? "Preparar diagnóstico"
                        : action.category === "sales"
                        ? "Ver análisis"
                        : "Revisar recomendación"}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuraIntelligenceRecommendationsPanel;
