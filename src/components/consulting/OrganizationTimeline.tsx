import { Clock3 } from "lucide-react";

import type { OrganizationTimelineEvent } from "../../types/platformOrganization";

interface OrganizationTimelineProps {
  timeline?: OrganizationTimelineEvent[];
}

function formatTimelineDate(value: unknown) {
  if (!value) return "Fecha no disponible";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return "Fecha registrada";
}

export default function OrganizationTimeline({
  timeline = [],
}: OrganizationTimelineProps) {
  const orderedTimeline = [...timeline].reverse();

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-cyan-300" />

        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Timeline
        </p>
      </div>

      {orderedTimeline.length > 0 ? (
        <div className="space-y-4">
          {orderedTimeline.map((event) => (
            <div key={event.id} className="border-l border-cyan-400/20 pl-4">
              <p className="text-sm font-bold text-white">{event.title}</p>

              <p className="mt-1 text-xs text-slate-500">
                {formatTimelineDate(event.createdAt)}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {event.description}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Aún no hay eventos registrados para esta organización.
        </p>
      )}
    </div>
  );
}