import { useEffect, useMemo, useState } from "react";

import {
  calculatePricingQuote,
  PRICING_MODULE_OPTIONS,
} from "../services/pricingEngineService";
import { downloadProposalPdf } from "../services/proposalPdfService";
import {
  acceptQuote,
  markQuoteAsSent,
  rejectQuote,
} from "../services/quoteLifecycleService";
import { createQuote, getQuotes } from "../services/quoteService";
import type { AuraModuleCode } from "../types/platformClient";
import type {
  FounderSetupDiscountMode,
  HcmMigrationType,
  ImplementationType,
  MaintenanceInitialLoadType,
  PlatformQuote,
  PricingQuoteInput,
  PricingQuoteResult,
  QuoteIndustry,
  QuoteStatus,
} from "../types/quote";

const INDUSTRY_OPTIONS: { value: QuoteIndustry; label: string }[] = [
  { value: "HOTELERIA", label: "Hotelería" },
  { value: "RESTAURANTES", label: "Restaurantes" },
  { value: "CORPORATIVO", label: "Corporativo" },
  { value: "HOSPITAL", label: "Hospitales" },
  { value: "RETAIL", label: "Retail" },
  { value: "MANUFACTURA", label: "Manufactura" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "EDUCACION", label: "Educación" },
  { value: "GOBIERNO", label: "Gobierno" },
  { value: "OTRO", label: "Otro" },
];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const className =
    status === "ACCEPTED"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : status === "REJECTED"
        ? "border-red-400/30 bg-red-400/10 text-red-200"
        : status === "SENT"
          ? "border-blue-400/30 bg-blue-400/10 text-blue-200"
          : status === "EXPIRED"
            ? "border-slate-500/30 bg-slate-500/10 text-slate-300"
            : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-xs font-semibold",
        className,
      ].join(" ")}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function PricingEnginePage() {
  const [prospectName, setProspectName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [industry, setIndustry] = useState<QuoteIndustry>("HOTELERIA");

  const [employeeCount, setEmployeeCount] = useState(350);
  const [locationCount, setLocationCount] = useState(8);
  const [companyCount, setCompanyCount] = useState(2);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(
    "MONTHLY"
  );

  const [applySpecialDiscount, setApplySpecialDiscount] = useState(false);
  const [specialDiscountPercent, setSpecialDiscountPercent] = useState(10);

  const [hcmMigrationType, setHcmMigrationType] =
    useState<HcmMigrationType>("EXTERNAL_SYSTEM");
  const [hcmImplementationType, setHcmImplementationType] =
    useState<ImplementationType>("HYBRID");
  const [hcmIntegrationCount, setHcmIntegrationCount] = useState(3);

  const [maintenanceAssetCount, setMaintenanceAssetCount] = useState(500);
  const [maintenanceTechnicianCount, setMaintenanceTechnicianCount] =
    useState(10);
  const [maintenanceInitialLoadType, setMaintenanceInitialLoadType] =
    useState<MaintenanceInitialLoadType>("EXCEL");
  const [maintenanceMassiveQr, setMaintenanceMassiveQr] = useState(false);

  const [founderClient, setFounderClient] = useState(false);
  const [founderSetupDiscountMode, setFounderSetupDiscountMode] =
    useState<FounderSetupDiscountMode>("NONE");

  const [selectedModules, setSelectedModules] = useState<AuraModuleCode[]>([
    "AURA_HCM",
    "AURA_MAINTENANCE",
    "AURA_SIGNATURE",
  ]);

  const [pricingMode, setPricingMode] = useState<"FOUNDER" | "DYNAMIC">("FOUNDER");
  const [quoteResult, setQuoteResult] = useState<PricingQuoteResult | null>(
    null
  );
  const [quotes, setQuotes] = useState<PlatformQuote[]>([]);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const quoteInput = useMemo<PricingQuoteInput>(
    () => ({
      prospectName,
      contactName,
      contactEmail,
      industry,
      employeeCount,
      locationCount,
      companyCount,
      selectedModules,
      billingCycle,
      applySpecialDiscount,
      specialDiscountPercent,
      hcmMigrationType,
      hcmImplementationType,
      hcmIntegrationCount,
      maintenanceAssetCount,
      maintenanceTechnicianCount,
      maintenanceInitialLoadType,
      maintenanceMassiveQr,
      founderClient,
      founderSetupDiscountMode,
      pricingMode,
    }),
    [
      prospectName,
      contactName,
      contactEmail,
      industry,
      employeeCount,
      locationCount,
      companyCount,
      selectedModules,
      billingCycle,
      applySpecialDiscount,
      specialDiscountPercent,
      hcmMigrationType,
      hcmImplementationType,
      hcmIntegrationCount,
      maintenanceAssetCount,
      maintenanceTechnicianCount,
      maintenanceInitialLoadType,
      maintenanceMassiveQr,
      founderClient,
      founderSetupDiscountMode,
      pricingMode,
    ]
  );

  async function loadQuotes() {
    try {
      const data = await getQuotes();
      setQuotes(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function calculateQuote(showSuccess = false) {
    setIsCalculating(true);
    setError("");

    try {
      const result = await calculatePricingQuote(quoteInput);
      setQuoteResult(result);

      if (showSuccess) {
        setSuccessMessage("Cotización recalculada correctamente.");
      }

      return result;
    } catch (err) {
      console.error(err);
      setQuoteResult(null);
      setError("No se pudo calcular la cotización.");
      return null;
    } finally {
      setIsCalculating(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function autoCalculateQuote() {
      setIsCalculating(true);
      setError("");

      try {
        const result = await calculatePricingQuote(quoteInput);

        if (active) {
          setQuoteResult(result);
        }
      } catch (err) {
        console.error(err);

        if (active) {
          setQuoteResult(null);
          setError("No se pudo calcular la cotización.");
        }
      } finally {
        if (active) {
          setIsCalculating(false);
        }
      }
    }

    autoCalculateQuote();

    return () => {
      active = false;
    };
  }, [quoteInput]);

  useEffect(() => {
    loadQuotes();
  }, []);

  function toggleModule(moduleCode: AuraModuleCode) {
    setSelectedModules((currentModules) => {
      if (moduleCode === "AURA_HCM") return currentModules;

      return currentModules.includes(moduleCode)
        ? currentModules.filter((item) => item !== moduleCode)
        : [...currentModules, moduleCode];
    });
  }

  async function handleGenerateQuote() {
    if (!prospectName.trim()) {
      setError("El nombre del prospecto o cliente es obligatorio.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      // Force recalculation using the most recent state
      const freshResult = await calculatePricingQuote(quoteInput);
      setQuoteResult(freshResult);

      // Validate calculated results before saving
      if (
        !freshResult.selectedModules ||
        freshResult.selectedModules.length === 0 ||
        freshResult.subtotal === undefined ||
        freshResult.subtotal === null ||
        freshResult.total === undefined ||
        freshResult.total === null ||
        freshResult.setupFeeBeforeDiscount === undefined ||
        freshResult.setupFeeBeforeDiscount === null ||
        freshResult.setupFee === undefined ||
        freshResult.setupFee === null ||
        freshResult.firstPaymentTotal === undefined ||
        freshResult.firstPaymentTotal === null ||
        freshResult.annualProjectedRevenue === undefined ||
        freshResult.annualProjectedRevenue === null
      ) {
        setError(
          "No se puede generar la propuesta comercial: la cotización calculada no contiene todos los campos financieros y de setup obligatorios."
        );
        setIsLoading(false);
        return;
      }

      await createQuote({
        input: quoteInput,
        result: freshResult,
      });

      setSuccessMessage("Propuesta comercial generada correctamente.");
      await loadQuotes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "No se pudo generar la propuesta comercial.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownloadPdf(quote: PlatformQuote) {
    setError("");

    try {
      await downloadProposalPdf(quote);
    } catch (err) {
      console.error(err);
      setError("No se pudo descargar el PDF de la propuesta.");
    }
  }

  async function handleMarkAsSent(quoteId: string) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await markQuoteAsSent(quoteId);
      setSuccessMessage("Propuesta marcada como enviada.");
      await loadQuotes();
    } catch (err) {
      console.error(err);
      setError("No se pudo marcar la propuesta como enviada.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAcceptQuote(quoteId: string) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await acceptQuote(quoteId);
      setSuccessMessage("Propuesta aceptada correctamente.");
      await loadQuotes();
    } catch (err) {
      console.error(err);
      setError("No se pudo aceptar la propuesta.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRejectQuote(quoteId: string) {
    const rejectionReason =
      window.prompt("Motivo de rechazo de la propuesta:") || "";

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await rejectQuote(quoteId, rejectionReason);
      setSuccessMessage("Propuesta rechazada correctamente.");
      await loadQuotes();
    } catch (err) {
      console.error(err);
      setError("No se pudo rechazar la propuesta.");
    } finally {
      setIsLoading(false);
    }
  }

  const discountLabel =
    quoteResult?.billingCycle === "YEARLY"
      ? `${quoteResult.discountPercent}%`
      : "No aplica";

  const hasHcm = selectedModules.includes("AURA_HCM");
  const hasMaintenance = selectedModules.includes("AURA_MAINTENANCE");

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Aura Pricing Engine
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Cotizador Comercial
        </h1>

        <p className="mt-3 text-slate-400">
          Motor oficial de precios, licenciamiento, límites contratados, setup y
          propuestas comerciales del ecosistema Aura.
        </p>

        {isCalculating && (
          <p className="mt-4 text-sm font-semibold text-cyan-200">
            Recalculando cotización...
          </p>
        )}
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

      <section className="mb-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="mb-5 text-xl font-bold text-white">
              Datos de cotización
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Prospecto / Cliente">
                <input
                  value={prospectName}
                  onChange={(event) => setProspectName(event.target.value)}
                  placeholder="Ej. Bice Vertical"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </FieldLabel>

              <FieldLabel label="Contacto principal">
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Nombre del contacto"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </FieldLabel>

              <FieldLabel label="Correo electrónico">
                <input
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="correo@empresa.com"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </FieldLabel>

              <FieldLabel label="Industria">
                <select
                  value={industry}
                  onChange={(event) =>
                    setIndustry(event.target.value as QuoteIndustry)
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Ciclo de facturación">
                <select
                  value={billingCycle}
                  onChange={(event) =>
                    setBillingCycle(event.target.value as "MONTHLY" | "YEARLY")
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="YEARLY">Anual — descuento estándar 10%</option>
                </select>
              </FieldLabel>

              <FieldLabel label="Número de empleados">
                <input
                  type="number"
                  min={1}
                  value={employeeCount}
                  onChange={(event) =>
                    setEmployeeCount(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </FieldLabel>

              <FieldLabel label="Número de ubicaciones / sucursales">
                <input
                  type="number"
                  min={1}
                  value={locationCount}
                  onChange={(event) =>
                    setLocationCount(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </FieldLabel>

              <FieldLabel label="Empresas legales">
                <input
                  type="number"
                  min={1}
                  value={companyCount}
                  onChange={(event) =>
                    setCompanyCount(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </FieldLabel>
            </div>

            {billingCycle === "YEARLY" && (
              <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                <label className="flex items-start gap-3 text-sm font-semibold text-yellow-100">
                  <input
                    type="checkbox"
                    checked={applySpecialDiscount}
                    onChange={(event) =>
                      setApplySpecialDiscount(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    Aplicar descuento especial autorizado
                    <span className="mt-1 block text-xs font-normal text-yellow-200/80">
                      El descuento anual estándar es 10%. El máximo permitido es
                      15%.
                    </span>
                  </span>
                </label>

                {applySpecialDiscount && (
                  <select
                    value={specialDiscountPercent}
                    onChange={(event) =>
                      setSpecialDiscountPercent(Number(event.target.value))
                    }
                    className="mt-4 w-full rounded-2xl border border-yellow-400/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-yellow-300 md:w-60"
                  >
                    <option value={5}>5%</option>
                    <option value={10}>10%</option>
                    <option value={15}>15%</option>
                  </select>
                )}
              </div>
            )}

            <div className="mt-6">
              <p className="mb-3 text-sm font-semibold text-slate-300">
                Productos Aura
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {PRICING_MODULE_OPTIONS.map((module) => {
                  const checked = selectedModules.includes(module.value);
                  const isBase = module.value === "AURA_HCM";

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
                      {isBase && (
                        <span className="ml-2 text-xs text-slate-500">
                          Base
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="mb-5 text-xl font-bold text-white">
              Setup e implementación
            </h2>

            <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950 p-4">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                Estrategia Comercial de Setup
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="FOUNDER"
                    checked={pricingMode === "FOUNDER"}
                    onChange={() => setPricingMode("FOUNDER")}
                    className="accent-cyan-400"
                  />
                  <span>Founder Pricing (Fijo preferencial)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="DYNAMIC"
                    checked={pricingMode === "DYNAMIC"}
                    onChange={() => setPricingMode("DYNAMIC")}
                    className="accent-cyan-400"
                  />
                  <span>Dynamic Complexity (Puntos)</span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Migración HCM">
                <select
                  value={hcmMigrationType}
                  disabled={!hasHcm}
                  onChange={(event) =>
                    setHcmMigrationType(event.target.value as HcmMigrationType)
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300 disabled:opacity-50"
                >
                  <option value="NONE">No</option>
                  <option value="SIMPLE_EXCEL">Excel simple</option>
                  <option value="EXTERNAL_SYSTEM">Sistema externo</option>
                  <option value="COMPLEX_SYSTEM">Sistema complejo</option>
                </select>
              </FieldLabel>

              <FieldLabel label="Tipo de implementación">
                <select
                  value={hcmImplementationType}
                  disabled={!hasHcm}
                  onChange={(event) =>
                    setHcmImplementationType(
                      event.target.value as ImplementationType
                    )
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300 disabled:opacity-50"
                >
                  <option value="REMOTE">Remota</option>
                  <option value="HYBRID">Híbrida</option>
                  <option value="ONSITE">Presencial</option>
                </select>
              </FieldLabel>

              <FieldLabel label="Número de integraciones">
                <input
                  type="number"
                  min={0}
                  value={hcmIntegrationCount}
                  disabled={!hasHcm}
                  onChange={(event) =>
                    setHcmIntegrationCount(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300 disabled:opacity-50"
                />
              </FieldLabel>

              <FieldLabel label="Activos Maintenance">
                <input
                  type="number"
                  min={0}
                  value={maintenanceAssetCount}
                  disabled={!hasMaintenance}
                  onChange={(event) =>
                    setMaintenanceAssetCount(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300 disabled:opacity-50"
                />
              </FieldLabel>

              <FieldLabel label="Técnicos Maintenance">
                <input
                  type="number"
                  min={0}
                  value={maintenanceTechnicianCount}
                  disabled={!hasMaintenance}
                  onChange={(event) =>
                    setMaintenanceTechnicianCount(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300 disabled:opacity-50"
                />
              </FieldLabel>

              <FieldLabel label="Carga inicial Maintenance">
                <select
                  value={maintenanceInitialLoadType}
                  disabled={!hasMaintenance}
                  onChange={(event) =>
                    setMaintenanceInitialLoadType(
                      event.target.value as MaintenanceInitialLoadType
                    )
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300 disabled:opacity-50"
                >
                  <option value="MANUAL">Manual</option>
                  <option value="EXCEL">Excel</option>
                  <option value="CMMS_MIGRATION">Migración CMMS</option>
                </select>
              </FieldLabel>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={maintenanceMassiveQr}
                  disabled={!hasMaintenance}
                  onChange={(event) =>
                    setMaintenanceMassiveQr(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  QR masivos para Maintenance
                  <span className="block text-xs text-slate-500">
                    Suma complejidad por generación e impresión masiva.
                  </span>
                </span>
              </label>

              {pricingMode === "DYNAMIC" ? (
                <label className="flex items-start gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                  <input
                    type="checkbox"
                    checked={founderClient}
                    onChange={(event) => {
                      setFounderClient(event.target.checked);
                      setFounderSetupDiscountMode(
                        event.target.checked ? "FIFTY_PERCENT" : "NONE"
                      );
                    }}
                    className="mt-1"
                  />
                  <span>
                    Cliente Fundador
                    <span className="block text-xs text-yellow-200/80">
                      Permite aplicar descuento especial sobre setup.
                    </span>
                  </span>
                </label>
              ) : (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-200">
                  <span className="font-bold block mb-1">Precio Preferencial Fundador Activo</span>
                  Aura aplica automáticamente tarifas preferenciales fijas de setup en este modo. No se requiere descuento adicional.
                </div>
              )}
            </div>

            {pricingMode === "DYNAMIC" && founderClient && (
              <div className="mt-4">
                <FieldLabel label="Descuento setup fundador">
                  <select
                    value={founderSetupDiscountMode}
                    onChange={(event) =>
                      setFounderSetupDiscountMode(
                        event.target.value as FounderSetupDiscountMode
                      )
                    }
                    className="w-full rounded-2xl border border-yellow-400/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-yellow-300 md:w-80"
                  >
                    <option value="FIFTY_PERCENT">50% descuento setup</option>
                    <option value="FREE">Setup sin costo</option>
                    <option value="NONE">Sin descuento</option>
                  </select>
                </FieldLabel>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={() => calculateQuote(true)}
                disabled={isCalculating || isLoading}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-bold text-cyan-200 disabled:opacity-60"
              >
                {isCalculating ? "Calculando..." : "Recalcular ahora"}
              </button>

              <button
                type="button"
                onClick={handleGenerateQuote}
                disabled={isCalculating || isLoading || !quoteResult}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
              >
                {isLoading ? "Generando..." : "Generar Propuesta Comercial"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-5 text-xl font-bold text-white">Resultado</h2>

          {quoteResult ? (
            <>
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                  Plan seleccionado
                </p>

                <p className="mt-2 text-3xl font-bold text-white">
                  {quoteResult.planName}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {quoteResult.employeeCount} empleados ·{" "}
                  {quoteResult.locationCount} ubicaciones ·{" "}
                  {quoteResult.companyCount} empresas
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Incluye {quoteResult.includedLocations} ubicaciones y{" "}
                  {quoteResult.includedCompanies} empresa legal.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {quoteResult.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-slate-950/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>

                    <p className="text-sm font-bold text-cyan-300">
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-slate-800 pt-5">
                {billingCycle === "YEARLY" && (
                  <>
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Subtotal anual antes de descuento</span>
                      <span>
                        {formatCurrency(
                          quoteResult.annualSubtotalBeforeDiscount
                        )}
                      </span>
                    </div>

                    <div className="mt-2 flex justify-between text-sm text-yellow-200">
                      <span>
                        Descuento anual ({quoteResult.discountPercent}%)
                      </span>
                      <span>-{formatCurrency(quoteResult.discountAmount)}</span>
                    </div>
                  </>
                )}

                <div className="mt-2 flex justify-between text-sm text-slate-400">
                  <span>Subtotal recurrente</span>
                  <span>{formatCurrency(quoteResult.subtotal)}</span>
                </div>

                <div className="mt-2 flex justify-between text-sm text-slate-400">
                  <span>IVA recurrente</span>
                  <span>{formatCurrency(quoteResult.ivaAmount)}</span>
                </div>

                <div className="mt-4 flex justify-between text-xl font-bold text-white">
                  <span>Total recurrente</span>
                  <span>{formatCurrency(quoteResult.total)}</span>
                </div>

                <p className="mt-2 text-right text-xs text-slate-500">
                  {billingCycle === "YEARLY" ? "MXN / año" : "MXN / mes"}
                </p>
              </div>

              <div className="mt-6 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5">
                <h3 className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-200">
                  Setup de implementación
                </h3>

                {quoteResult.pricingMode === "FOUNDER" ? (
                  <div className="mt-4 space-y-2 text-sm text-yellow-100">
                    <p>Tipo de cálculo: Founder Pricing (Tarifa Preferencial)</p>
                    {quoteResult.setupHcmTier && (
                      <p>Nivel HCM: {quoteResult.setupHcmTier} ({formatCurrency(quoteResult.setupHcmFee || 0)})</p>
                    )}
                    {quoteResult.setupMaintTier && (
                      <p>Nivel Maintenance: {quoteResult.setupMaintTier} ({formatCurrency(quoteResult.setupMaintFee || 0)})</p>
                    )}
                    <p className="text-base font-bold mt-2">
                      Setup final: {formatCurrency(quoteResult.setupFee)}
                    </p>
                    <p className="text-xs text-yellow-200/80 mt-1">
                      * Precio preferencial fundador aplicado.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2 text-sm text-yellow-100">
                    <p>Tipo de cálculo: {quoteResult.setupCalculationType}</p>
                    <p>
                      Puntos de complejidad:{" "}
                      {quoteResult.setupComplexityScore}
                    </p>
                    <p>
                      Setup antes de descuento:{" "}
                      {formatCurrency(quoteResult.setupFeeBeforeDiscount)}
                    </p>
                    <p>
                      Descuento setup: {quoteResult.setupDiscountPercent}% (
                      {formatCurrency(quoteResult.setupDiscountAmount)})
                    </p>
                    <p className="text-base font-bold">
                      Setup final: {formatCurrency(quoteResult.setupFee)}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {quoteResult.setupBreakdown.map((item) => (
                    <div
                      key={`${item.product}-${item.factor}`}
                      className="rounded-2xl border border-yellow-400/20 bg-slate-950/60 p-3 text-xs text-yellow-100"
                    >
                      <p className="font-semibold">{item.factor}</p>
                      <p className="text-yellow-200/80">
                        {item.product === "AURA_HCM" ? "HCM" : "Maintenance"}
                        {quoteResult.pricingMode === "DYNAMIC"
                          ? ` · ${item.score} pt${item.score === 1 ? "" : "s"} · ${formatCurrency(item.amount || item.score * (item.product === "AURA_HCM" ? 2500 : 2000))}`
                          : ` · ${formatCurrency(item.amount || 0)}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                <h3 className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-200">
                  Resumen comercial
                </h3>

                <div className="mt-4 space-y-2 text-sm text-emerald-100">
                  <p>Plan: {quoteResult.planName}</p>
                  <p>Industria: {industry}</p>
                  <p>
                    Facturación:{" "}
                    {billingCycle === "YEARLY" ? "Anual" : "Mensual"}
                  </p>
                  <p>Descuento aplicado: {discountLabel}</p>
                  <p>
                    Extras: {quoteResult.extraLocations} ubicaciones y{" "}
                    {quoteResult.extraCompanies} empresas adicionales.
                  </p>
                  <p>Productos: {quoteResult.selectedModules.join(", ")}</p>
                  <p>
                    Total primer pago:{" "}
                    <span className="font-bold">
                      {formatCurrency(quoteResult.firstPaymentTotal)}
                    </span>
                  </p>
                  <p>
                    Ingreso anual proyectado:{" "}
                    <span className="font-bold">
                      {formatCurrency(quoteResult.annualProjectedRevenue)}
                    </span>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-500">Calcula una cotización.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Propuestas generadas
        </h2>

        <div className="space-y-3">
          {quotes.map((quote) => {
            const isLegacy =
              quote.setupFee === undefined ||
              quote.setupBreakdown === undefined ||
              quote.annualProjectedRevenue === undefined;

            return (
              <article
                key={quote.id}
                className="rounded-2xl border border-slate-800 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-bold text-white flex flex-wrap items-center gap-2">
                      <span>{quote.folio}</span>
                      {quote.pricingMode === "FOUNDER" && (
                        <span className="rounded-full bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 text-[10px] text-cyan-200 font-semibold">
                          Founder Setup
                        </span>
                      )}
                      {quote.pricingMode === "DYNAMIC" && (
                        <span className="rounded-full bg-indigo-400/10 border border-indigo-400/30 px-2 py-0.5 text-[10px] text-indigo-200 font-semibold">
                          Dynamic Setup
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {quote.prospectName}
                    </p>
                  </div>

                  <QuoteStatusBadge status={quote.status} />
                </div>

                {isLegacy && (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Esta propuesta fue generada antes de la implementación del desglose avanzado de setup y costos de implementación.
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-6">
                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Plan</p>
                    <p className="mt-1 text-sm text-white">{quote.planName}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Empleados</p>
                    <p className="mt-1 text-sm text-white">
                      {quote.employeeCount}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Descuento</p>
                    <p className="mt-1 text-sm text-white">
                      {quote.discountPercent || 0}%
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Setup</p>
                    <p className="mt-1 text-sm text-white">
                      {formatCurrency(quote.setupFee || 0)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Vigencia</p>
                    <p className="mt-1 text-sm text-white">{quote.validUntil}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-500">Primer pago</p>
                    <p className="mt-1 text-sm font-bold text-cyan-300">
                      {formatCurrency(quote.firstPaymentTotal || quote.total)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(quote)}
                    className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20"
                  >
                    Descargar PDF
                  </button>

                  {quote.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsSent(quote.id)}
                      disabled={isLoading}
                      className="rounded-2xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm font-bold text-blue-200 transition hover:bg-blue-400/20 disabled:opacity-60"
                    >
                      Marcar enviada
                    </button>
                  )}

                  {quote.status === "SENT" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAcceptQuote(quote.id)}
                        disabled={isLoading}
                        className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-60"
                      >
                        Aceptar propuesta
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectQuote(quote.id)}
                        disabled={isLoading}
                        className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200 transition hover:bg-red-400/20 disabled:opacity-60"
                      >
                        Rechazar propuesta
                      </button>
                    </>
                  )}

                  {quote.status === "ACCEPTED" && (
                    <button
                      type="button"
                      disabled
                      className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200 opacity-80"
                    >
                      Provisionar Cliente — Próximo Sprint
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {!quotes.length && (
            <p className="text-slate-500">No existen propuestas generadas.</p>
          )}
        </div>
      </section>
    </div>
  );
}