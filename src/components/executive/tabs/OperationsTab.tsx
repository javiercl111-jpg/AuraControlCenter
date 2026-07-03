import type { ExecutiveDashboardData } from "../../../pages/DashboardPage";

interface OperationsTabProps {
  data: ExecutiveDashboardData;
}

export default function OperationsTab({ data }: OperationsTabProps) {
  return (
    <div className="space-y-3">
      {data.metrics.suspendedClients.length > 0 && (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {data.metrics.suspendedClients.length} clientes suspendidos requieren
          revisión.
        </p>
      )}

      {data.metrics.tenantsNearLimit.length > 0 && (
        <p className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-200">
          {data.metrics.tenantsNearLimit.length} tenants están cerca o sobre su
          límite contratado.
        </p>
      )}

      {!data.metrics.suspendedClients.length &&
        !data.metrics.tenantsNearLimit.length && (
          <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            No hay alertas operativas críticas.
          </p>
        )}
    </div>
  );
}