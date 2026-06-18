import { getInvoices } from "./platformBillingService";
import { getClients } from "./platformClientService";
import { getCommissions } from "./platformCommissionService";
import { getLeads } from "./platformLeadService";
import { getPayments } from "./platformPaymentService";
import { getTenants } from "./platformTenantService";

import type {
  ExecutiveReport,
  ExecutiveReportMetric,
  ExecutiveReportType,
} from "../types/executiveReport";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function todayLabel() {
  return new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

export async function buildExecutiveReport(
  type: ExecutiveReportType
): Promise<ExecutiveReport> {
  const [clients, tenants, invoices, payments, commissions, leads] =
    await Promise.all([
      getClients(),
      getTenants(),
      getInvoices(),
      getPayments(),
      getCommissions(),
      getLeads(),
    ]);

  const activeClients = clients.filter((client) => client.status === "ACTIVE");
  const suspendedClients = clients.filter(
    (client) => client.status === "SUSPENDED"
  );

  const activeTenants = tenants.filter((tenant) => tenant.status === "ACTIVE");
  const suspendedTenants = tenants.filter(
    (tenant) => tenant.status === "SUSPENDED"
  );

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

  const invoicesTotal = invoices.reduce(
    (total, invoice) => total + (invoice.total || 0),
    0
  );

  const paymentsTotal = payments.reduce(
    (total, payment) => total + (payment.amount || 0),
    0
  );

  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "PENDING"
  );

  const pendingCommissions = commissions.filter(
    (commission) => commission.status === "PENDING"
  );

  const paidCommissions = commissions.filter(
    (commission) => commission.status === "PAID"
  );

  const pendingCommissionsTotal = pendingCommissions.reduce(
    (total, commission) => total + (commission.commissionAmount || 0),
    0
  );

  const paidCommissionsTotal = paidCommissions.reduce(
    (total, commission) => total + (commission.commissionAmount || 0),
    0
  );

  const conversionRate =
    leads.length > 0
      ? Number(((wonLeads.length / leads.length) * 100).toFixed(1))
      : 0;

  const baseMetrics: ExecutiveReportMetric[] = [
    { label: "Clientes activos", value: String(activeClients.length) },
    { label: "Clientes suspendidos", value: String(suspendedClients.length) },
    { label: "Tenants activos", value: String(activeTenants.length) },
    { label: "Tenants suspendidos", value: String(suspendedTenants.length) },
    { label: "Pipeline comercial", value: formatCurrency(pipelineValue) },
    { label: "Valor ganado", value: formatCurrency(wonValue) },
    { label: "Facturación total", value: formatCurrency(invoicesTotal) },
    { label: "Pagos recibidos", value: formatCurrency(paymentsTotal) },
    {
      label: "Comisiones pendientes",
      value: formatCurrency(pendingCommissionsTotal),
    },
    {
      label: "Comisiones pagadas",
      value: formatCurrency(paidCommissionsTotal),
    },
  ];

  const reportMap: Record<ExecutiveReportType, ExecutiveReport> = {
    EXECUTIVE: {
      type,
      title: "Reporte Ejecutivo Aura",
      subtitle: "Resumen general de operación comercial, SaaS y financiera.",
      generatedAt: todayLabel(),
      metrics: baseMetrics,
      alerts: [
        `${pendingInvoices.length} facturas pendientes de pago.`,
        `${suspendedClients.length} clientes suspendidos.`,
        `${suspendedTenants.length} tenants suspendidos.`,
      ],
    },

    COMMERCIAL: {
      type,
      title: "Reporte Comercial Aura",
      subtitle: "Pipeline, oportunidades ganadas, perdidas y conversión.",
      generatedAt: todayLabel(),
      metrics: [
        { label: "Prospectos nuevos", value: String(newLeads.length) },
        { label: "Prospectos ganados", value: String(wonLeads.length) },
        { label: "Prospectos perdidos", value: String(lostLeads.length) },
        { label: "Valor pipeline", value: formatCurrency(pipelineValue) },
        { label: "Valor ganado", value: formatCurrency(wonValue) },
        { label: "Conversión", value: `${conversionRate}%` },
      ],
      alerts: [`${newLeads.length} prospectos nuevos requieren seguimiento.`],
    },

    SAAS: {
      type,
      title: "Reporte SaaS Aura",
      subtitle: "Tenants, licencias, estados de acceso y operación SaaS.",
      generatedAt: todayLabel(),
      metrics: [
        { label: "Tenants activos", value: String(activeTenants.length) },
        { label: "Tenants suspendidos", value: String(suspendedTenants.length) },
        { label: "Clientes activos", value: String(activeClients.length) },
        {
          label: "Clientes suspendidos",
          value: String(suspendedClients.length),
        },
      ],
      alerts: [`${suspendedTenants.length} tenants requieren revisión.`],
    },

    FINANCIAL: {
      type,
      title: "Reporte Financiero Aura",
      subtitle: "Facturación, pagos, comisiones, MRR y ARR estimado.",
      generatedAt: todayLabel(),
      metrics: [
        { label: "Facturación total", value: formatCurrency(invoicesTotal) },
        { label: "Pagos recibidos", value: formatCurrency(paymentsTotal) },
        { label: "Facturas pendientes", value: String(pendingInvoices.length) },
        {
          label: "Comisiones pendientes",
          value: formatCurrency(pendingCommissionsTotal),
        },
        {
          label: "Comisiones pagadas",
          value: formatCurrency(paidCommissionsTotal),
        },
      ],
      alerts: [`${pendingInvoices.length} facturas pendientes de pago.`],
    },
  };

  return reportMap[type];
}