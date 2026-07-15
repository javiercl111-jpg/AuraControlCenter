import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";
import { getCurrentUserRole } from "../services/rbacService";

import {
  getSalesAdvisors,
} from "../services/platformSalesAdvisorService";

import type {
  PlatformSalesAdvisor,
} from "../types/platformSalesAdvisor";

export default function SalesAdvisorsPage() {
  const [advisors, setAdvisors] = useState<PlatformSalesAdvisor[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [assignedStates, setAssignedStates] = useState<string>("");
  const [specialties, setSpecialties] = useState<string>("");
  const [commissionPlanId, setCommissionPlanId] = useState("STANDARD_TIER_1");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activationLink, setActivationLink] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [isOwner, setIsOwner] = useState(false);

  async function loadAdvisors() {
    try {
      const data = await getSalesAdvisors();
      setAdvisors(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los asesores.");
    }
  }

  useEffect(() => {
    loadAdvisors();
    async function checkRole() {
      const role = await getCurrentUserRole();
      setIsOwner(role === "SUPER_ADMIN" || role === "FOUNDER" || (role as string) === "PLATFORM_OWNER");
    }
    checkRole();
  }, []);

  async function handleCreateAdvisor() {
    if (!name.trim() || !email.trim()) {
      setError("El nombre y correo son obligatorios.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    setActivationLink("");

    try {
      const provisionCommercialAdvisor = httpsCallable(functions, "provisionCommercialAdvisor");
      const result = await provisionCommercialAdvisor({
        name,
        email,
        phone,
        assignedStates: assignedStates.split(",").map(s => s.trim()).filter(Boolean),
        assignedCities: [],
        specialties: specialties.split(",").map(s => s.trim()).filter(Boolean),
        commissionPlanId,
      });

      const data = result.data as any;

      if (data.success) {
        setSuccess(`Asesor creado con éxito. Código: ${data.commercialCode}`);
        if (data.activationLink) {
          setActivationLink(data.activationLink);
        }
        
        setName("");
        setEmail("");
        setPhone("");
        setAssignedStates("");
        setSpecialties("");
        setCommissionPlanId("STANDARD_TIER_1");

        await loadAdvisors();
      } else {
        setError("Error al crear el asesor.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "No se pudo crear el asesor.");
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Enlace copiado al portapapeles.");
    } catch (err) {
      alert("No se pudo copiar el enlace.");
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white">Asesores Comerciales</h1>
        <p className="mt-3 text-slate-400">
          Gestión de asesores, comisiones y enlaces de Discovery.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-300">
          {success}
          {isOwner && activationLink && (
            <div className="mt-3 p-3 bg-slate-900 rounded-xl border border-slate-700">
              <p className="text-sm font-bold text-amber-300 mb-2">SMTP no disponible. Contingencia (Propietario): Enlace manual de activación:</p>
              <div className="flex items-center gap-2">
                <input readOnly value={activationLink} className="flex-1 bg-black p-2 rounded text-xs text-slate-300" />
                <button onClick={() => copyToClipboard(activationLink)} className="px-3 py-2 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-600">Copiar</button>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Crear Asesor (Provisión Segura)</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre completo"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono (Opcional)"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <select
            value={commissionPlanId}
            onChange={(e) => setCommissionPlanId(e.target.value)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="STANDARD_TIER_1">Tier 1 - Standard</option>
            <option value="EXECUTIVE_TIER_2">Tier 2 - Executive</option>
            <option value="PARTNER_TIER_3">Tier 3 - Partner</option>
          </select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            value={assignedStates}
            onChange={(e) => setAssignedStates(e.target.value)}
            placeholder="Estados asignados (separados por coma, ej. Tabasco, Querétaro)"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="Especialidades (separadas por coma, ej. HCM, Manufactura)"
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Al crear al asesor, se le enviará un correo de activación. El sistema generará automáticamente su código comercial y enlace de prospección.
        </p>

        <button
          onClick={handleCreateAdvisor}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
        >
          {isLoading ? "Provisionando..." : "Crear Asesor y Enviar Invitación"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Directorio Comercial</h2>

        <div className="space-y-3">
          {advisors.map((advisor) => (
            <article key={advisor.id} className="rounded-2xl border border-slate-800 p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    {advisor.name}
                    {advisor.advisorStatus === 'SUSPENDED' && (
                      <span className="bg-red-900/50 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30">
                        SUSPENDIDO
                      </span>
                    )}
                    {advisor.invitationStatus === 'PENDING' && (
                      <span className="bg-amber-900/50 text-amber-400 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">
                        INVITACIÓN PENDIENTE
                      </span>
                    )}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{advisor.email}</p>
                </div>
                
                {advisor.commercialCode && (
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Código Comercial</span>
                    <p className="font-mono font-bold text-cyan-400 text-lg">{advisor.commercialCode}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex flex-col overflow-hidden mr-4">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Discovery Link General</span>
                  <span className="text-sm text-slate-300 truncate font-mono mt-1">
                    {advisor.discoveryLink || 'No generado aún'}
                  </span>
                </div>
                {advisor.discoveryLink && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => copyToClipboard(advisor.discoveryLink!)} 
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold"
                    >
                      Copiar
                    </button>
                    <button 
                      onClick={() => window.open(`https://wa.me/?text=Hola, te comparto el enlace para iniciar el diagnóstico comercial de Aura: ${advisor.discoveryLink}`, '_blank')} 
                      className="px-3 py-1.5 bg-emerald-900/50 border border-emerald-500/30 hover:bg-emerald-800/50 text-emerald-400 rounded text-xs font-bold"
                    >
                      WhatsApp
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {advisor.assignedStates && advisor.assignedStates.map((state, i) => (
                  <span key={i} className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                    📍 {state}
                  </span>
                ))}
                
                {advisor.specialties && advisor.specialties.map((spec, i) => (
                  <span key={i} className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                    ⭐ {spec}
                  </span>
                ))}

                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                  Plan: {advisor.commissionPlanId || 'N/A'}
                </span>
              </div>
            </article>
          ))}

          {!advisors.length && (
            <p className="text-slate-500">No existen asesores registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}