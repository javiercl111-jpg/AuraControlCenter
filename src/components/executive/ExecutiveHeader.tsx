import type { ExecutiveDashboardData } from "../../pages/DashboardPage";

interface ExecutiveHeaderProps {
  data: ExecutiveDashboardData;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function ExecutiveHeader({ data }: ExecutiveHeaderProps) {
  const attentionCount =
    data.metrics.suspendedClients.length +
    data.metrics.tenantsNearLimit.length +
    data.metrics.pendingInvoices.length;

  const statusMessage =
    attentionCount > 0
      ? `Hay ${attentionCount} temas que requieren tu atención.`
      : "Aura opera correctamente. No hay alertas críticas.";

  return (
    <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
        Executive Center
      </p>

      <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
        {getGreeting()}, Javier.
      </h1>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
        {statusMessage}
      </p>
    </header>
  );
}