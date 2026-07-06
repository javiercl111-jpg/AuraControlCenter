import { CalendarRange, PhoneCall, Sparkles, BookOpen, Award } from "lucide-react";
import type { InegiCompany } from "../types/inegi";

interface DailySalesGoalPanelProps {
  companies: InegiCompany[];
}

export default function DailySalesGoalPanel({ companies }: DailySalesGoalPanelProps) {
  // Generar objetivos del día dinámicamente con base en los prospectos HIGH/CRITICAL
  const critical = companies.filter(
    (c) => c.priorityLevel === "CRITICAL" || c.opportunityScore >= 85
  ).length;
  const high = companies.filter(
    (c) => c.priorityLevel === "HIGH" || (c.opportunityScore >= 70 && c.opportunityScore < 85)
  ).length;

  const baseCalls = Math.min(15, Math.max(5, critical + high));
  const baseDiagnostics = Math.min(6, Math.max(2, Math.floor(baseCalls * 0.4)));
  const baseDemos = Math.min(4, Math.max(1, Math.floor(baseDiagnostics * 0.5)));
  const baseProposals = Math.min(2, Math.max(1, Math.floor(baseDemos * 0.5)));

  const goals = [
    { label: "Llamadas de prospección", target: baseCalls, icon: PhoneCall, color: "text-cyan-400" },
    { label: "Diagnósticos comerciales", target: baseDiagnostics, icon: BookOpen, color: "text-indigo-400" },
    { label: "Demos personalizadas", target: baseDemos, icon: Sparkles, color: "text-amber-400" },
    { label: "Propuestas enviadas", target: baseProposals, icon: Award, color: "text-emerald-400" },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
      <h3 className="text-sm font-semibold tracking-wide text-white mb-4 flex items-center gap-2">
        <CalendarRange className="h-4.5 w-4.5 text-cyan-400" />
        Objetivos de Venta del Día
      </h3>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {goals.map((goal) => {
          const Icon = goal.icon;
          return (
            <div
              key={goal.label}
              className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-center"
            >
              <div className="flex justify-center mb-1.5">
                <Icon className={`h-5 w-5 ${goal.color}`} />
              </div>
              <span className="block text-2xl font-extrabold text-white">{goal.target}</span>
              <span className="mt-1 block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                {goal.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
