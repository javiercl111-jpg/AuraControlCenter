import { useState } from "react";
import { ClipboardList, Save } from "lucide-react";

import type {
  DiagnosisUrgency,
  OrganizationDiagnosis,
  PlatformOrganization,
} from "../../types/platformOrganization";

interface DiagnosisPanelProps {
  organization: PlatformOrganization;
  isLoading: boolean;
  onSaveDiagnosis: (
    organizationId: string,
    diagnosis: OrganizationDiagnosis
  ) => Promise<void>;
}

const MODULE_OPTIONS = [
  "Aura HCM",
  "Aura Maintenance OS",
  "Aura Signature",
  "Aura Intelligence",
  "Aura Control Center",
];

export default function DiagnosisPanel({
  organization,
  isLoading,
  onSaveDiagnosis,
}: DiagnosisPanelProps) {
  const [painPoints, setPainPoints] = useState(
    organization.diagnosis?.painPoints || ""
  );
  const [recommendedModules, setRecommendedModules] = useState<string[]>(
    organization.diagnosis?.recommendedModules || organization.interestAreas || []
  );
  const [urgency, setUrgency] = useState<DiagnosisUrgency>(
    organization.diagnosis?.urgency || "MEDIUM"
  );
  const [estimatedBudget, setEstimatedBudget] = useState(
    organization.diagnosis?.estimatedBudget || ""
  );
  const [nextAction, setNextAction] = useState(
    organization.diagnosis?.nextAction || organization.recommendedNextStep || ""
  );

  function toggleModule(module: string) {
    setRecommendedModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module]
    );
  }

  async function handleSave() {
    await onSaveDiagnosis(organization.id, {
      painPoints: painPoints.trim(),
      recommendedModules,
      urgency,
      estimatedBudget: estimatedBudget.trim(),
      nextAction: nextAction.trim(),
    });
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-cyan-300" />

        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Diagnóstico
        </p>
      </div>

      <textarea
        value={painPoints}
        onChange={(event) => setPainPoints(event.target.value)}
        rows={3}
        placeholder="Dolores detectados durante la conversación..."
        className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
      />

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Módulos recomendados
        </p>

        <div className="grid gap-2">
          {MODULE_OPTIONS.map((module) => {
            const active = recommendedModules.includes(module);

            return (
              <button
                key={module}
                type="button"
                onClick={() => toggleModule(module)}
                className={[
                  "rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                  active
                    ? "border-cyan-300 bg-cyan-400/10 text-cyan-200"
                    : "border-slate-800 bg-slate-950 text-slate-500 hover:border-cyan-400/40",
                ].join(" ")}
              >
                {module}
              </button>
            );
          })}
        </div>
      </div>

      <select
        value={urgency}
        onChange={(event) => setUrgency(event.target.value as DiagnosisUrgency)}
        className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
      >
        <option value="LOW">Urgencia baja</option>
        <option value="MEDIUM">Urgencia media</option>
        <option value="HIGH">Urgencia alta</option>
        <option value="CRITICAL">Urgencia crítica</option>
      </select>

      <input
        value={estimatedBudget}
        onChange={(event) => setEstimatedBudget(event.target.value)}
        placeholder="Presupuesto aproximado"
        className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
      />

      <textarea
        value={nextAction}
        onChange={(event) => setNextAction(event.target.value)}
        rows={2}
        placeholder="Siguiente acción recomendada..."
        className="mt-4 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
      />

      <button
        type="button"
        disabled={isLoading || !painPoints.trim() || !nextAction.trim()}
        onClick={handleSave}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        Guardar diagnóstico
      </button>
    </div>
  );
}