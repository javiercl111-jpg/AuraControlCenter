import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  BILLING_CYCLE_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  MODULE_OPTIONS,
  PLAN_OPTIONS,
} from "../constants/clientOptions";

import {
  CFDI_PAYMENT_FORM_OPTIONS,
  CFDI_PAYMENT_METHOD_OPTIONS,
  CFDI_USE_OPTIONS,
  TAX_REGIME_OPTIONS,
} from "../constants/fiscalCatalogs";

import { getClientById } from "../services/platformClientDetailService";
import { updateClient } from "../services/platformClientUpdateService";

import type {
  AuraModuleCode,
  BillingCycle,
  CfdiPaymentMethod,
  ClientFiscalData,
  ClientStatus,
  PlatformClient,
} from "../types/platformClient";

const emptyFiscalData: ClientFiscalData = {
  legalName: "",
  rfc: "",
  taxRegime: "",
  cfdiUse: "",
  paymentMethod: "PPD",
  paymentForm: "99",
  fiscalZipCode: "",
  billingEmail: "",
  billingContactName: "",
  billingPhone: "",
  billingNotes: "",
};

export default function ClientEditPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState<PlatformClient | null>(null);

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

  const [startDate, setStartDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [graceUntil, setGraceUntil] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadClient() {
      if (!clientId) {
        setError("Cliente no válido.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getClientById(clientId);

        if (!data) {
          setError("No se encontró el cliente.");
          return;
        }

        setClient(data);
        setCompanyName(data.companyName || "");
        setTradeName(data.tradeName || "");
        setPlanCode(data.planCode || "HCM_PROFESSIONAL");
        setBillingCycle(data.billingCycle || "MONTHLY");
        setStatus(data.status || "ACTIVE");
        setEnabledModules(data.enabledModules || ["AURA_HCM"]);
        setFiscalData({
          ...emptyFiscalData,
          ...(data.fiscalData || {}),
          paymentForm:
            data.fiscalData?.paymentMethod === "PPD"
              ? "99"
              : data.fiscalData?.paymentForm || "99",
        });
        setStartDate(data.startDate || "");
        setRenewalDate(data.renewalDate || "");
        setGraceUntil(data.graceUntil || "");
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar el cliente.");
      } finally {
        setIsLoading(false);
      }
    }

    loadClient();
  }, [clientId]);

  function updateFiscalData<K extends keyof ClientFiscalData>(
    field: K,
    value: ClientFiscalData[K]
  ) {
    setFiscalData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePaymentMethodChange(value: CfdiPaymentMethod) {
    setFiscalData((current) => ({
      ...current,
      paymentMethod: value,
      paymentForm: value === "PPD" ? "99" : current.paymentForm,
    }));
  }

  function toggleModule(moduleCode: AuraModuleCode) {
    setEnabledModules((currentModules) =>
      currentModules.includes(moduleCode)
        ? currentModules.filter((item) => item !== moduleCode)
        : [...currentModules, moduleCode]
    );
  }

  async function handleSave() {
    if (!clientId || !client) return;

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

    if (!fiscalData.taxRegime.trim()) {
      setError("El régimen fiscal es obligatorio.");
      return;
    }

    if (!fiscalData.cfdiUse.trim()) {
      setError("El uso CFDI es obligatorio.");
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

    setIsSaving(true);
    setError("");

    try {
      await updateClient(clientId, {
        companyName: companyName.trim(),
        tradeName: tradeName.trim() || companyName.trim(),
        status,
        planCode,
        billingCycle,
        enabledModules,
        fiscalData: {
          legalName: fiscalData.legalName.trim(),
          rfc: fiscalData.rfc.trim().toUpperCase(),
          taxRegime: fiscalData.taxRegime,
          cfdiUse: fiscalData.cfdiUse,
          paymentMethod: fiscalData.paymentMethod,
          paymentForm:
            fiscalData.paymentMethod === "PPD" ? "99" : fiscalData.paymentForm,
          fiscalZipCode: fiscalData.fiscalZipCode.trim(),
          billingEmail: fiscalData.billingEmail.trim(),
          billingContactName: fiscalData.billingContactName.trim(),
          billingPhone: fiscalData.billingPhone.trim(),
          billingNotes: fiscalData.billingNotes.trim(),
        },
        startDate,
        renewalDate,
        graceUntil,
      });

      navigate(`/clients/${clientId}`, { replace: true });
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar el cliente.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Cargando editor...
      </div>
    );
  }

  if (error && !client) {
    return (
      <div>
        <Link
          to="/clients"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>

        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        to={clientId ? `/clients/${clientId}` : "/clients"}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al detalle
      </Link>

      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Editar Cliente
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          {companyName || "Cliente"}
        </h1>

        <p className="mt-3 text-slate-400">
          Actualiza datos generales, licencia, ecosistemas y datos fiscales.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
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

          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            type="date"
            value={renewalDate}
            onChange={(event) => setRenewalDate(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            type="date"
            value={graceUntil}
            onChange={(event) => setGraceUntil(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
          <h2 className="mb-4 text-lg font-bold text-white">
            Datos fiscales CFDI
          </h2>

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

            <select
              value={fiscalData.taxRegime}
              onChange={(event) =>
                updateFiscalData("taxRegime", event.target.value)
              }
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            >
              <option value="">Selecciona régimen fiscal</option>
              {TAX_REGIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={fiscalData.cfdiUse}
              onChange={(event) =>
                updateFiscalData("cfdiUse", event.target.value)
              }
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            >
              <option value="">Selecciona uso CFDI</option>
              {CFDI_USE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={fiscalData.paymentMethod}
              onChange={(event) =>
                handlePaymentMethodChange(
                  event.target.value as CfdiPaymentMethod
                )
              }
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            >
              {CFDI_PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={fiscalData.paymentForm}
              onChange={(event) =>
                updateFiscalData("paymentForm", event.target.value)
              }
              disabled={fiscalData.paymentMethod === "PPD"}
              className={[
                "rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300",
                fiscalData.paymentMethod === "PPD"
                  ? "cursor-not-allowed opacity-60"
                  : "",
              ].join(" ")}
            >
              {CFDI_PAYMENT_FORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {fiscalData.paymentMethod === "PPD" && (
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
              Método PPD seleccionado: la forma de pago queda bloqueada
              automáticamente como 99 - Por definir.
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
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

        <div className="mt-6">
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
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </section>
    </div>
  );
}