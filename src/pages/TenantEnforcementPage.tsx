import { useEffect, useState } from "react";

import {
  getTenantAccessPolicy,
  saveTenantAccessPolicy,
} from "../services/tenantAccessPolicyService";
import { getTenants } from "../services/platformTenantService";
import { evaluateUsageLimit } from "../services/usageLimitsService";
import type { TenantAccessPolicy } from "../types/tenantAccessPolicy";
import type { PlatformTenant, TenantStatus } from "../types/platformTenant";

const tenantStatuses: TenantStatus[] = [
  "ACTIVE",
  "GRACE_PERIOD",
  "SUSPENDED",
  "CANCELLED",
];

function getStatusLabel(status: TenantStatus) {
  switch (status) {
    case "ACTIVE":
      return "Activo";
    case "GRACE_PERIOD":
      return "Periodo de gracia";
    case "SUSPENDED":
      return "Suspendido";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}

function getUsageBadgeClass(status: string) {
  if (status === "EXCEEDED" || status === "LIMIT_REACHED") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (status === "WARNING") {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  }

  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
}

export default function TenantEnforcementPage() {
  const [policy, setPolicy] = useState<TenantAccessPolicy | null>(null);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    try {
      setError("");

      const [policyData, tenantsData] = await Promise.all([
        getTenantAccessPolicy(),
        getTenants(),
      ]);

      setPolicy(policyData);
      setTenants(tenantsData);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar Tenant Enforcement.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateRule(
    status: TenantStatus,
    field: "allowed" | "showBanner" | "showBlockedScreen" | "message",
    value: boolean | string
  ) {
    if (!policy) return;

    setPolicy({
      ...policy,
      rules: policy.rules.map((rule) =>
        rule.status === status
          ? {
              ...rule,
              [field]: value,
            }
          : rule
      ),
    });
  }

  async function handleSavePolicy() {
    if (!policy) return;

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await saveTenantAccessPolicy({
        rules: policy.rules,
      });

      setSuccessMessage("Política de acceso guardada correctamente.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la política de acceso.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Cargando Tenant Enforcement...
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Tenant Enforcement
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Políticas de acceso y límites
        </h1>

        <p className="mt-3 text-slate-400">
          Define cómo deben comportarse los productos Aura según el estado del
          tenant y evalúa límites de uso como empleados activos contra el plan
          contratado.
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
        <h2 className="mb-5 text-xl font-bold text-white">
          Política global de acceso
        </h2>

        <div className="space-y-4">
          {tenantStatuses.map((status) => {
            const rule = policy?.rules.find((item) => item.status === status);

            if (!rule) return null;

            return (
              <article
                key={status}
                className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-bold text-white">
                      {getStatusLabel(status)}
                    </h3>
                    <p className="text-xs text-slate-500">{status}</p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      rule.allowed
                        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                        : "border-red-500/30 bg-red-500/10 text-red-300",
                    ].join(" ")}
                  >
                    {rule.allowed ? "Acceso permitido" : "Acceso bloqueado"}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                    <input
                      type="checkbox"
                      checked={rule.allowed}
                      onChange={(event) =>
                        updateRule(status, "allowed", event.target.checked)
                      }
                    />
                    <span className="text-sm text-slate-300">
                      Permitir acceso
                    </span>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                    <input
                      type="checkbox"
                      checked={rule.showBanner}
                      onChange={(event) =>
                        updateRule(status, "showBanner", event.target.checked)
                      }
                    />
                    <span className="text-sm text-slate-300">
                      Mostrar banner
                    </span>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                    <input
                      type="checkbox"
                      checked={rule.showBlockedScreen}
                      onChange={(event) =>
                        updateRule(
                          status,
                          "showBlockedScreen",
                          event.target.checked
                        )
                      }
                    />
                    <span className="text-sm text-slate-300">
                      Pantalla de bloqueo
                    </span>
                  </label>
                </div>

                <textarea
                  value={rule.message}
                  onChange={(event) =>
                    updateRule(status, "message", event.target.value)
                  }
                  rows={2}
                  className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </article>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSavePolicy}
          disabled={isSaving}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Guardando..." : "Guardar Política"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Límites de uso por tenant
        </h2>

        <div className="space-y-3">
          {tenants.map((tenant) => {
            const usage = evaluateUsageLimit({
              current: tenant.usage?.hcmActiveEmployees || 0,
              limit: tenant.usage?.hcmEmployeeLimit || 0,
              warningThreshold: tenant.usage?.hcmWarningThreshold || 80,
            });

            return (
              <article
                key={tenant.id}
                className="rounded-2xl border border-slate-800 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-bold text-white">
                      {tenant.companyName}
                    </h3>

                    <p className="text-sm text-slate-400">
                      {tenant.tradeName}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Tenant ID: {tenant.tenantId}
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      getUsageBadgeClass(usage.status),
                    ].join(" ")}
                  >
                    {usage.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">
                      Empleados activos HCM
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {usage.current}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Límite contratado</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {usage.limit || "Sin límite"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Uso</p>
                    <p className="mt-1 text-sm font-bold text-cyan-300">
                      {usage.percentage}%
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Umbral aviso</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {usage.warningThreshold}%
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">{usage.message}</p>
              </article>
            );
          })}

          {!tenants.length && (
            <p className="text-slate-500">No existen tenants registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}