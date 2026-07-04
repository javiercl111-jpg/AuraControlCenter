import { Brain, CheckCircle2, Lightbulb, UserCheck } from "lucide-react";

import OrganizationTimeline from "./OrganizationTimeline";
import type {
  ConsultingStage,
  PlatformOrganization,
} from "../../types/platformOrganization";

interface AuraDossierProps {
  selectedOrganization: PlatformOrganization | null;
  stageCounters: { value: ConsultingStage; label: string; count: number }[];
}

export default function AuraDossier({
  selectedOrganization,
  stageCounters,
}: AuraDossierProps) {
  return (
    <section className="sticky top-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
      <div className="mb-5 flex items-center gap-3">
        <Brain className="h-6 w-6 text-cyan-300" />

        <div>
          <h2 className="text-xl font-bold text-white">Expediente Aura</h2>

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

          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-cyan-200">
              <UserCheck className="h-4 w-4" />

              <p className="text-xs font-semibold uppercase tracking-[0.25em]">
                Consultor asignado
              </p>
            </div>

            <p className="text-sm font-semibold text-white">
              {selectedOrganization.assignedConsultantName ||
                "Sin consultor asignado"}
            </p>

            <p className="mt-1 text-sm text-cyan-100">
              {selectedOrganization.assignedConsultantEmail ||
                "Asigna un consultor para iniciar seguimiento."}
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

          <OrganizationTimeline timeline={selectedOrganization.timeline} />

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
  );
}