import { useEffect, useState } from "react";

import { getClients } from "../services/platformClientService";
import {
  createInvoice,
  getInvoices,
} from "../services/platformBillingService";
import type { PlatformClient } from "../types/platformClient";
import type { PlatformInvoice } from "../types/platformInvoice";

const PLAN_PRICES: Record<string, number> = {
  HCM_BASIC: 2990,
  HCM_PROFESSIONAL: 7990,
  HCM_ENTERPRISE: 14990,
  MAINTENANCE_PILOT_STARTER: 2500,
  MAINTENANCE_PILOT_PROFESSIONAL: 5500,
  MAINTENANCE_PILOT_ENTERPRISE: 8500,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export default function BillingPage() {
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);

  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState(todayInputValue());
  const [periodEnd, setPeriodEnd] = useState(addMonths(todayInputValue(), 1));
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadData() {
    try {
      setError("");

      const [clientsData, invoicesData] = await Promise.all([
        getClients(),
        getInvoices(),
      ]);

      setClients(clientsData);
      setInvoices(invoicesData);

      if (!clientId && clientsData[0]) {
        setClientId(clientsData[0].id);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información de facturación.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedClient = clients.find((client) => client.id === clientId);

  const selectedSubtotal = selectedClient
    ? PLAN_PRICES[selectedClient.planCode] || 0
    : 0;

  const selectedIva = Number((selectedSubtotal * 0.16).toFixed(2));
  const selectedTotal = Number((selectedSubtotal + selectedIva).toFixed(2));

  async function handleCreateInvoice() {
    if (!selectedClient) {
      setError("Selecciona un cliente.");
      return;
    }

    if (!selectedSubtotal) {
      setError("El plan seleccionado no tiene precio configurado.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(
        invoices.length + 1
      ).padStart(6, "0")}`;

      await createInvoice({
        clientId: selectedClient.id,
        clientName: selectedClient.companyName,
        invoiceNumber,
        planCode: selectedClient.planCode,
        periodStart,
        periodEnd,
        subtotal: selectedSubtotal,
      });

      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudo generar la factura.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Billing Engine
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Facturación administrativa
        </h1>

        <p className="mt-3 text-slate-400">
          Generación inicial de facturas para clientes Aura. Los pagos serán
          registrados posteriormente por transferencia, SPEI o depósito.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Generar factura</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          >
            <option value="">Selecciona cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.companyName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={periodStart}
            onChange={(event) => {
              setPeriodStart(event.target.value);
              setPeriodEnd(addMonths(event.target.value, 1));
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs text-slate-500">Total estimado</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatCurrency(selectedTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Subtotal {formatCurrency(selectedSubtotal)} + IVA{" "}
              {formatCurrency(selectedIva)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateInvoice}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Generando..." : "Generar Factura"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Facturas generadas
        </h2>

        <div className="space-y-3">
          {invoices.map((invoice) => (
            <article
              key={invoice.id}
              className="rounded-2xl border border-slate-800 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-white">
                    {invoice.invoiceNumber}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {invoice.clientName}
                  </p>
                </div>

                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {invoice.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Periodo</p>
                  <p className="mt-1 text-sm text-white">
                    {invoice.periodStart} - {invoice.periodEnd}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Subtotal</p>
                  <p className="mt-1 text-sm text-white">
                    {formatCurrency(invoice.subtotal)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">IVA</p>
                  <p className="mt-1 text-sm text-white">
                    {formatCurrency(invoice.ivaAmount)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="mt-1 text-sm font-bold text-cyan-300">
                    {formatCurrency(invoice.total)}
                  </p>
                </div>
              </div>
            </article>
          ))}

          {!invoices.length && (
            <p className="text-slate-500">No existen facturas generadas.</p>
          )}
        </div>
      </section>
    </div>
  );
}