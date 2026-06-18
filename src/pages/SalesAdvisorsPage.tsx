import { useEffect, useState } from "react";

import {
  createSalesAdvisor,
  getSalesAdvisors,
} from "../services/platformSalesAdvisorService";

import type {
  PlatformSalesAdvisor,
  SalesAdvisorStatus,
} from "../types/platformSalesAdvisor";

export default function SalesAdvisorsPage() {
  const [advisors, setAdvisors] =
    useState<PlatformSalesAdvisor[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [status, setStatus] =
    useState<SalesAdvisorStatus>("ACTIVE");

  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  async function loadAdvisors() {
    try {
      const data = await getSalesAdvisors();
      setAdvisors(data);
    } catch (err) {
      console.error(err);
      setError(
        "No se pudieron cargar los asesores."
      );
    }
  }

  useEffect(() => {
    loadAdvisors();
  }, []);

  async function handleCreateAdvisor() {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await createSalesAdvisor({
        name,
        email,
        phone,

        status,

        commissionYear1: 10,

        commissionRenewal: 5,

        bonusLevel: 15,

        notes,
      });

      setName("");
      setEmail("");
      setPhone("");
      setNotes("");

      await loadAdvisors();
    } catch (err) {
      console.error(err);

      setError(
        "No se pudo crear el asesor."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white">
          Asesores Comerciales
        </h1>

        <p className="mt-3 text-slate-400">
          Gestión de asesores y comisiones.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Crear Asesor
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="Nombre"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Correo"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value)
            }
            placeholder="Teléfono"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as SalesAdvisorStatus
              )
            }
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="ACTIVE">
              Activo
            </option>

            <option value="INACTIVE">
              Inactivo
            </option>
          </select>
        </div>

        <textarea
          value={notes}
          onChange={(e) =>
            setNotes(e.target.value)
          }
          rows={3}
          placeholder="Notas"
          className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
        />

        <button
          onClick={handleCreateAdvisor}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950"
        >
          {isLoading
            ? "Guardando..."
            : "Crear Asesor"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">
          Asesores Registrados
        </h2>

        <div className="space-y-3">
          {advisors.map((advisor) => (
            <article
              key={advisor.id}
              className="rounded-2xl border border-slate-800 p-4"
            >
              <h3 className="font-bold text-white">
                {advisor.name}
              </h3>

              <p className="text-slate-400">
                {advisor.email}
              </p>

              <p className="text-slate-400">
                {advisor.phone}
              </p>

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-800 px-3 py-1">
                  Año 1: {advisor.commissionYear1}%
                </span>

                <span className="rounded-full bg-slate-800 px-3 py-1">
                  Renovación: {advisor.commissionRenewal}%
                </span>

                <span className="rounded-full bg-slate-800 px-3 py-1">
                  Bono: {advisor.bonusLevel}%
                </span>
              </div>
            </article>
          ))}

          {!advisors.length && (
            <p className="text-slate-500">
              No existen asesores registrados.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}