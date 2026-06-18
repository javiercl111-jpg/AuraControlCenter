import {
  BadgeDollarSign,
  Building2,
  CirclePause,
  CreditCard,
  Layers3,
  LineChart,
  Network,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getInvoices } from "../services/platformBillingService";
import { getClients } from "../services/platformClientService";
import { getCommissions } from "../services/platformCommissionService";
import { getLeads } from "../services/platformLeadService";
import { getPayments } from "../services/platformPaymentService";
import { getTenants } from "../services/platformTenantService";

import type { PlatformClient } from "../types/platformClient";
import type { PlatformCommission } from "../types/platformCommission";
import type { PlatformInvoice } from "../types/platformInvoice";
import type { PlatformLead } from "../types/platformLead";
import type { PlatformPayment } from "../types/platformPayment";
import type { PlatformTenant } from "../types/platformTenant";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function getCurrentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function isCurrentMonth(dateValue?: string) {
  if (!dateValue) return false;
  return dateValue.slice(0, 7) === getCurrentMonthValue();
}

export default function DashboardPage() {
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
  const [leads, setLeads] = useState<PlatformLead[]>([]);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboardData() {
    try {
      setError("");

      const [
        clientsData,
        tenantsData,
        invoicesData,
        paymentsData,
        commissionsData,
        leadsData,
      ] = await Promise.all([
        getClients(),
        getTenants(),
        getInvoices(),
        getPayments(),
        getCommissions(),
        getLeads(),
      ]);

      setClients(clientsData);
      setTenants(tenantsData);
      setInvoices(invoicesData);
      setPayments(paymentsData);
      setCommissions(commissionsData);
      setLeads(leadsData);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el dashboard ejecutivo.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const metrics = useMemo(() => {
    const activeClients = clients.filter((client) => client.status === "ACTIVE");
    const graceClients = clients.filter(
      (client) => client.status === "GRACE_PERIOD"
    );
    const suspendedClients = clients.filter(
      (client) => client.status === "SUSPENDED"
    );
    const cancelledClients = clients.filter(
      (client) => client.status === "CANCELLED"
    );

    const activeTenants = tenants.filter((tenant) => tenant.status === "ACTIVE");
    const suspendedTenants = tenants.filter(
      (tenant) => tenant.status === "SUSPENDED"
    );

    const tenantsNearLimit = tenants.filter((tenant) => {
      const current = tenant.usage?.hcmActiveEmployees || 0;
      const limit = tenant.usage?.hcmEmployeeLimit || 0;
      const threshold = tenant.usage?.hcmWarningThreshold || 80;

      if (!limit) return false;

      return (current / limit) * 100 >= threshold;
    });

    const wonLeads = leads.filter((lead) => lead.stage === "WON");
    const lostLeads = leads.filter((lead) => lead.stage === "LOST");
    const newLeads = leads.filter((lead) => lead.stage === "NEW_LEAD");

    const pipelineValue = leads
      .filter((lead) => lead.stage !== "LOST")
      .reduce((total, lead) => total + (lead.estimatedValue || 0), 0);

    const wonValue = wonLeads.reduce(
      (total, lead) => total + (lead.estimatedValue || 0),
      0
    );

    const conversionRate =
      leads.length > 0 ? Number(((wonLeads.length / leads.length) * 100).toFixed(1)) : 0;

    const monthlyInvoices = invoices.filter((invoice) =>
      isCurrentMonth(invoice.periodStart)
    );

    const monthlyBilling = monthlyInvoices.reduce(
      (total, invoice) => total + (invoice.total || 0),
      0
    );

    const annualBilling = invoices.reduce(
      (total, invoice) => total + (invoice.total || 0),
      0
    );

    const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID");
    const pendingInvoices = invoices.filter(
      (invoice) => invoice.status === "PENDING"
    );

    const paymentsReceived = payments.reduce(
      (total, payment) => total + (payment.amount || 0),
      0
    );

    const pendingCommissions = commissions.filter(
      (commission) => commission.status === "PENDING"
    );

    const paidCommissions = commissions.filter(
      (commission) => commission.status === "PAID"
    );

    const pendingCommissionAmount = pendingCommissions.reduce(
      (total, commission) => total + (commission.commissionAmount || 0),
      0
    );

    const paidCommissionAmount = paidCommissions.reduce(
      (total, commission) => total + (commission.commissionAmount || 0),
      0
    );

    const mrr = activeClients.reduce((total, client) => {
      const invoice = invoices.find(
        (item) => item.clientId === client.id && item.status === "PAID"
      );

      return total + (invoice?.total || 0);
    }, 0);

    return {
      activeClients,
      graceClients,
      suspendedClients,
      cancelledClients,
      activeTenants,
      suspendedTenants,
      tenantsNearLimit,
      newLeads,
      wonLeads,
      lostLeads,
      pipelineValue,
      wonValue,
      conversionRate,
      monthlyBilling,
      annualBilling,
      paidInvoices,
      pendingInvoices,
      paymentsReceived,
      pendingCommissions,
      paidCommissions,
      pendingCommissionAmount,
      paidCommissionAmount,
      mrr,
      arr: mrr * 12,
    };
  }, [clients, tenants, invoices, payments, commissions, leads]);

  const cards = [
    {
      label: "Clientes activos",
      value: String(metrics.activeClients.length),
      detail: `${metrics.graceClients.length} en gracia · ${metrics.suspendedClients.length} suspendidos`,
      icon: Building2,
    },
    {
      label: "Tenants activos",
      value: String(metrics.activeTenants.length),
      detail: `${metrics.suspendedTenants.length} suspendidos · ${metrics.tenantsNearLimit.length} cerca del límite`,
      icon: Network,
    },
    {
      label: "MRR estimado",
      value: formatCurrency(metrics.mrr),
      detail: `ARR estimado: ${formatCurrency(metrics.arr)}`,
      icon: BadgeDollarSign,
    },
    {
      label: "Pipeline comercial",
      value: formatCurrency(metrics.pipelineValue),
      detail: `${metrics.wonLeads.length} ganados · ${metrics.conversionRate}% conversión`,
      icon: Workflow,
    },
    {
      label: "Facturación mes",
      value: formatCurrency(metrics.monthlyBilling),
      detail: `Histórico: ${formatCurrency(metrics.annualBilling)}`,
      icon: CreditCard,
    },
    {
      label: "Pagos recibidos",
      value: formatCurrency(metrics.paymentsReceived),
      detail: `${metrics.pendingInvoices.length} facturas pendientes`,
      icon: ReceiptText,
    },
    {
      label: "Comisiones pendientes",
      value: formatCurrency(metrics.pendingCommissionAmount),
      detail: `Pagadas: ${formatCurrency(metrics.paidCommissionAmount)}`,
      icon: UsersRound,
    },
    {
      label: "Licencias suspendidas",
      value: String(metrics.suspendedClients.length),
      detail: `${metrics.cancelledClients.length} canceladas`,
      icon: CirclePause,
    },
  ];

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Cargando dashboard ejecutivo...
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Executive Intelligence
        </p>

        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
          Dashboard ejecutivo de Aura
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
          Vista consolidada de clientes, tenants, licencias, facturación,
          pagos, comisiones y pipeline comercial del ecosistema Aura.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>

                <TrendingUp className="h-4 w-4 text-slate-600" />
              </div>

              <p className="text-sm text-slate-400">{card.label}</p>

              <p className="mt-2 text-3xl font-bold text-white">
                {card.value}
              </p>

              <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-5 flex items-center gap-3">
            <LineChart className="h-5 w-5 text-cyan-300" />
            <h2 className="text-xl font-bold text-white">
              Pipeline comercial
            </h2>
          </div>

          <div className="space-y-3">
            {[
              ["Nuevos", metrics.newLeads.length],
              ["Ganados", metrics.wonLeads.length],
              ["Perdidos", metrics.lostLeads.length],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-2xl bg-slate-950/60 px-4 py-3"
              >
                <span className="text-sm text-slate-400">{label}</span>
                <span className="font-bold text-white">{value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-5 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-yellow-200" />
            <h2 className="text-xl font-bold text-white">
              Alertas ejecutivas
            </h2>
          </div>

          <div className="space-y-3">
            {metrics.suspendedClients.length > 0 && (
              <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {metrics.suspendedClients.length} clientes suspendidos requieren
                revisión.
              </p>
            )}

            {metrics.tenantsNearLimit.length > 0 && (
              <p className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-200">
                {metrics.tenantsNearLimit.length} tenants están cerca o sobre su
                límite contratado.
              </p>
            )}

            {metrics.pendingInvoices.length > 0 && (
              <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
                {metrics.pendingInvoices.length} facturas siguen pendientes de
                pago.
              </p>
            )}

            {!metrics.suspendedClients.length &&
              !metrics.tenantsNearLimit.length &&
              !metrics.pendingInvoices.length && (
                <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
                  No hay alertas críticas registradas.
                </p>
              )}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-5 flex items-center gap-3">
          <Layers3 className="h-5 w-5 text-cyan-300" />
          <h2 className="text-xl font-bold text-white">
            Ecosistemas contratados
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["AURA_HCM", "AURA_MAINTENANCE", "AURA_SIGNATURE", "AURA_INTELLIGENCE"].map(
            (moduleCode) => {
              const count = clients.filter((client) =>
                client.enabledModules?.includes(moduleCode as never)
              ).length;

              return (
                <div
                  key={moduleCode}
                  className="rounded-2xl bg-slate-950/60 p-4"
                >
                  <p className="text-xs text-slate-500">{moduleCode}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{count}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    clientes con módulo contratado
                  </p>
                </div>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}