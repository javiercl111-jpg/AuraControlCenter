import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  BILLING_CYCLE_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  MODULE_OPTIONS,
  PLAN_OPTIONS,
} from "../constants/clientOptions";

import {
  createClient,
  deleteClient,
  getClients,
} from "../services/platformClientService";

import type {
  AuraModuleCode,
  BillingCycle,
  ClientFiscalData,
  ClientStatus,
  PlatformClient,
} from "../types/platformClient";

function getLicenseLabel(status: ClientStatus) {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "GRACE_PERIOD":
      return "Periodo de gracia";
    case "SUSPENDED":
      return "Suspendida";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}

const emptyFiscalData: ClientFiscalData = {
  legalName: "",
  rfc: "",
  taxRegime: "",
  cfdiUse: "",
  fiscalZipCode: "",
  billingEmail: "",
  billingContactName: "",
  billingPhone: "",
  billingNotes: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<PlatformClient[]>([]);

  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [planCode, setPlanCode] = useState("HCM_PROFESSIONAL");

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [status, setStatus] = useState<ClientStatus>("ACTIVE");

  const [enabledModules, setEnabledModules] = useState<AuraModuleCode[]>([
    "AURA_HCM",
  ]);

  const [fiscalData, setFiscalData] =
    useState<ClientFiscalData>(emptyFiscalData);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadClients() {
    try {
      setError("");
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los clientes.");
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  function updateFiscalData<K extends keyof ClientFiscalData>(
    field: K,
    value: ClientFiscalData[K]
  ) {
    setFiscalData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleModule(moduleCode: AuraModuleCode) {
    setEnabledModules((currentModules) => {
      if (currentModules.includes(moduleCode)) {
        return currentModules.filter((item) => item !== moduleCode);
      }

      return [...currentModules, moduleCode];
    });
  }

  async function handleDeleteClient(clientId: string, companyName: string) {
    const confirmed = window.confirm(`¿Eliminar cliente "${companyName}"?`);

    if (!confirmed) return;

    try {
      setError("");
      await deleteClient(clientId);
      await loadClients();
    } catch (err) {
      console.error(err);
      setError("No se pudo eliminar el cliente.");
    }
  }

  async function handleCreateClient() {
    if (!companyName.trim()) {
      setError("La razón social es obligatoria.");
      return;
    }

    if (!enabledModules.length) {
      setError("Selecciona al menos un ecosistema Aura.");
      return;
    }

    if (!fiscalData.legalName.trim()) {
      setError("La razón social fiscal es obligatoria.");
      return;
    }

    if (!fiscalData.rfc.trim()) {
      setError("El RFC es obligatorio.");
      return;
    }

    if (!fiscalData.fiscalZipCode.trim()) {
      setError("El código postal fiscal es obligatorio.");
      return;
    }

    if (!fiscalData.billingEmail.trim()) {
      setError("El correo de facturación es obligatorio.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await createClient({
        companyName: companyName.trim(),
        tradeName: tradeName.trim() || companyName.trim(),
        planCode,
        billingCycle,
        status,
        enabledModules,
        fiscalData: {
          legalName: fiscalData.legalName.trim(),
          rfc: fiscalData.rfc.trim().toUpperCase(),
          taxRegime: fiscalData.taxRegime.trim(),
          cfdiUse: fiscalData.cfdiUse.trim(),
          fiscalZipCode: fiscalData.fiscalZipCode.trim(),
          billingEmail: fiscalData.billingEmail.trim(),
          billingContactName: fiscalData.billingContactName.trim(),
          billingPhone: fiscalData.billingPhone.trim(),
          billingNotes: fiscalData.billingNotes.trim(),
        },
      });

      setCompanyName("");
      setTradeName("");
      setPlanCode("HCM_PROFESSIONAL");
      setBillingCycle("MONTHLY");
      setStatus("ACTIVE");
      setEnabledModules(["AURA_HCM"]);
      setFiscalData(emptyFiscalData);

      await loadClients();
    } catch (err) {
      console.error(err);
      setError("No se pudo crear el cliente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white">Clientes</h1>
        <p className="mt-3 text-slate-400">
          Alta inicial de clientes, datos fiscales, plan contratado, ciclo de
          facturación, ecosistemas habilitados y vigencia de licencia.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Crear Cliente</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Razón social interna"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={tradeName}
            onChange={(event) => setTradeName(event.target.value)}
            placeholder="Nombre comercial"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <select
            value={planCode}
            onChange={(event) => setPlanCode(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={billingCycle}
            onChange={(event) =>
              setBillingCycle(event.target.value as BillingCycle)
            }
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          >
            {BILLING_CYCLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ClientStatus)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          >
            {CLIENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
          <h3 className="mb-4 text-lg font-bold text-white">Datos fiscales</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={fiscalData.legalName}
              onChange={(event) =>
                updateFiscalData("legalName", event.target.value)
              }
              placeholder="Razón social fiscal"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={fiscalData.rfc}
              onChange={(event) => updateFiscalData("rfc", event.target.value)}
              placeholder="RFC"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white outline-none focus:border-cyan-300"
            />

            <input
              value={fiscalData.taxRegime}
              onChange={(event) =>
                updateFiscalData("taxRegime", event.target.value)
              }
              placeholder="Régimen fiscal"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={fiscalData.cfdiUse}
              onChange={(event) =>
                updateFiscalData("cfdiUse", event.target.value)
              }
              placeholder="Uso CFDI"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={fiscalData.fiscalZipCode}
              onChange={(event) =>
                updateFiscalData("fiscalZipCode", event.target.value)
              }
              placeholder="Código postal fiscal"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={fiscalData.billingEmail}
              onChange={(event) =>
                updateFiscalData("billingEmail", event.target.value)
              }
              placeholder="Correo de facturación"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={fiscalData.billingContactName}
              onChange={(event) =>
                updateFiscalData("billingContactName", event.target.value)
              }
              placeholder="Contacto de facturación"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={fiscalData.billingPhone}
              onChange={(event) =>
                updateFiscalData("billingPhone", event.target.value)
              }
              placeholder="Teléfono de facturación"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </div>

          <textarea
            value={fiscalData.billingNotes}
            onChange={(event) =>
              updateFiscalData("billingNotes", event.target.value)
            }
            placeholder="Notas de facturación"
            rows={3}
            className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">
            Ecosistemas contratados
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {MODULE_OPTIONS.map((module) => {
              const checked = enabledModules.includes(module.value);

              return (
                <button
                  key={module.value}
                  type="button"
                  onClick={() => toggleModule(module.value)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                    checked
                      ? "border-cyan-300 bg-cyan-400/10 text-cyan-200"
                      : "border-slate-700 bg-slate-950 text-slate-400 hover:border-cyan-400/50",
                  ].join(" ")}
                >
                  {module.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleCreateClient}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Guardando..." : "Crear Cliente"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Clientes Registrados
        </h2>

        <div className="space-y-3">
          {clients.map((client) => (
            <article
              key={client.id}
              className="rounded-2xl border border-slate-800 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-white">
                    {client.companyName}
                  </h3>
                  <p className="text-sm text-slate-400">{client.tradeName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    RFC: {client.fiscalData?.rfc || "Sin RFC"}
                  </p>
                </div>

                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {getLicenseLabel(client.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Inicio</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {client.startDate || "Sin fecha"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Renovación</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {client.renewalDate || "Sin fecha"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Gracia hasta</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {client.graceUntil || "Sin fecha"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-cyan-300">
                  {client.planCode}
                </span>

                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                  {client.billingCycle}
                </span>

                {client.enabledModules?.map((moduleCode) => (
                  <span
                    key={moduleCode}
                    className="rounded-full bg-slate-800 px-3 py-1 text-slate-300"
                  >
                    {moduleCode}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  to={`/clients/${client.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  <Eye className="h-4 w-4" />
                  Ver Cliente
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    handleDeleteClient(client.id, client.companyName)
                  }
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}

          {!clients.length && (
            <p className="text-slate-500">No existen clientes registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}