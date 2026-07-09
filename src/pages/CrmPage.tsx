import { useEffect, useState } from "react";
import DiscoveryLinkGenerator from "../modules/discovery/components/DiscoveryLinkGenerator";
import ExecutiveBriefingDrawer from "../modules/discovery/components/ExecutiveBriefingDrawer";
import DiscoverySessionService from "../modules/discovery/services/discoverySessionService";
import type { DiscoverySession } from "../modules/discovery/types/discoveryTypes";

import { MODULE_OPTIONS } from "../constants/clientOptions";
import { convertLeadToClientAndTenant } from "../services/leadConversionService";
import {
  createLead,
  getLeads,
  updateLeadStage,
} from "../services/platformLeadService";
import type { LeadStage, PlatformLead } from "../types/platformLead";

const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: "NEW_LEAD", label: "Nuevo" },
  { value: "CONTACTED", label: "Contactado" },
  { value: "DEMO_SCHEDULED", label: "Demo" },
  { value: "PROPOSAL_SENT", label: "Cotización" },
  { value: "NEGOTIATION", label: "Negociación" },
  { value: "WON", label: "Ganado" },
  { value: "LOST", label: "Perdido" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export default function CrmPage() {
  const [leads, setLeads] = useState<PlatformLead[]>([]);
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [selectedLeadForDiscovery, setSelectedLeadForDiscovery] = useState<PlatformLead | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");
  const [interestedModules, setInterestedModules] = useState<string[]>([
    "AURA_HCM",
  ]);

  const [discoverySessions, setDiscoverySessions] = useState<DiscoverySession[]>([]);
  const [isBriefingDrawerOpen, setIsBriefingDrawerOpen] = useState(false);
  const [selectedSessionForBriefing, setSelectedSessionForBriefing] = useState<DiscoverySession | null>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadData() {
    try {
      setError("");
      const [leadsData, sessionsData] = await Promise.all([
        getLeads(),
        DiscoverySessionService.getDiscoverySessions()
      ]);
      setLeads(leadsData);
      setDiscoverySessions(sessionsData);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los datos (prospectos o sesiones).");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleModule(moduleCode: string) {
    setInterestedModules((currentModules) =>
      currentModules.includes(moduleCode)
        ? currentModules.filter((item) => item !== moduleCode)
        : [...currentModules, moduleCode]
    );
  }

  async function handleCreateLead() {
    if (!companyName.trim()) {
      setError("El nombre de la empresa es obligatorio.");
      return;
    }

    if (!contactName.trim()) {
      setError("El nombre del contacto es obligatorio.");
      return;
    }

    if (!interestedModules.length) {
      setError("Selecciona al menos un ecosistema de interés.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await createLead({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        source: source.trim(),
        interestedModules,
        estimatedValue: Number(estimatedValue) || 0,
        stage: "NEW_LEAD",
        notes: notes.trim(),
        nextFollowUpDate,
      });

      setCompanyName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setSource("");
      setEstimatedValue(0);
      setNextFollowUpDate("");
      setNotes("");
      setInterestedModules(["AURA_HCM"]);
      setSuccessMessage("Prospecto creado correctamente.");

      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudo crear el prospecto.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStageChange(leadId: string, stage: LeadStage) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await updateLeadStage(leadId, stage);
      setSuccessMessage("Etapa actualizada correctamente.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar la etapa.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConvertLead(lead: PlatformLead) {
    const confirmed = window.confirm(
      `¿Convertir "${lead.companyName}" en cliente y tenant Aura?`
    );

    if (!confirmed) return;

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await convertLeadToClientAndTenant(lead);
      setSuccessMessage("Prospecto convertido a cliente y tenant correctamente.");
      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo convertir el prospecto."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Commercial CRM
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">CRM Comercial</h1>

        <p className="mt-3 text-slate-400">
          Gestiona prospectos, pipeline comercial, demos, cotizaciones y
          oportunidades ganadas antes de convertirlas en clientes Aura.
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
        <h2 className="mb-5 text-xl font-bold text-white">Crear prospecto</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Empresa / Hotel / Grupo"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Contacto principal"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Correo"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Teléfono"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Origen del lead"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            type="number"
            min={0}
            value={estimatedValue}
            onChange={(event) => setEstimatedValue(Number(event.target.value))}
            placeholder="Valor estimado"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            type="date"
            value={nextFollowUpDate}
            onChange={(event) => setNextFollowUpDate(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">
            Ecosistemas de interés
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {MODULE_OPTIONS.map((module) => {
              const checked = interestedModules.includes(module.value);

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

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Notas comerciales"
          className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
        />

        <button
          type="button"
          onClick={handleCreateLead}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Guardando..." : "Crear Prospecto"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Pipeline comercial
        </h2>

        <div className="grid gap-4 xl:grid-cols-3">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = leads.filter(
              (lead) => lead.stage === stage.value
            );

            const stageTotal = stageLeads.reduce(
              (total, lead) => total + (lead.estimatedValue || 0),
              0
            );

            return (
              <div
                key={stage.value}
                className="rounded-3xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{stage.label}</h3>

                    <p className="text-xs text-slate-500">
                      {stageLeads.length} prospectos ·{" "}
                      {formatCurrency(stageTotal)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {stageLeads.map((lead) => {
                    const sessionMatch = discoverySessions.find(
                      (s) => s.companyName.toLowerCase() === lead.companyName.toLowerCase()
                    );
                    
                    return (
                    <article
                      key={lead.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <h4 className="font-bold text-white">
                        {lead.companyName}
                      </h4>

                      <p className="text-sm text-slate-400">
                        {lead.contactName}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {lead.email || "Sin correo"} ·{" "}
                        {lead.phone || "Sin teléfono"}
                      </p>

                      <p className="mt-2 text-sm font-semibold text-cyan-300">
                        {formatCurrency(lead.estimatedValue || 0)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {lead.interestedModules?.map((moduleCode) => (
                          <span
                            key={moduleCode}
                            className="rounded-full bg-slate-800 px-3 py-1 text-slate-300"
                          >
                            {moduleCode}
                          </span>
                        ))}
                      </div>

                      {lead.nextFollowUpDate && (
                        <p className="mt-3 text-xs text-yellow-200">
                          Seguimiento: {lead.nextFollowUpDate}
                        </p>
                      )}

                      <select
                        value={lead.stage}
                        onChange={(event) =>
                          handleStageChange(
                            lead.id,
                            event.target.value as LeadStage
                          )
                        }
                        disabled={isLoading}
                        className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                      >
                        {LEAD_STAGES.map((stageOption) => (
                          <option
                            key={stageOption.value}
                            value={stageOption.value}
                          >
                            {stageOption.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLeadForDiscovery(lead);
                          setIsDiscoveryModalOpen(true);
                        }}
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-500/50 hover:bg-slate-900 transition flex items-center justify-center gap-1.5"
                      >
                        ✨ Discovery Link
                      </button>

                      {sessionMatch && (
                        <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            <span className="text-xs font-bold text-emerald-400 uppercase">Discovery Completado</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedSessionForBriefing(sessionMatch);
                              setIsBriefingDrawerOpen(true);
                            }}
                            className="w-full rounded-xl bg-emerald-600/20 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/40 transition"
                          >
                            Ver Briefing
                          </button>
                        </div>
                      )}

                      {lead.stage === "WON" && !lead.convertedClientId && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleConvertLead(lead)}
                          className="mt-3 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
                        >
                          Convertir a Cliente
                        </button>
                      )}

                      {lead.convertedClientId && (
                        <p className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200">
                          Convertido a cliente
                        </p>
                      )}
                    </article>
                  )})}

                  {!stageLeads.length && (
                    <p className="text-sm text-slate-500">Sin prospectos.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {isDiscoveryModalOpen && selectedLeadForDiscovery && (
        <DiscoveryLinkGenerator
          isOpen={isDiscoveryModalOpen}
          onClose={() => {
            setIsDiscoveryModalOpen(false);
            setSelectedLeadForDiscovery(null);
          }}
          defaultCompanyName={selectedLeadForDiscovery.companyName}
          defaultContactName={selectedLeadForDiscovery.contactName}
        />
      )}

      <ExecutiveBriefingDrawer
        isOpen={isBriefingDrawerOpen}
        onClose={() => {
          setIsBriefingDrawerOpen(false);
          setSelectedSessionForBriefing(null);
        }}
        session={selectedSessionForBriefing}
      />
    </div>
  );
}