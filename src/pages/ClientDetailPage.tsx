import { ArrowLeft, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getClientById } from "../services/platformClientDetailService";
import type { PlatformClient } from "../types/platformClient";

export default function ClientDetailPage() {
  const { clientId } = useParams();

  const [client, setClient] = useState<PlatformClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadClient() {
      if (!clientId) {
        setError("Cliente no válido.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getClientById(clientId);

        if (!data) {
          setError("No se encontró el cliente.");
          return;
        }

        setClient(data);
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar el cliente.");
      } finally {
        setIsLoading(false);
      }
    }

    loadClient();
  }, [clientId]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
        Cargando cliente...
      </div>
    );
  }

  if (error || !client) {
    return (
      <div>
        <Link
          to="/clients"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>

        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
          {error || "Cliente no disponible."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>

        <Link
          to={`/clients/${client.id}/edit`}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
        >
          <Pencil className="h-4 w-4" />
          Editar Cliente
        </Link>
      </div>

      <header className="mb-8 rounded-3xl border border-cyan-400/10 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Detalle de Cliente
        </p>

        <h1 className="mt-3 text-4xl font-bold text-white">
          {client.companyName}
        </h1>

        <p className="mt-2 text-slate-400">{client.tradeName}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">
            Información General
          </h2>

          <div className="space-y-3 text-sm text-slate-400">
            <p>
              Razón social:{" "}
              <span className="font-semibold text-white">
                {client.companyName}
              </span>
            </p>

            <p>
              Nombre comercial:{" "}
              <span className="font-semibold text-white">
                {client.tradeName}
              </span>
            </p>

            <p>
              Estado:{" "}
              <span className="font-semibold text-cyan-300">
                {client.status}
              </span>
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">Licencia</h2>

          <div className="space-y-3 text-sm text-slate-400">
            <p>
              Plan:{" "}
              <span className="font-semibold text-white">
                {client.planCode}
              </span>
            </p>

            <p>
              Ciclo:{" "}
              <span className="font-semibold text-white">
                {client.billingCycle}
              </span>
            </p>

            <p>
              Inicio:{" "}
              <span className="font-semibold text-white">
                {client.startDate || "Sin fecha"}
              </span>
            </p>

            <p>
              Renovación:{" "}
              <span className="font-semibold text-white">
                {client.renewalDate || "Sin fecha"}
              </span>
            </p>

            <p>
              Gracia hasta:{" "}
              <span className="font-semibold text-white">
                {client.graceUntil || "Sin fecha"}
              </span>
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:col-span-2">
          <h2 className="mb-4 text-xl font-bold text-white">Datos fiscales</h2>

          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p className="text-slate-400">
              Razón social fiscal:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.legalName || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              RFC:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.rfc || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Régimen fiscal:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.taxRegime || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Uso CFDI:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.cfdiUse || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Método pago:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.paymentMethod || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Forma pago:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.paymentForm || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              CP fiscal:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.fiscalZipCode || "Sin dato"}
              </span>
            </p>

            <p className="text-slate-400">
              Correo facturación:{" "}
              <span className="font-semibold text-white">
                {client.fiscalData?.billingEmail || "Sin dato"}
              </span>
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:col-span-2">
          <h2 className="mb-4 text-xl font-bold text-white">
            Ecosistemas contratados
          </h2>

          <div className="flex flex-wrap gap-2">
            {client.enabledModules?.map((moduleCode) => (
              <span
                key={moduleCode}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-cyan-300"
              >
                {moduleCode}
              </span>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}