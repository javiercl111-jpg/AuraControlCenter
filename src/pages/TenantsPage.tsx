import { useEffect, useState } from "react";

import {
  calculateClientLicenseStatus,
  getLicenseStatusLabel,
} from "../services/licenseStatusEngine";
import { getClients } from "../services/platformClientService";
import {
  createTenantFromClient,
  getTenants,
  syncTenantFromClientStatus,
  updateTenantStatus,
} from "../services/platformTenantService";

import type { PlatformClient } from "../types/platformClient";
import type { PlatformTenant, TenantStatus } from "../types/platformTenant";

function getTenantStatusLabel(status: TenantStatus): string {
  return getLicenseStatusLabel(status);
}

export default function TenantsPage() {
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadData() {
    try {
      setError("");

      const [clientsData, tenantsData] = await Promise.all([
        getClients(),
        getTenants(),
      ]);

      setClients(clientsData);
      setTenants(tenantsData);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información de tenants.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateTenant(client: PlatformClient) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await createTenantFromClient({
        clientId: client.id,
        companyName: client.companyName,
        tradeName: client.tradeName,
        status: client.status,
        licenseStatus: client.status,
        enabledModules: client.enabledModules,
      });

      setSuccessMessage("Tenant creado correctamente.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudo crear el tenant.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSyncTenants() {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const clientsWithTenant = clients.filter((client) => client.tenantId);

      await Promise.all(
        clientsWithTenant.map((client) => {
          const calculatedStatus = calculateClientLicenseStatus(client);

          return syncTenantFromClientStatus({
            tenantDocumentId: client.tenantId,
            clientStatus: calculatedStatus,
          });
        })
      );

      setSuccessMessage(
        `Sincronización completada. Tenants sincronizados: ${clientsWithTenant.length}.`
      );

      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudieron sincronizar los tenants.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateTenantStatus(
    tenantId: string,
    status: TenantStatus
  ) {
    const suspendedReason =
      status === "SUSPENDED"
        ? window.prompt("Motivo de suspensión") || "Suspensión manual"
        : "";

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await updateTenantStatus(tenantId, status, suspendedReason);
      setSuccessMessage("Tenant actualizado correctamente.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar el tenant.");
    } finally {
      setIsLoading(false);
    }
  }

  const clientsWithoutTenant = clients.filter((client) => !client.tenantId);

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Tenant Control
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Control de tenants
        </h1>

        <p className="mt-3 text-slate-400">
          Administra el acceso SaaS de clientes al ecosistema Aura.
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
              Automatización de tenants
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Sincroniza el estado del tenant con el estado calculado de la
              licencia del cliente.
            </p>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleSyncTenants}
            className="rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Sincronizando..." : "Sincronizar tenants"}
          </button>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Crear tenants pendientes
        </h2>

        <div className="space-y-3">
          {clientsWithoutTenant.map((client) => (
            <article
              key={client.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-800 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h3 className="font-bold text-white">{client.companyName}</h3>
                <p className="text-sm text-slate-400">{client.tradeName}</p>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleCreateTenant(client)}
                className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
              >
                Crear Tenant
              </button>
            </article>
          ))}

          {!clientsWithoutTenant.length && (
            <p className="text-slate-500">
              No hay clientes pendientes de tenant.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Tenants existentes
        </h2>

        <div className="space-y-3">
          {tenants.map((tenant) => (
            <article
              key={tenant.id}
              className="rounded-2xl border border-slate-800 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-white">
                    {tenant.companyName}
                  </h3>

                  <p className="text-sm text-slate-400">{tenant.tradeName}</p>

                  <p className="mt-1 text-xs text-slate-500">
                    Tenant ID: {tenant.tenantId}
                  </p>
                </div>

                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {getTenantStatusLabel(tenant.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-cyan-300">
                  Licencia: {getTenantStatusLabel(tenant.licenseStatus)}
                </span>

                {tenant.enabledModules?.map((moduleCode) => (
                  <span
                    key={moduleCode}
                    className="rounded-full bg-slate-800 px-3 py-1 text-slate-300"
                  >
                    {moduleCode}
                  </span>
                ))}
              </div>

              {tenant.suspendedReason && (
                <p className="mt-3 text-xs text-yellow-200">
                  Motivo: {tenant.suspendedReason}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleUpdateTenantStatus(tenant.id, "ACTIVE")}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
                >
                  Activar
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() =>
                    handleUpdateTenantStatus(tenant.id, "GRACE_PERIOD")
                  }
                  className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-400/20 disabled:opacity-60"
                >
                  Gracia
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() =>
                    handleUpdateTenantStatus(tenant.id, "SUSPENDED")
                  }
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
                >
                  Suspender
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() =>
                    handleUpdateTenantStatus(tenant.id, "CANCELLED")
                  }
                  className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </article>
          ))}

          {!tenants.length && (
            <p className="text-slate-500">No existen tenants registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}