import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Building2,
  CheckCircle2,
  Compass,
  FileText,
  Lightbulb,
  Search,
  Sparkles,
} from "lucide-react";

import {
  createOrganization,
  getOrganizations,
  updateOrganizationStage,
} from "../services/consultingOrganizationService";
import type {
  ConsultingPriority,
  ConsultingStage,
  PlatformOrganization,
} from "../types/platformOrganization";

const STAGES: { value: ConsultingStage; label: string }[] = [
  { value: "DISCOVERY", label: "Descubrir" },
  { value: "DIAGNOSIS", label: "Comprender" },
  { value: "SOLUTION", label: "Diseñar" },
  { value: "DEMO", label: "Presentar" },
  { value: "PROPOSAL", label: "Propuesta" },
  { value: "IMPLEMENTATION", label: "Implementar" },
  { value: "SUCCESS", label: "Crecer" },
  { value: "AMBASSADOR", label: "Embajador" },
];

const INTEREST_AREAS = [
  "Personas",
  "Operaciones",
  "Documentos",
  "Dirección",
  "Ecosistema completo",
];

function getPriorityLabel(priority: ConsultingPriority) {
  if (priority === "HIGH") return "Alta";
  if (priority === "MEDIUM") return "Media";
  return "Baja";
}

function getRecommendedStep(mainChallenge: string, interestAreas: string[]) {
  const normalized = `${mainChallenge} ${interestAreas.join(" ")}`.toLowerCase();

  if (normalized.includes("mantenimiento") || normalized.includes("operación")) {
    return "Mostrar Aura Maintenance OS y diagnosticar continuidad operativa.";
  }

  if (normalized.includes("firma") || normalized.includes("document")) {
    return "Mostrar Aura Signature y revisar flujo documental.";
  }

  if (normalized.includes("rh") || normalized.includes("persona")) {
    return "Mostrar Aura HCM y revisar experiencia del colaborador.";
  }

  if (normalized.includes("decisión") || normalized.includes("inteligencia")) {
    return "Mostrar Aura Intelligence y revisar toma de decisiones.";
  }

  return "Iniciar con video institucional y llamada de descubrimiento.";
}

export default function ConsultingCenterPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState<PlatformOrganization | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("51-200");
  const [mainChallenge, setMainChallenge] = useState("");
  const [interestAreas, setInterestAreas] = useState<string[]>(["Personas"]);
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const stageCounters = useMemo(() => {
    return STAGES.map((stage) => ({
      ...stage,
      count: organizations.filter((item) => item.stage === stage.value).length,
    }));
  }, [organizations]);

  const highPriorityCount = organizations.filter(
    (item) => item.priority === "HIGH"
  ).length;

  async function loadOrganizations() {
    try {
      setError("");
      const data = await getOrganizations();
      setOrganizations(data);

      if (!selectedOrganization && data.length > 0) {
        setSelectedOrganization(data[0]);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las organizaciones.");
    }
  }

  useEffect(() => {
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleInterestArea(area: string) {
    setInterestAreas((current) =>
      current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area]
    );
  }

  async function handleCreateOrganization() {
    if (!companyName.trim()) {
      setError("El nombre de la organización es obligatorio.");
      return;
    }

    if (!contactName.trim()) {
      setError("El contacto principal es obligatorio.");
      return;
    }

    if (!mainChallenge.trim()) {
      setError("El reto principal es obligatorio.");
      return;
    }

    if (!interestAreas.length) {
      setError("Selecciona al menos un área de interés.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    const priority: ConsultingPriority =
      companySize === "201-500" || companySize === "500+" ? "HIGH" : "MEDIUM";

    const recommendedNextStep = getRecommendedStep(
      mainChallenge,
      interestAreas
    );

    try {
      await createOrganization({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        industry: industry.trim(),
        companySize,
        mainChallenge: mainChallenge.trim(),
        interestAreas,
        stage: "DISCOVERY",
        priority,
        recommendedNextStep,
        notes: notes.trim(),
      });

      setCompanyName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setIndustry("");
      setCompanySize("51-200");
      setMainChallenge("");
      setInterestAreas(["Personas"]);
      setNotes("");

      setSuccessMessage("Organización creada correctamente.");
      await loadOrganizations();
    } catch (err) {
      console.error(err);
      setError("No se pudo crear la organización.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStageChange(
    organization: PlatformOrganization,
    stage: ConsultingStage
  ) {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await updateOrganizationStage(organization.id, stage);
      setSuccessMessage("Etapa actualizada correctamente.");

      const updated = {
        ...organization,
        stage,
      };

      setSelectedOrganization(updated);
      await loadOrganizations();
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar la etapa.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Aura Consulting Center
        </p>

        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
          Acompañar organizaciones
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
          Sistema consultivo para conocer, comprender y guiar organizaciones
          desde el primer contacto hasta convertirse en casos de éxito Aura.
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

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <Building2 className="mb-4 h-6 w-6 text-cyan-300" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Organizaciones
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            {organizations.length}
          </h2>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <Compass className="mb-4 h-6 w-6 text-cyan-300" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Descubrimiento
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            {
              organizations.filter((item) => item.stage === "DISCOVERY")
                .length
            }
          </h2>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <FileText className="mb-4 h-6 w-6 text-cyan-300" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Propuestas
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            {
              organizations.filter((item) => item.stage === "PROPOSAL")
                .length
            }
          </h2>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <Sparkles className="mb-4 h-6 w-6 text-cyan-300" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Prioridad alta
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            {highPriorityCount}
          </h2>
        </article>
      </section>

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Nueva organización
        </h2>

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
            placeholder="Teléfono / WhatsApp"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            placeholder="Sector / Industria"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <select
            value={companySize}
            onChange={(event) => setCompanySize(event.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          >
            <option value="1-10">1 - 10 colaboradores</option>
            <option value="11-50">11 - 50 colaboradores</option>
            <option value="51-200">51 - 200 colaboradores</option>
            <option value="201-500">201 - 500 colaboradores</option>
            <option value="500+">Más de 500 colaboradores</option>
          </select>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">
            Área principal de interés
          </p>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {INTEREST_AREAS.map((area) => {
              const active = interestAreas.includes(area);

              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleInterestArea(area)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                    active
                      ? "border-cyan-300 bg-cyan-400/10 text-cyan-200"
                      : "border-slate-700 bg-slate-950 text-slate-400 hover:border-cyan-400/50",
                  ].join(" ")}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          value={mainChallenge}
          onChange={(event) => setMainChallenge(event.target.value)}
          rows={3}
          placeholder="¿Cuál es el principal reto que esta organización quiere resolver?"
          className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
        />

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Notas internas del consultor"
          className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
        />

        <button
          type="button"
          onClick={handleCreateOrganization}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Guardando..." : "Crear Organización"}
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Recorrido consultivo
                </h2>
                <p className="text-sm text-slate-500">
                  Descubrir → Comprender → Diseñar → Presentar → Implementar →
                  Crecer
                </p>
              </div>

              <Search className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {organizations.map((organization) => (
                <article
                  key={organization.id}
                  onClick={() => setSelectedOrganization(organization)}
                  className={[
                    "cursor-pointer rounded-3xl border p-5 transition",
                    selectedOrganization?.id === organization.id
                      ? "border-cyan-300/50 bg-cyan-400/10"
                      : "border-slate-800 bg-slate-950/40 hover:border-cyan-400/30",
                  ].join(" ")}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white">
                        {organization.companyName}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {organization.contactName}
                      </p>
                    </div>

                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                      {getPriorityLabel(organization.priority)}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-slate-500">
                    {organization.mainChallenge}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {organization.interestAreas.map((area) => (
                      <span
                        key={area}
                        className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300"
                      >
                        {area}
                      </span>
                    ))}
                  </div>

                  <select
                    value={organization.stage}
                    disabled={isLoading}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      handleStageChange(
                        organization,
                        event.target.value as ConsultingStage
                      )
                    }
                    className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  >
                    {STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}

              {!organizations.length && (
                <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-500">
                  Aún no hay organizaciones registradas.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="xl:col-span-5">
          <section className="sticky top-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
            <div className="mb-5 flex items-center gap-3">
              <Brain className="h-6 w-6 text-cyan-300" />
              <div>
                <h2 className="text-xl font-bold text-white">
                  Expediente Aura
                </h2>
                <p className="text-sm text-slate-500">
                  Historia consultiva de la organización.
                </p>
              </div>
            </div>

            {selectedOrganization ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                    Organización
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-white">
                    {selectedOrganization.companyName}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedOrganization.industry || "Sector no especificado"} ·{" "}
                    {selectedOrganization.companySize}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Contacto
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {selectedOrganization.contactName}
                  </p>
                  <p className="text-sm text-slate-400">
                    {selectedOrganization.email || "Sin correo"}
                  </p>
                  <p className="text-sm text-slate-400">
                    {selectedOrganization.phone || "Sin teléfono"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Reto principal
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {selectedOrganization.mainChallenge}
                  </p>
                </div>

                <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="mb-2 flex items-center gap-2 text-cyan-200">
                    <Lightbulb className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-[0.25em]">
                      Recomendación Aura
                    </p>
                  </div>

                  <p className="text-sm leading-6 text-cyan-100">
                    {selectedOrganization.recommendedNextStep}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Etapa actual
                  </p>

                  <div className="mt-3 grid gap-2">
                    {stageCounters.map((stage) => (
                      <div
                        key={stage.value}
                        className={[
                          "flex items-center justify-between rounded-2xl border px-3 py-2 text-sm",
                          selectedOrganization.stage === stage.value
                            ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                            : "border-slate-800 bg-slate-950 text-slate-500",
                        ].join(" ")}
                      >
                        <span>{stage.label}</span>
                        {selectedOrganization.stage === stage.value && (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrganization.notes && (
                  <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                      Notas
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedOrganization.notes}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Selecciona una organización para ver su expediente.
              </p>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}