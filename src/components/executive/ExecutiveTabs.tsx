import { useEffect, useState } from "react";
import { Brain, BriefcaseBusiness, Rocket, ShieldAlert } from "lucide-react";

import type { ExecutiveDashboardData } from "../../pages/DashboardPage";

interface ExecutiveTabsProps {
  data: ExecutiveDashboardData;
}

type ExecutiveTabId = "business" | "consulting" | "operations" | "intelligence";

const STORAGE_KEY = "aura.executiveCenter.activeTab";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function isExecutiveTabId(value: string | null): value is ExecutiveTabId {
  return (
    value === "business" ||
    value === "consulting" ||
    value === "operations" ||
    value === "intelligence"
  );
}

export default function ExecutiveTabs({ data }: ExecutiveTabsProps) {
  const [activeTab, setActiveTab] = useState<ExecutiveTabId>(() => {
    const savedTab = window.localStorage.getItem(STORAGE_KEY);
    return isExecutiveTabId(savedTab) ? savedTab : "business";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs = [
    { id: "business", label: "Negocio", icon: BriefcaseBusiness },
    { id: "consulting", label: "Consulting", icon: Rocket },
    { id: "operations", label: "Operación", icon: ShieldAlert },
    { id: "intelligence", label: "Intelligence", icon: Brain },
  ] as const;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition",
                isActive
                  ? "bg-cyan-400 text-slate-950"
                  : "bg-slate-950 text-slate-400 hover:bg-cyan-400/10 hover:text-cyan-200",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "business" && (
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
      )}

      {activeTab === "consulting" && (
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
      )}

      {activeTab === "operations" && (
        <div className="space-y-3">
          {data.metrics.suspendedClients.length > 0 && (
            <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {data.metrics.suspendedClients.length} clientes suspendidos
              requieren revisión.
            </p>
          )}

          {data.metrics.tenantsNearLimit.length > 0 && (
            <p className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-200">
              {data.metrics.tenantsNearLimit.length} tenants están cerca o
              sobre su límite contratado.
            </p>
          )}

          {!data.metrics.suspendedClients.length &&
            !data.metrics.tenantsNearLimit.length && (
              <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
                No hay alertas operativas críticas.
              </p>
            )}
        </div>
      )}

      {activeTab === "intelligence" && (
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Recomendación Aura
          </p>

          <p className="mt-3 text-sm leading-6 text-cyan-100">
            Revisa primero las organizaciones nuevas y las facturas pendientes.
            Ahí se concentra la mayor oportunidad de acción para hoy.
          </p>
        </div>
      )}
    </section>
  );
}