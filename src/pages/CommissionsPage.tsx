import { useEffect, useState } from "react";

import {
  getCommissions,
  updateCommissionStatus,
} from "../services/platformCommissionService";
import type {
  CommissionStatus,
  PlatformCommission,
} from "../types/platformCommission";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function getCommissionStatusLabel(status: CommissionStatus) {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "PAID":
      return "Pagada";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadCommissions() {
    try {
      setError("");
      const data = await getCommissions();
      setCommissions(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las comisiones.");
    }
  }

  useEffect(() => {
    loadCommissions();
  }, []);

  async function handleUpdateStatus(
    commissionId: string,
    status: CommissionStatus
  ) {
    setIsLoading(true);
    setError("");

    try {
      await updateCommissionStatus(commissionId, status);
      await loadCommissions();
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar la comisión.");
    } finally {
      setIsLoading(false);
    }
  }

  const pendingCommissions = commissions.filter(
    (commission) => commission.status === "PENDING"
  );

  const paidCommissions = commissions.filter(
    (commission) => commission.status === "PAID"
  );

  const pendingTotal = pendingCommissions.reduce(
    (total, commission) => total + commission.commissionAmount,
    0
  );

  const paidTotal = paidCommissions.reduce(
    (total, commission) => total + commission.commissionAmount,
    0
  );

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Commission Engine
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Comisiones comerciales
        </h1>

        <p className="mt-3 text-slate-400">
          Calcula comisiones a partir de facturas pagadas. Base inicial:
          10% primer año y 5% renovaciones.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm text-slate-400">Comisiones pendientes</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {pendingCommissions.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-cyan-300">
            {formatCurrency(pendingTotal)}
          </p>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm text-slate-400">Comisiones pagadas</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {paidCommissions.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-cyan-300">
            {formatCurrency(paidTotal)}
          </p>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm text-slate-400">Total histórico</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {commissions.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-cyan-300">
            {formatCurrency(pendingTotal + paidTotal)}
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Comisiones registradas
        </h2>

        <div className="space-y-3">
          {commissions.map((commission) => (
            <article
              key={commission.id}
              className="rounded-2xl border border-slate-800 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-white">
                    {commission.invoiceNumber}
                  </h3>

                  <p className="text-sm text-slate-400">
                    {commission.clientName}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Asesor: {commission.advisorName}
                  </p>
                </div>

                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {getCommissionStatusLabel(commission.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Factura</p>
                  <p className="mt-1 text-sm text-white">
                    {formatCurrency(commission.invoiceAmount)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Tipo</p>
                  <p className="mt-1 text-sm text-white">
                    {commission.commissionType === "FIRST_YEAR"
                      ? "Primer año"
                      : "Renovación"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Porcentaje</p>
                  <p className="mt-1 text-sm text-white">
                    {(commission.commissionRate * 100).toFixed(0)}%
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Comisión</p>
                  <p className="mt-1 text-sm font-bold text-cyan-300">
                    {formatCurrency(commission.commissionAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {commission.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleUpdateStatus(commission.id, "PAID")}
                    className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
                  >
                    Marcar pagada
                  </button>
                )}

                {commission.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      handleUpdateStatus(commission.id, "CANCELLED")
                    }
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </article>
          ))}

          {!commissions.length && (
            <p className="text-slate-500">
              No existen comisiones registradas. Se crearán automáticamente al
              registrar pagos.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}