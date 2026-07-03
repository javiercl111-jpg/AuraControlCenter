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