import { Building2, Compass, FileText, Inbox, Sparkles } from "lucide-react";

import type {
  PlatformDiscoveryRequest,
  PlatformOrganization,
} from "../../types/platformOrganization";

interface ConsultingKPIsProps {
  organizations: PlatformOrganization[];
  discoveryRequests: PlatformDiscoveryRequest[];
}

export default function ConsultingKPIs({
  organizations,
  discoveryRequests,
}: ConsultingKPIsProps) {
  const discoveryCount = organizations.filter(
    (item) => item.stage === "DISCOVERY"
  ).length;

  const proposalCount = organizations.filter(
    (item) => item.stage === "PROPOSAL"
  ).length;

  const highPriorityCount = organizations.filter(
    (item) => item.priority === "HIGH"
  ).length;

  const cards = [
    {
      label: "Solicitudes nuevas",
      value: discoveryRequests.length,
      icon: Inbox,
    },
    {
      label: "Organizaciones",
      value: organizations.length,
      icon: Building2,
    },
    {
      label: "Descubrimiento",
      value: discoveryCount,
      icon: Compass,
    },
    {
      label: "Propuestas",
      value: proposalCount,
      icon: FileText,
    },
    {
      label: "Prioridad alta",
      value: highPriorityCount,
      icon: Sparkles,
    },
  ];

  return (
    <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            key={card.label}
            className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
          >
            <Icon className="mb-4 h-6 w-6 text-cyan-300" />

            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              {card.label}
            </p>

            <h2 className="mt-2 text-3xl font-bold text-white">
              {card.value}
            </h2>
          </article>
        );
      })}
    </section>
  );
}