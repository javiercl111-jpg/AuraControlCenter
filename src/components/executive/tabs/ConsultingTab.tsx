import type { ExecutiveDashboardData } from "../../../pages/DashboardPage";

interface ConsultingTabProps {
  data: ExecutiveDashboardData;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

export default function ConsultingTab({ data }: ConsultingTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-3xl bg-slate-950/60 p-5">
        <p className="text-sm text-slate-400">Organizaciones nuevas</p>
        <p className="mt-2 text-2xl font-bold text-white">
          {data.metrics.newLeads.length}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Pendientes de descubrimiento.
        </p>
      </div>

      <div className="rounded-3xl bg-slate-950/60 p-5">
        <p className="text-sm text-slate-400">Propuestas ganadas</p>
        <p className="mt-2 text-2xl font-bold text-white">
          {data.metrics.wonLeads.length}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Valor: {formatCurrency(data.metrics.wonValue)}
        </p>
      </div>

      <div className="rounded-3xl bg-slate-950/60 p-5">
        <p className="text-sm text-slate-400">Conversión</p>
        <p className="mt-2 text-2xl font-bold text-white">
          {data.metrics.conversionRate}%
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Del pipeline comercial actual.
        </p>
      </div>
    </div>
  );
}