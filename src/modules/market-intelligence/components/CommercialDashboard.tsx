import type { InegiCompany } from "../types/inegi";
import CommercialAdvisorService from "../services/commercialAdvisorService";
import CommercialAdvisorPanel from "./CommercialAdvisorPanel";
import TopProspectsPanel from "./TopProspectsPanel";
import StateOpportunityPanel from "./StateOpportunityPanel";
import DailySalesGoalPanel from "./DailySalesGoalPanel";

interface CommercialDashboardProps {
  companies: InegiCompany[];
  onSelectCompany: (company: InegiCompany) => void;
  stats: {
    totalCount: number;
    convertedCount: number;
    qualifiedCount: number;
    avgScore: number;
  };
}

export default function CommercialDashboard({
  companies,
  onSelectCompany,
  stats,
}: CommercialDashboardProps) {
  const report = CommercialAdvisorService.generateAdvisorReport(companies);

  // Totales
  const critical = companies.filter(
    (c) => c.priorityLevel === "CRITICAL" || c.opportunityScore >= 85
  ).length;
  const high = companies.filter(
    (c) => c.priorityLevel === "HIGH" || (c.opportunityScore >= 70 && c.opportunityScore < 85)
  ).length;

  const contactComplete = companies.filter((company) => {
    const hasEmail = company.email && company.email !== "no disponible";
    const hasPhone = company.telefono && company.telefono !== "no disponible";
    return hasEmail && hasPhone;
  }).length;

  const activeStates = report.opportunityByState.length;

  return (
    <div className="space-y-6">
      {/* 1. Saludo ejecutivo */}
      <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-r from-slate-900/60 via-slate-950/60 to-slate-900/60 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>👋</span> Buenos días, Asesor Aura.
        </h2>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed max-w-2xl">
          El motor de inteligencia local de Aura ha procesado la base DENUE local y ha encontrado nuevas oportunidades para acelerar tu prospección y prospección calificada.
        </p>
      </div>

      {/* 2. KPIs principales */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4.5">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prospectos</span>
          <span className="block text-2xl font-extrabold text-white mt-1">{stats.totalCount}</span>
        </div>
        <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-4.5">
          <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider">Críticos</span>
          <span className="block text-2xl font-extrabold text-rose-300 mt-1">{critical}</span>
        </div>
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4.5">
          <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider">Alta Prioridad</span>
          <span className="block text-2xl font-extrabold text-amber-300 mt-1">{high}</span>
        </div>
        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4.5">
          <span className="block text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Contacto Completo</span>
          <span className="block text-2xl font-extrabold text-cyan-300 mt-1">{contactComplete}</span>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4.5">
          <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">MRR Estimado</span>
          <span className="block text-xl font-extrabold text-emerald-300 mt-1.5">
            ${report.estimatedPotentialMrr.toLocaleString()} MXN
          </span>
        </div>
        <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-4.5">
          <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Estados Activos</span>
          <span className="block text-2xl font-extrabold text-indigo-300 mt-1">{activeStates}</span>
        </div>
      </div>

      {/* 3. Aura Intelligence Lite Panel */}
      <CommercialAdvisorPanel report={report} />

      {/* 4. Daily Sales Goal Panel */}
      <DailySalesGoalPanel companies={companies} />

      {/* 5. Grid: Top Prospectos & Oportunidades por Estado */}
      <div className="grid gap-6 md:grid-cols-2">
        <TopProspectsPanel companies={companies} onSelectCompany={onSelectCompany} />
        <StateOpportunityPanel report={report} />
      </div>
    </div>
  );
}
