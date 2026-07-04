import { Search } from "lucide-react";

import type {
  ConsultingPriority,
  ConsultingStage,
  PlatformOrganization,
} from "../../types/platformOrganization";

interface OrganizationBoardProps {
  organizations: PlatformOrganization[];
  selectedOrganization: PlatformOrganization | null;
  isLoading: boolean;
  onSelectOrganization: (organization: PlatformOrganization) => void;
  onStageChange: (
    organization: PlatformOrganization,
    stage: ConsultingStage
  ) => void;
}

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

function getPriorityLabel(priority: ConsultingPriority) {
  if (priority === "HIGH") return "Alta";
  if (priority === "MEDIUM") return "Media";
  return "Baja";
}

export default function OrganizationBoard({
  organizations,
  selectedOrganization,
  isLoading,
  onSelectOrganization,
  onStageChange,
}: OrganizationBoardProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Recorrido consultivo
          </h2>

          <p className="text-sm text-slate-500">
            Descubrir → Comprender → Diseñar → Presentar → Implementar → Crecer
          </p>
        </div>

        <Search className="h-5 w-5 text-cyan-300" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {organizations.map((organization) => (
          <article
            key={organization.id}
            onClick={() => onSelectOrganization(organization)}
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
              {(organization.interestAreas || []).map((area) => (
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
                onStageChange(
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
  );
}