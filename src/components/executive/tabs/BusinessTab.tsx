import type { ExecutiveDashboardData } from "../../../pages/DashboardPage";

interface BusinessTabProps {
  data: ExecutiveDashboardData;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

export default function BusinessTab({ data }: BusinessTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-3xl bg-slate-950/60 p-5">
        <p className="text-sm text-slate-400">Pipeline comercial</p>
        <p className="mt-2 text-2xl font-bold text-white">
          {formatCurrency(data.metrics.pipelineValue)}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {data.metrics.wonLeads.length} ganados ·{" "}
          {data.metrics.conversionRate}% conversión
        </p>
      </div>

      <div className="rounded-3xl bg-slate-950/60 p-5">
        <p className="text-sm text-slate-400">Comisiones pendientes</p>
        <p className="mt-2 text-2xl font-bold text-white">
          {formatCurrency(data.metrics.pendingCommissionAmount)}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Pagadas: {formatCurrency(data.metrics.paidCommissionAmount)}
        </p>
      </div>

      <div className="rounded-3xl bg-slate-950/60 p-5">
        <p className="text-sm text-slate-400">Facturas pendientes</p>
        <p className="mt-2 text-2xl font-bold text-white">
          {data.metrics.pendingInvoices.length}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Requieren seguimiento comercial.
        </p>
      </div>
    </div>
  );
}