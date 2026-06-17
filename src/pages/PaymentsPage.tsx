import { useEffect, useState } from "react";

import { getInvoices } from "../services/platformBillingService";
import {
  getPayments,
  registerInvoicePayment,
} from "../services/platformPaymentService";
import type { PlatformInvoice } from "../types/platformInvoice";
import type { PaymentMethod, PlatformPayment } from "../types/platformPayment";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);

  const [invoiceId, setInvoiceId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFER");
  const [paymentDate, setPaymentDate] = useState(todayInputValue());
  const [reference, setReference] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadData() {
    try {
      setError("");

      const [invoiceData, paymentData] = await Promise.all([
        getInvoices(),
        getPayments(),
      ]);

      setInvoices(invoiceData);
      setPayments(paymentData);

      const firstPending = invoiceData.find(
        (invoice) => invoice.status === "PENDING"
      );

      if (!invoiceId && firstPending) {
        setInvoiceId(firstPending.id);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información de pagos.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "PENDING"
  );

  const selectedInvoice = invoices.find((invoice) => invoice.id === invoiceId);

  async function handleRegisterPayment() {
    if (!selectedInvoice) {
      setError("Selecciona una factura pendiente.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await registerInvoicePayment({
        invoiceId: selectedInvoice.id,
        clientId: selectedInvoice.clientId,
        clientName: selectedInvoice.clientName,
        invoiceNumber: selectedInvoice.invoiceNumber,
        amount: selectedInvoice.total,
        paymentMethod,
        paymentDate,
        reference: reference.trim(),
      });

      setReference("");
      setPaymentMethod("TRANSFER");
      setPaymentDate(todayInputValue());
      setInvoiceId("");

      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el pago.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Payment Engine
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Registro de pagos
        </h1>

        <p className="mt-3 text-slate-400">
          Registro administrativo de pagos recibidos por transferencia, SPEI,
          depósito u otro medio. Al registrar el pago, la factura queda marcada
          como pagada.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Registrar pago</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          >
            <option value="">Selecciona factura pendiente</option>
            {pendingInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} — {invoice.clientName} —{" "}
                {formatCurrency(invoice.total)}
              </option>
            ))}
          </select>

          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as PaymentMethod)
            }
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          >
            <option value="TRANSFER">Transferencia</option>
            <option value="SPEI">SPEI</option>
            <option value="DEPOSIT">Depósito</option>
            <option value="OTHER">Otro</option>
          </select>

          <input
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Referencia / comprobante"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-500">Monto a registrar</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {selectedInvoice ? formatCurrency(selectedInvoice.total) : "$0.00"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRegisterPayment}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Registrando..." : "Registrar Pago"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Historial de pagos
        </h2>

        <div className="space-y-3">
          {payments.map((payment) => (
            <article
              key={payment.id}
              className="rounded-2xl border border-slate-800 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-white">
                    {payment.invoiceNumber}
                  </h3>

                  <p className="text-sm text-slate-400">
                    {payment.clientName}
                  </p>
                </div>

                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {payment.paymentMethod}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Monto</p>
                  <p className="mt-1 text-sm font-bold text-cyan-300">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Fecha</p>
                  <p className="mt-1 text-sm text-white">
                    {payment.paymentDate}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Referencia</p>
                  <p className="mt-1 text-sm text-white">
                    {payment.reference || "Sin referencia"}
                  </p>
                </div>
              </div>
            </article>
          ))}

          {!payments.length && (
            <p className="text-slate-500">No existen pagos registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}