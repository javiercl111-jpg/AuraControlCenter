import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  UserCheck,
  Ban,
  FileText,
  Search,
  Filter,
} from "lucide-react";

import commissionEngineService from "../services/commissionEngineService";
import { getClients } from "../services/platformClientService";
import { getTenants } from "../services/platformTenantService";
import type { PlatformCommission, CommissionStatus } from "../types/commission";
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
  
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

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

function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  let className = "";
  let icon = null;

  switch (status) {
    case "APPROVED":
      className = "border-blue-500/30 bg-blue-500/10 text-blue-300";
      icon = <UserCheck className="h-3 w-3 shrink-0" />;
      break;
    case "PAID":
      className = "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      icon = <CheckCircle className="h-3 w-3 shrink-0" />;
      break;
    case "VOID":
      className = "border-red-500/30 bg-red-500/10 text-red-300";
      icon = <Ban className="h-3 w-3 shrink-0" />;
      break;
    case "PENDING":
    default:
      className = "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
      icon = <Clock className="h-3 w-3 shrink-0" />;
      break;
  }

  const label =
    status === "APPROVED"
      ? "Aprobada"
      : status === "PAID"
        ? "Pagada"
        : status === "VOID"
          ? "Anulada"
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

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
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
      const [commData, clientsData, tenantsData] = await Promise.all([
        commissionEngineService.getCommissions(),
        getClients(),
        getTenants(),
      ]);
      setCommissions(commData);
      setClients(clientsData);
      setTenants(tenantsData);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las comisiones comerciales.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const tenantMap = new Map(tenants.map((t) => [t.id, (t as any).tenantSlug || t.tenantId]));

  // Actions
  async function handleUpdateStatus(id: string, status: CommissionStatus) {
    let confirmMsg = "¿Está seguro de cambiar el estado de la comisión?";
    if (status === "APPROVED") {
      confirmMsg = "¿Desea aprobar esta comisión para su pago?";
    } else if (status === "PAID") {
      confirmMsg = "¿Desea marcar esta comisión como PAGADA al asesor?";
    } else if (status === "VOID") {
      confirmMsg = "¿Desea ANULAR definitivamente esta comisión?";
    }

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(id);
    setError("");
    setSuccess("");
    try {
      await commissionEngineService.updateCommissionStatus(id, status);
      setSuccess(`Comisión actualizada con éxito.`);
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Fallo al actualizar el estado de la comisión.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleAddNotes(id: string, currentNotes: string | null | undefined) {
    const notes = window.prompt("Ingrese notas adicionales para esta comisión:", currentNotes || "");
    if (notes === null) return; // user clicked cancel

    setActionLoadingId(id);
    setError("");
    setSuccess("");
    try {
      await commissionEngineService.addCommissionNotes(id, notes);
      setSuccess("Notas de comisión actualizadas.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Fallo al actualizar las notas de la comisión.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // KPIs
  const pendingCommissions = commissions.filter((c) => c.status === "PENDING");
  const approvedCommissions = commissions.filter((c) => c.status === "APPROVED");
  const paidCommissions = commissions.filter((c) => c.status === "PAID");

  const pendingAmount = pendingCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const approvedAmount = approvedCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const paidAmount = paidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);

  const filteredCommissions = commissions.filter((comm) => {
    if (!comm.advisorId || comm.advisorId === "UNASSIGNED") return false;

    const clientName = clientMap.get(comm.clientId) || "";
    const tenantSlug = tenantMap.get(comm.tenantId) || "";
    const matchesSearch =
      comm.advisorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenantSlug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.quoteId && comm.quoteId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || comm.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Aura Commission Engine
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
          Comisiones Comerciales
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Administración del ciclo comercial de comisiones para asesores de venta. Las comisiones se autogeneran a partir de cotizaciones aceptadas y listas.
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

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Pendientes</span>
            <Clock className="h-4 w-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white">{pendingCommissions.length}</p>
          <p className="mt-1 text-sm font-semibold text-yellow-300">{formatCurrency(pendingAmount)}</p>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Aprobadas</span>
            <UserCheck className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{approvedCommissions.length}</p>
          <p className="mt-1 text-sm font-semibold text-blue-300">{formatCurrency(approvedAmount)}</p>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Pagadas</span>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{paidCommissions.length}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-300">{formatCurrency(paidAmount)}</p>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Total Pagado</span>
            <DollarSign className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white">Importe</p>
          <p className="mt-1 text-sm font-bold text-cyan-300">{formatCurrency(paidAmount)}</p>
        </article>
      </section>

      {/* Filters */}
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="commission-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por asesor, cliente o inquilino..."
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-300"
          />
        </div>

        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            id="commission-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="PAID">Pagadas</option>
            <option value="VOID">Anuladas</option>
          </select>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mb-4"></div>
          Cargando comisiones registradas...
        </div>
      ) : filteredCommissions.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500">
          <p>No se encontraron registros de comisiones comerciales.</p>
          <p className="mt-2 text-xs text-slate-600">
            Las ventas directas no generan comisión y no aparecen en este listado.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/40">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Asesor</th>
                <th className="px-6 py-4">Cliente / Tenant</th>
                <th className="px-6 py-4">Tipo / Ciclo</th>
                <th className="px-6 py-4">Importe Venta</th>
                <th className="px-6 py-4">%</th>
                <th className="px-6 py-4">Comisión</th>
                <th className="px-6 py-4">Fecha Reg.</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Notas</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredCommissions.map((comm) => {
                const clientName = clientMap.get(comm.clientId) || "Cliente sin asignar";
                const tenantSlug = tenantMap.get(comm.tenantId) || "Sin tenant";
                const isProcessing = actionLoadingId === comm.id;

                return (
                  <tr key={comm.id} className="transition hover:bg-slate-900/20">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white">{comm.advisorName}</span>
                      <span className="block text-[10px] text-slate-500">ID: {comm.advisorId.slice(0, 8)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-white font-medium">{clientName}</span>
                        <code className="block mt-1 text-[11px] text-cyan-300">{tenantSlug}</code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-white">
                          {comm.commissionType === "NEW_SALE" ? "Venta Nueva" : "Renovación"}
                        </span>
                        <span className="block text-xs text-slate-500 uppercase">
                          {comm.billingCycle === "YEARLY" ? "Anual" : "Mensual"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300">{formatCurrency(comm.saleAmount)}</span>
                      <span className="block text-[11px] text-slate-500">Setup: {formatCurrency(comm.setupFee)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white">{comm.commissionPercent}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-cyan-300">{formatCurrency(comm.commissionAmount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {formatDate(comm.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <CommissionStatusBadge status={comm.status} />
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate">
                      {comm.notes ? (
                        <span className="text-slate-400 text-xs" title={comm.notes}>
                          {comm.notes}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic text-xs">Sin notas</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {comm.status === "PENDING" && (
                          <button
                            id={`btn-approve-${comm.id}`}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUpdateStatus(comm.id, "APPROVED")}
                            className="rounded bg-blue-500/10 border border-blue-500/30 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                        )}

                        {comm.status === "APPROVED" && (
                          <button
                            id={`btn-pay-${comm.id}`}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUpdateStatus(comm.id, "PAID")}
                            className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
                          >
                            Pagar
                          </button>
                        )}

                        {comm.status !== "VOID" && comm.status !== "PAID" && (
                          <button
                            id={`btn-void-${comm.id}`}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUpdateStatus(comm.id, "VOID")}
                            className="rounded bg-red-500/10 border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                          >
                            Anular
                          </button>
                        )}

                        <button
                          id={`btn-notes-${comm.id}`}
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleAddNotes(comm.id, comm.notes)}
                          className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition flex items-center gap-1 disabled:opacity-50"
                        >
                          <FileText className="h-3 w-3" />
                          Notas
                        </button>

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