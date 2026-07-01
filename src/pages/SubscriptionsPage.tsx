import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Pause,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";

import subscriptionLifecycleService from "../services/subscriptionLifecycleService";
import { getClients } from "../services/platformClientService";
import { getTenants } from "../services/platformTenantService";
import type { PlatformSubscription } from "../types/subscription";
import type { PlatformClient } from "../types/platformClient";
import type { PlatformTenant } from "../types/platformTenant";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function formatDate(timestamp: any): string {
  if (!timestamp) return "Sin fecha";
  
  // If it's a Firestore Timestamp { seconds, nanoseconds }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // If it's an ISO date string or Date object
  try {
    return new Date(timestamp).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return String(timestamp);
  }
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  let className = "";
  let icon = null;

  switch (status) {
    case "ACTIVE":
      className = "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      icon = <CheckCircle className="h-3 w-3 shrink-0" />;
      break;
    case "GRACE_PERIOD":
      className = "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
      icon = <AlertTriangle className="h-3 w-3 shrink-0" />;
      break;
    case "SUSPENDED":
      className = "border-red-500/30 bg-red-500/10 text-red-300";
      icon = <Pause className="h-3 w-3 shrink-0" />;
      break;
    case "CANCELLED":
      className = "border-slate-500/30 bg-slate-500/10 text-slate-400";
      icon = <XCircle className="h-3 w-3 shrink-0" />;
      break;
    case "PENDING_ACTIVATION":
    default:
      className = "border-blue-500/30 bg-blue-500/10 text-blue-300";
      icon = <AlertCircle className="h-3 w-3 shrink-0" />;
      break;
  }

  const label =
    status === "ACTIVE"
      ? "Activa"
      : status === "GRACE_PERIOD"
        ? "En Gracia"
        : status === "SUSPENDED"
          ? "Suspendida"
          : status === "CANCELLED"
            ? "Cancelada"
            : "Pendiente";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
        className,
      ].join(" ")}
    >
      {icon}
      {label}
    </span>
  );
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<PlatformSubscription[]>([]);
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function loadData() {
    try {
      setError("");
      const [subsData, clientsData, tenantsData] = await Promise.all([
        subscriptionLifecycleService.getSubscriptions(),
        getClients(),
        getTenants(),
      ]);
      setSubscriptions(subsData);
      setClients(clientsData);
      setTenants(tenantsData);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las suscripciones de la plataforma.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Maps for quick lookup
  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const tenantMap = new Map(tenants.map((t) => [t.id, (t as any).tenantSlug || t.tenantId]));

  // Actions handlers
  async function handleActivate(id: string) {
    if (!window.confirm("¿Está seguro de que desea activar esta suscripción? Esto activará al cliente, su tenant y todas sus licencias asociadas en Control Center.")) {
      return;
    }
    
    setActionLoadingId(id);
    setError("");
    setSuccess("");
    try {
      await subscriptionLifecycleService.activateSubscription(id);
      setSuccess("Suscripción activada con éxito.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Fallo al activar la suscripción.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleGrace(id: string) {
    if (!window.confirm("¿Está seguro de que desea poner esta suscripción en periodo de gracia? El tenant pasará a gracia y las licencias continuarán activas por 30 días.")) {
      return;
    }

    setActionLoadingId(id);
    setError("");
    setSuccess("");
    try {
      await subscriptionLifecycleService.moveToGracePeriod(id);
      setSuccess("Suscripción puesta en periodo de gracia con éxito.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Fallo al iniciar el periodo de gracia.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSuspend(id: string) {
    if (!window.confirm("¿Está seguro de que desea suspender esta suscripción? El cliente, tenant y todas las licencias quedarán suspendidos de inmediato.")) {
      return;
    }

    setActionLoadingId(id);
    setError("");
    setSuccess("");
    try {
      await subscriptionLifecycleService.suspendSubscription(id);
      setSuccess("Suscripción suspendida con éxito.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Fallo al suspender la suscripción.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCancel(id: string) {
    const reason = window.prompt("Ingrese el motivo de cancelación de la suscripción (obligatorio):");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("El motivo de cancelación es obligatorio.");
      return;
    }

    if (!window.confirm("¿Está seguro de que desea cancelar definitivamente esta suscripción? El cliente, tenant y licencias asociadas se cancelarán de forma permanente.")) {
      return;
    }

    setActionLoadingId(id);
    setError("");
    setSuccess("");
    try {
      await subscriptionLifecycleService.cancelSubscription(id, reason);
      setSuccess("Suscripción cancelada con éxito.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Fallo al cancelar la suscripción.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const clientName = clientMap.get(sub.clientId) || "";
    const tenantSlug = tenantMap.get(sub.tenantId) || "";
    const matchesSearch =
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenantSlug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.quoteId && sub.quoteId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || sub.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Aura Control Center
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
          Control de Suscripciones
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Consola central para la administración del ciclo de vida comercial. Administre estados de activación, periodos de gracia, suspensiones y cancelaciones de clientes.
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
          {success}
        </div>
      )}

      {/* Filters bar */}
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="subscription-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, inquilino (slug)..."
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-300"
          />
        </div>

        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            id="subscription-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDING_ACTIVATION">Pendientes de activación</option>
            <option value="ACTIVE">Activas</option>
            <option value="GRACE_PERIOD">En gracia</option>
            <option value="SUSPENDED">Suspendidas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mb-4"></div>
          Cargando suscripciones comerciales...
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500">
          No se encontraron suscripciones comerciales que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/40">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Tenant (Slug)</th>
                <th className="px-6 py-4">Plan / Ciclo</th>
                <th className="px-6 py-4">Módulos</th>
                <th className="px-6 py-4">Montos</th>
                <th className="px-6 py-4">Activación</th>
                <th className="px-6 py-4">Siguiente Venc.</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredSubscriptions.map((sub) => {
                const clientName = clientMap.get(sub.clientId) || "Cliente desconocido";
                const tenantSlug = tenantMap.get(sub.tenantId) || "Sin tenant";
                const isProcessing = actionLoadingId === sub.id;

                return (
                  <tr
                    key={sub.id}
                    className="transition hover:bg-slate-900/20"
                  >
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white">{clientName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="rounded bg-slate-950 px-2 py-1 text-xs text-cyan-300">
                        {tenantSlug}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-white">{sub.pricingMode === "FOUNDER" ? "Founder" : "Dynamic"} ({sub.planCode || "Base"})</span>
                        <span className="block text-xs text-slate-500 uppercase">{sub.billingCycle === "YEARLY" ? "Anual" : "Mensual"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {sub.selectedModules?.map((mod) => (
                          <span
                            key={mod}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200"
                          >
                            {mod.replace("AURA_", "")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-white">
                          {formatCurrency(sub.billingCycle === "YEARLY" ? sub.annualAmount : sub.monthlyAmount)}
                        </span>
                        <span className="block text-xs text-slate-500">
                          Setup: {formatCurrency(sub.setupFee)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {sub.activatedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {formatDate(sub.activatedAt)}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No activado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {sub.status === "GRACE_PERIOD" && sub.gracePeriodEndDate ? (
                        <span className="text-yellow-400 font-semibold flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {formatDate(sub.gracePeriodEndDate)} (Gracia)
                        </span>
                      ) : sub.nextBillingDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {formatDate(sub.nextBillingDate)}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <SubscriptionStatusBadge status={sub.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {sub.status !== "ACTIVE" && sub.status !== "CANCELLED" && (
                          <button
                            id={`btn-activate-${sub.id}`}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleActivate(sub.id)}
                            className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
                          >
                            Activar
                          </button>
                        )}

                        {sub.status === "ACTIVE" && (
                          <button
                            id={`btn-grace-${sub.id}`}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleGrace(sub.id)}
                            className="rounded bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/20 transition disabled:opacity-50"
                          >
                            Gracia
                          </button>
                        )}

                        {(sub.status === "ACTIVE" || sub.status === "GRACE_PERIOD") && (
                          <button
                            id={`btn-suspend-${sub.id}`}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleSuspend(sub.id)}
                            className="rounded bg-red-500/10 border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                          >
                            Suspender
                          </button>
                        )}

                        {sub.status !== "CANCELLED" && (
                          <button
                            id={`btn-cancel-${sub.id}`}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleCancel(sub.id)}
                            className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}

                        {isProcessing && (
                          <span className="text-xs text-cyan-300 animate-pulse">...</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
