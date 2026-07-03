import { useEffect, useMemo, useState } from "react";

import ExecutiveHeader from "../components/executive/ExecutiveHeader";
import ExecutiveKPIs from "../components/executive/ExecutiveKPIs";
import ExecutiveTabs from "../components/executive/ExecutiveTabs";

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

export interface ExecutiveMetrics {
  activeClients: PlatformClient[];
  graceClients: PlatformClient[];
  suspendedClients: PlatformClient[];
  cancelledClients: PlatformClient[];
  activeTenants: PlatformTenant[];
  suspendedTenants: PlatformTenant[];
  tenantsNearLimit: PlatformTenant[];
  newLeads: PlatformLead[];
  wonLeads: PlatformLead[];
  lostLeads: PlatformLead[];
  pipelineValue: number;
  wonValue: number;
  conversionRate: number;
  monthlyBilling: number;
  annualBilling: number;
  paidInvoices: PlatformInvoice[];
  pendingInvoices: PlatformInvoice[];
  paymentsReceived: number;
  pendingCommissions: PlatformCommission[];
  paidCommissions: PlatformCommission[];
  pendingCommissionAmount: number;
  paidCommissionAmount: number;
  mrr: number;
  arr: number;
}

export interface ExecutiveDashboardData {
  clients: PlatformClient[];
  tenants: PlatformTenant[];
  invoices: PlatformInvoice[];
  payments: PlatformPayment[];
  commissions: PlatformCommission[];
  leads: PlatformLead[];
  metrics: ExecutiveMetrics;
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
      setError("No se pudo cargar el Executive Center.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const metrics = useMemo<ExecutiveMetrics>(() => {
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
      leads.length > 0
        ? Number(((wonLeads.length / leads.length) * 100).toFixed(1))
        : 0;

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

  const dashboardData: ExecutiveDashboardData = {
    clients,
    tenants,
    invoices,
    payments,
    commissions,
    leads,
    metrics,
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Cargando Executive Center...
      </div>
    );
  }

  return (
    <div>
      <ExecutiveHeader data={dashboardData} />

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <ExecutiveKPIs metrics={metrics} />

      <ExecutiveTabs data={dashboardData} />
    </div>
  );
}