import { useEffect, useState } from "react";

import {
  buildMissingLicenseDates,
  calculateClientLicenseStatus,
  getLicenseStatusLabel,
} from "../services/licenseStatusEngine";
import { getClients } from "../services/platformClientService";
import { evaluateClientAndSyncTenant } from "../services/tenantAutomationService";
import type { PlatformClient } from "../types/platformClient";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LicenseManagementPage() {
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  async function loadClients() {
    try {
      setError("");
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las licencias.");
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function handleEvaluateLicenses() {
    setIsProcessing(true);
    setError("");
    setSuccessMessage("");

    try {
      const results = await Promise.all(
        clients.map((client) => evaluateClientAndSyncTenant(client))
      );

      const updatedCount = results.filter((result) => result.updated).length;

      setSuccessMessage(
        `Evaluación completada. Clientes actualizados: ${updatedCount}. Tenants sincronizados: ${results.length}.`
      );

      await loadClients();
    } catch (err) {
      console.error(err);
      setError("No se pudieron evaluar las licencias.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          License Engine
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Gestión de licencias
        </h1>

        <p className="mt-3 text-slate-400">
          Evalúa automáticamente si los clientes deben permanecer activos,
          entrar a periodo de gracia o quedar suspendidos según sus fechas de
          renovación y gracia. También sincroniza el estado del tenant asociado.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
          {successMessage}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Evaluación de licencias y tenants
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Fecha de evaluación: {todayInputValue()}
            </p>
          </div>

          <button
            type="button"
            onClick={handleEvaluateLicenses}
            disabled={isProcessing}
            className="rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? "Evaluando..." : "Evaluar Licencias"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Estado de clientes
        </h2>

        <div className="space-y-3">
          {clients.map((client) => {
            const calculatedStatus = calculateClientLicenseStatus(client);
            const dates = buildMissingLicenseDates(client);

            const needsUpdate =
              calculatedStatus !== client.status ||
              !client.startDate ||
              !client.renewalDate ||
              !client.graceUntil;

            return (
              <article
                key={client.id}
                className="rounded-2xl border border-slate-800 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-bold text-white">
                      {client.companyName}
                    </h3>

                    <p className="text-sm text-slate-400">
                      {client.tradeName}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Tenant: {client.tenantId || "Sin tenant"}
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      needsUpdate
                        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
                        : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
                    ].join(" ")}
                  >
                    {needsUpdate
                      ? `${getLicenseStatusLabel(
                          client.status
                        )} → ${getLicenseStatusLabel(calculatedStatus)}`
                      : getLicenseStatusLabel(client.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Renovación</p>
                    <p className="mt-1 text-sm text-white">
                      {client.renewalDate || dates.renewalDate}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Gracia hasta</p>
                    <p className="mt-1 text-sm text-white">
                      {client.graceUntil || dates.graceUntil}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Estado calculado</p>
                    <p className="mt-1 text-sm font-bold text-cyan-300">
                      {getLicenseStatusLabel(calculatedStatus)}
                    </p>
                  </div>
                </div>

                {needsUpdate && (
                  <p className="mt-3 text-xs text-yellow-200">
                    Pendiente de aplicar evaluación o reparar fechas faltantes.
                  </p>
                )}
              </article>
            );
          })}

          {!clients.length && (
            <p className="text-slate-500">No existen clientes registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}