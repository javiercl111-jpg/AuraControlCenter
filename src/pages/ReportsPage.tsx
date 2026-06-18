import { useState } from "react";

import { buildExecutiveReport } from "../services/executiveReportService";
import type {
  ExecutiveReport,
  ExecutiveReportType,
} from "../types/executiveReport";

const reportOptions: {
  type: ExecutiveReportType;
  title: string;
  description: string;
}[] = [
  {
    type: "EXECUTIVE",
    title: "Reporte Ejecutivo",
    description: "Resumen general de clientes, SaaS, finanzas y comercial.",
  },
  {
    type: "COMMERCIAL",
    title: "Reporte Comercial",
    description: "Pipeline, conversión, prospectos ganados y forecast.",
  },
  {
    type: "SAAS",
    title: "Reporte SaaS",
    description: "Tenants, licencias, estados y operación SaaS.",
  },
  {
    type: "FINANCIAL",
    title: "Reporte Financiero",
    description: "Facturación, pagos, comisiones, MRR y ARR.",
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] =
    useState<ExecutiveReport | null>(null);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerateReport(type: ExecutiveReportType) {
    setIsLoading(true);
    setError("");

    try {
      const report = await buildExecutiveReport(type);
      setSelectedReport(report);
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el reporte.");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrintReport() {
    window.print();
  }

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Executive Reporting
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Reportes Ejecutivos
        </h1>

        <p className="mt-3 text-slate-400">
          Genera reportes ejecutivos para operación comercial, financiera y SaaS
          de Aura Control Center.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportOptions.map((option) => (
          <article
            key={option.type}
            className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
          >
            <h2 className="text-xl font-bold text-white">{option.title}</h2>

            <p className="mt-2 text-sm text-slate-400">
              {option.description}
            </p>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGenerateReport(option.type)}
              className="mt-5 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Generando..." : "Generar"}
            </button>
          </article>
        ))}
      </section>

      {selectedReport && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 print:border-none print:bg-white print:text-slate-950">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300 print:text-slate-500">
                Aura Control Center
              </p>

              <h2 className="mt-3 text-3xl font-bold text-white print:text-slate-950">
                {selectedReport.title}
              </h2>

              <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
                {selectedReport.subtitle}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Generado: {selectedReport.generatedAt}
              </p>
            </div>

            <button
              type="button"
              onClick={handlePrintReport}
              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-200 print:hidden"
            >
              Exportar PDF
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedReport.metrics.map((metric) => (
              <article
                key={metric.label}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 print:border-slate-200 print:bg-slate-50"
              >
                <p className="text-sm text-slate-400 print:text-slate-600">
                  {metric.label}
                </p>

                <p className="mt-2 text-2xl font-bold text-white print:text-slate-950">
                  {metric.value}
                </p>

                {metric.detail && (
                  <p className="mt-1 text-xs text-slate-500">
                    {metric.detail}
                  </p>
                )}
              </article>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="mb-4 text-xl font-bold text-white print:text-slate-950">
              Alertas ejecutivas
            </h3>

            <div className="space-y-3">
              {selectedReport.alerts.map((alert) => (
                <p
                  key={alert}
                  className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-200 print:border-slate-200 print:bg-slate-50 print:text-slate-700"
                >
                  {alert}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}