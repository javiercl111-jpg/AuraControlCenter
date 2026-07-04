import { CheckCircle2, Inbox, Trash2 } from "lucide-react";

import type { PlatformDiscoveryRequest } from "../../types/platformOrganization";

interface DiscoveryInboxProps {
  discoveryRequests: PlatformDiscoveryRequest[];
  isLoading: boolean;
  onConvert: (request: PlatformDiscoveryRequest) => void;
  onDiscard: (requestId: string) => void;
}

function getPriorityLabel(priority: PlatformDiscoveryRequest["priority"]) {
  if (priority === "HIGH") return "Alta";
  if (priority === "MEDIUM") return "Media";
  return "Baja";
}

export default function DiscoveryInbox({
  discoveryRequests,
  isLoading,
  onConvert,
  onDiscard,
}: DiscoveryInboxProps) {
  return (
    <section className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
      <div className="mb-5 flex items-center gap-3">
        <Inbox className="h-5 w-5 text-cyan-300" />

        <div>
          <h2 className="text-xl font-bold text-white">
            Discovery Inbox
          </h2>

          <p className="text-sm text-slate-500">
            Solicitudes recibidas desde auranexus.io pendientes de revisión.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {discoveryRequests.map((request) => (
          <article
            key={request.id}
            className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-white">
                  {request.companyName}
                </h3>

                <p className="text-sm text-slate-400">
                  {request.contactName}
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                {getPriorityLabel(request.priority)}
              </span>
            </div>

            <p className="line-clamp-3 text-sm leading-6 text-slate-400">
              {request.mainChallenge}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(request.interestAreas || []).map((area) => (
                <span
                  key={area}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300"
                >
                  {area}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onConvert(request)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Comenzar diagnóstico
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => onDiscard(request.id)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Descartar
              </button>
            </div>
          </article>
        ))}

        {!discoveryRequests.length && (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-500">
            No hay nuevas solicitudes de descubrimiento.
          </div>
        )}
      </div>
    </section>
  );
}