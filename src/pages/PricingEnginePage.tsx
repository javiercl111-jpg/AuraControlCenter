import { useEffect, useMemo, useState } from "react";

import {
  calculatePricingQuote,
  PRICING_MODULE_OPTIONS,
} from "../services/pricingEngineService";
import { createQuote, getQuotes } from "../services/quoteService";
import type { AuraModuleCode } from "../types/platformClient";
import type { PlatformQuote, PricingQuoteResult } from "../types/quote";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

export default function PricingEnginePage() {
  const [prospectName, setProspectName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [employeeCount, setEmployeeCount] = useState(350);
  const [locationCount, setLocationCount] = useState(8);
  const [companyCount, setCompanyCount] = useState(2);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(
    "MONTHLY"
  );
  const [selectedModules, setSelectedModules] = useState<AuraModuleCode[]>([
    "AURA_HCM",
    "AURA_MAINTENANCE",
    "AURA_SIGNATURE",
  ]);

  const [quoteResult, setQuoteResult] = useState<PricingQuoteResult | null>(
    null
  );
  const [quotes, setQuotes] = useState<PlatformQuote[]>([]);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const quoteInput = useMemo(
    () => ({
      prospectName,
      contactName,
      contactEmail,
      employeeCount,
      locationCount,
      companyCount,
      selectedModules,
      billingCycle,
    }),
    [
      prospectName,
      contactName,
      contactEmail,
      employeeCount,
      locationCount,
      companyCount,
      selectedModules,
      billingCycle,
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

  async function calculateQuote() {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await calculatePricingQuote(quoteInput);
      setQuoteResult(result);
    } catch (err) {
      console.error(err);
      setError("No se pudo calcular la cotización.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    calculateQuote();
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

    if (!quoteResult) {
      setError("Primero calcula la cotización.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await createQuote({
        input: quoteInput,
        result: quoteResult,
      });

      setSuccessMessage("Propuesta comercial generada correctamente.");
      await loadQuotes();
    } catch (err) {
      console.error(err);
      setError("No se pudo generar la propuesta comercial.");
    } finally {
      setIsLoading(false);
    }
  }

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
          Motor oficial de precios, licenciamiento, límites contratados y
          propuestas comerciales del ecosistema Aura.
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

      <section className="mb-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-5 text-xl font-bold text-white">
            Datos de cotización
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={prospectName}
              onChange={(event) => setProspectName(event.target.value)}
              placeholder="Prospecto / Cliente"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Contacto"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="Correo"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <select
              value={billingCycle}
              onChange={(event) =>
                setBillingCycle(event.target.value as "MONTHLY" | "YEARLY")
              }
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            >
              <option value="MONTHLY">Mensual</option>
              <option value="YEARLY">Anual</option>
            </select>

            <input
              type="number"
              min={1}
              value={employeeCount}
              onChange={(event) => setEmployeeCount(Number(event.target.value))}
              placeholder="Empleados"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              type="number"
              min={1}
              value={locationCount}
              onChange={(event) => setLocationCount(Number(event.target.value))}
              placeholder="Ubicaciones"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <input
              type="number"
              min={1}
              value={companyCount}
              onChange={(event) => setCompanyCount(Number(event.target.value))}
              placeholder="Empresas legales"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </div>

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

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              onClick={calculateQuote}
              disabled={isLoading}
              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-bold text-cyan-200 disabled:opacity-60"
            >
              Calcular
            </button>

            <button
              type="button"
              onClick={handleGenerateQuote}
              disabled={isLoading}
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
            >
              Generar Propuesta Comercial
            </button>
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
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quoteResult.subtotal)}</span>
                </div>

                <div className="mt-2 flex justify-between text-sm text-slate-400">
                  <span>IVA</span>
                  <span>{formatCurrency(quoteResult.ivaAmount)}</span>
                </div>

                <div className="mt-4 flex justify-between text-xl font-bold text-white">
                  <span>Total</span>
                  <span>{formatCurrency(quoteResult.total)}</span>
                </div>

                <p className="mt-2 text-right text-xs text-slate-500">
                  {billingCycle === "YEARLY"
                    ? "MXN / año"
                    : "MXN / mes"}
                </p>
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
          {quotes.map((quote) => (
            <article
              key={quote.id}
              className="rounded-2xl border border-slate-800 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-white">{quote.folio}</h3>
                  <p className="text-sm text-slate-400">
                    {quote.prospectName}
                  </p>
                </div>

                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {quote.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
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
                  <p className="text-xs text-slate-500">Vigencia</p>
                  <p className="mt-1 text-sm text-white">{quote.validUntil}</p>
                </div>

                <div className="rounded-2xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="mt-1 text-sm font-bold text-cyan-300">
                    {formatCurrency(quote.total)}
                  </p>
                </div>
              </div>
            </article>
          ))}

          {!quotes.length && (
            <p className="text-slate-500">No existen propuestas generadas.</p>
          )}
        </div>
      </section>
    </div>
  );
}