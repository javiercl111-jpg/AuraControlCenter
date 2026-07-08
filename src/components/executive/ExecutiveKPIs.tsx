import {
    BadgeDollarSign,
    Building2,
    CreditCard,
    Network,
    ReceiptText,
  } from "lucide-react";
  
  import type { ExecutiveMetrics } from "../../pages/DashboardPage";
  
  interface ExecutiveKPIsProps {
    metrics: ExecutiveMetrics;
  }
  
  function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value || 0);
  }
  
  export default function ExecutiveKPIs({ metrics }: ExecutiveKPIsProps) {
  const failed = metrics.failedQueries || [];

  const isClientsFailed = failed.includes("clients");
  const isTenantsFailed = failed.includes("tenants");
  const isInvoicesFailed = failed.includes("invoices");
  const isPaymentsFailed = failed.includes("payments");

  const cards = [
    {
      label: "Clientes activos",
      value: isClientsFailed ? "No disponible" : String(metrics.activeClients.length),
      detail: isClientsFailed ? "Sincronización fallida" : `${metrics.graceClients.length} en gracia · ${metrics.suspendedClients.length} suspendidos`,
      icon: Building2,
    },
    {
      label: "Tenants activos",
      value: isTenantsFailed ? "No disponible" : String(metrics.activeTenants.length),
      detail: isTenantsFailed ? "Sincronización fallida" : `${metrics.suspendedTenants.length} suspendidos · ${metrics.tenantsNearLimit.length} cerca del límite`,
      icon: Network,
    },
    {
      label: "MRR estimado",
      value: (isClientsFailed || isInvoicesFailed) ? "No disponible" : formatCurrency(metrics.mrr),
      detail: (isClientsFailed || isInvoicesFailed) ? "Sincronización fallida" : `ARR estimado: ${formatCurrency(metrics.arr)}`,
      icon: BadgeDollarSign,
    },
    {
      label: "Facturación mes",
      value: isInvoicesFailed ? "No disponible" : formatCurrency(metrics.monthlyBilling),
      detail: isInvoicesFailed ? "Sincronización fallida" : `Histórico: ${formatCurrency(metrics.annualBilling)}`,
      icon: CreditCard,
    },
    {
      label: "Pagos recibidos",
      value: (isPaymentsFailed || isInvoicesFailed) ? "No disponible" : formatCurrency(metrics.paymentsReceived),
      detail: (isPaymentsFailed || isInvoicesFailed) ? "Sincronización fallida" : `${metrics.pendingInvoices.length} facturas pendientes`,
      icon: ReceiptText,
    },
  ];
  
    return (
      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
  
          return (
            <article
              key={card.label}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <Icon className="h-5 w-5" />
              </div>
  
              <p className="text-sm text-slate-400">{card.label}</p>
  
              <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
  
              <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
            </article>
          );
        })}
      </section>
    );
  }