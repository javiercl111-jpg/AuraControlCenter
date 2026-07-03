import { Link } from "react-router-dom";

import type { ExecutiveDashboardData } from "../../../pages/DashboardPage";

interface ConsultingTabProps {
  data: ExecutiveDashboardData;
}

export default function ConsultingTab({ data }: ConsultingTabProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-slate-950/60 p-5">
          <p className="text-sm text-slate-400">Descubrimiento</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {data.metrics.consultingDiscovery.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Organizaciones por conocer.
          </p>
        </div>

        <div className="rounded-3xl bg-slate-950/60 p-5">
          <p className="text-sm text-slate-400">Diagnóstico</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {data.metrics.consultingDiagnosis.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Organizaciones por comprender.
          </p>
        </div>

        <div className="rounded-3xl bg-slate-950/60 p-5">
          <p className="text-sm text-slate-400">Propuestas</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {data.metrics.consultingProposal.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Soluciones por presentar.
          </p>
        </div>

        <div className="rounded-3xl bg-slate-950/60 p-5">
          <p className="text-sm text-slate-400">Implementaciones</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {data.metrics.consultingImplementation.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Clientes en acompañamiento.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-cyan-400/10 bg-cyan-400/5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
              Prioridad consultiva
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              {data.metrics.highPriorityOrganizations.length > 0
                ? `${data.metrics.highPriorityOrganizations.length} organización(es) de prioridad alta`
                : "No hay prioridades altas pendientes"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {data.metrics.highPriorityOrganizations.length > 0
                ? "Revisa primero estos expedientes antes de abrir nuevas oportunidades."
                : "Puedes enfocar el día en descubrimiento, seguimiento o expansión."}
            </p>
          </div>

          <Link
            to="/consulting"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
          >
            Abrir Consulting Center
          </Link>
        </div>
      </div>
    </div>
  );
}