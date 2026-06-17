import { useEffect, useState } from "react";
import { createClient, getClients } from "../services/platformClientService";
import type { PlatformClient } from "../types/platformClient";

export default function ClientsPage() {
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadClients() {
    try {
      setError("");
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error("Load clients error:", err);
      setError("No se pudieron cargar los clientes. Revisa reglas de Firestore.");
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function handleCreateClient() {
    if (!companyName.trim()) {
      setError("La razón social es obligatoria.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await createClient({
        companyName: companyName.trim(),
        tradeName: tradeName.trim() || companyName.trim(),
        planCode: "HCM_PROFESSIONAL",
      });

      setCompanyName("");
      setTradeName("");

      await loadClients();
    } catch (err) {
      console.error("Create client error:", err);
      setError("No se pudo crear el cliente. Revisa permisos de Firestore.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white">Clientes</h1>
        <p className="mt-3 text-slate-400">Gestión inicial de clientes Aura.</p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Crear Cliente</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Razón social"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <input
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            placeholder="Nombre comercial"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />
        </div>

        <button
          onClick={handleCreateClient}
          disabled={isLoading}
          className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Guardando..." : "Crear Cliente"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Clientes Registrados</h2>

        <div className="space-y-3">
          {clients.map((client) => (
            <article key={client.id} className="rounded-2xl border border-slate-800 p-4">
              <h3 className="font-bold text-white">{client.companyName}</h3>
              <p className="text-sm text-slate-400">{client.tradeName}</p>
              <p className="mt-2 text-xs text-cyan-300">{client.planCode}</p>
            </article>
          ))}

          {!clients.length && (
            <p className="text-slate-500">No existen clientes registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}