import { Building2, CheckCircle2, HeartHandshake, Sparkles } from "lucide-react";

interface MarketIntelligenceKPIsProps {
  totalCount: number;
  convertedCount: number;
  qualifiedCount: number;
  avgScore: number;
}

export default function MarketIntelligenceKPIs({
  totalCount = 0,
  convertedCount = 0,
  qualifiedCount = 0,
  avgScore = 0,
}: MarketIntelligenceKPIsProps) {
  // Calcular tasa de conversión
  const conversionRate = totalCount > 0 ? ((convertedCount / totalCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Prospectos */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur transition-all duration-300 hover:border-cyan-500/20 hover:bg-slate-900/80">
        <div className="absolute right-4 top-4 rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400">
          <Building2 className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Total Prospectos DENUE
        </p>
        <h3 className="mt-2 text-3xl font-extrabold text-white">
          {totalCount}
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Empresas importadas y activas en base local.
        </p>
      </div>

      {/* Tasa de Conversión */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur transition-all duration-300 hover:border-emerald-500/20 hover:bg-slate-900/80">
        <div className="absolute right-4 top-4 rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Conversiones a Aura
        </p>
        <h3 className="mt-2 text-3xl font-extrabold text-white">
          {convertedCount} <span className="text-sm font-medium text-emerald-400">({conversionRate}%)</span>
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Convertidos en Organizaciones Consultivas.
        </p>
      </div>

      {/* Aura Opportunity Score Promedio */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur transition-all duration-300 hover:border-indigo-500/20 hover:bg-slate-900/80">
        <div className="absolute right-4 top-4 rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Opportunity Score Promedio
        </p>
        <h3 className="mt-2 text-3xl font-extrabold text-white">
          {avgScore.toFixed(0)} <span className="text-sm font-medium text-indigo-400">/ 100</span>
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Afinidad comercial con Suites de Aura.
        </p>
      </div>

      {/* Prospectos en Embudo */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur transition-all duration-300 hover:border-amber-500/20 hover:bg-slate-900/80">
        <div className="absolute right-4 top-4 rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          En Proceso de Calificación
        </p>
        <h3 className="mt-2 text-3xl font-extrabold text-white">
          {qualifiedCount}
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Prospectos calificados o contactados.
        </p>
      </div>
    </div>
  );
}
