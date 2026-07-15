import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";
import { getCurrentUserRole } from "../services/rbacService";
import PermissionDenied from "../components/PermissionDenied";

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
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

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
      const allowedRoles = ["SUPER_ADMIN", "FOUNDER", "SALES_DIRECTOR", "PLATFORM_OWNER"];
      const allowed = allowedRoles.includes(role || "");
      setHasAccess(allowed);
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

  async function handleAdvisorAccessAction(action: "reinvite" | "deactivate" | "reactivate" | "resetPassword", advisorId: string) {
    setIsLoading(true);
    setError("");
    setSuccess("");
    setActivationLink("");

    try {
      const manageAdvisorAccess = httpsCallable(functions, "manageAdvisorAccess");
      const result = await manageAdvisorAccess({ action, advisorId });
      const data = result.data as any;

      if (data.success) {
        setSuccess(data.message || "Operación realizada con éxito.");
        if (data.activationLink) {
          setActivationLink(data.activationLink);
        }
        await loadAdvisors();
      } else {
        setError("Error en la operación.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "No se pudo realizar la acción.");
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

  if (hasAccess === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-cyan-300">
        Validando permisos de administrador...
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <PermissionDenied description="Tu rol de seguridad actual en Aura Control Center no cuenta con las capacidades requeridas para gestionar asesores comerciales." />
    );
  }

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
                    {advisor.advisorStatus === 'INACTIVE' && (
                      <span className="bg-red-950 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/20 uppercase font-bold tracking-wider">
                        INACTIVO
                      </span>
                    )}
                    {advisor.advisorStatus === 'SUSPENDED' && (
                      <span className="bg-red-900/50 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 uppercase font-bold tracking-wider">
                        SUSPENDIDO
                      </span>
                    )}
                    {advisor.advisorStatus === 'ACTIVE' && (
                      <span className="bg-emerald-950 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase font-bold tracking-wider">
                        ACTIVO
                      </span>
                    )}
                    {(advisor.invitationStatus === 'PENDING' || advisor.invitationStatus === 'SEND_FAILED') && (
                      <span className="bg-amber-950 text-amber-400 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 uppercase font-bold tracking-wider">
                        INVITACIÓN PENDIENTE
                      </span>
                    )}
                    {advisor.lastSafeErrorCode === 'AUTH_CONFLICT' && (
                      <span className="bg-amber-950 text-amber-500 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 uppercase font-bold tracking-wider">
                        CONFLICTO DE AUTH
                      </span>
                    )}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{advisor.email}</p>
                  {advisor.uid && (
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      UID: {advisor.uid}
                    </span>
                  )}
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

              <div className="mt-4 flex gap-2 justify-end border-t border-slate-800/30 pt-3">
                {(advisor.invitationStatus === 'PENDING' || advisor.invitationStatus === 'SEND_FAILED') && (
                  <button
                    onClick={() => handleAdvisorAccessAction("reinvite", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-500/20 rounded text-xs font-bold transition"
                  >
                    Reenviar Invitación
                  </button>
                )}

                {advisor.advisorStatus === 'ACTIVE' && (
                  <button
                    onClick={() => handleAdvisorAccessAction("resetPassword", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition"
                  >
                    Restablecer Contraseña
                  </button>
                )}

                {advisor.advisorStatus === 'ACTIVE' ? (
                  <button
                    onClick={() => handleAdvisorAccessAction("deactivate", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-red-900/40 border border-red-500/20 hover:bg-red-900/60 text-red-300 rounded text-xs font-bold transition"
                  >
                    Desactivar Acceso
                  </button>
                ) : (
                  <button
                    onClick={() => handleAdvisorAccessAction("reactivate", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-emerald-900/40 border border-emerald-500/20 hover:bg-emerald-900/60 text-emerald-300 rounded text-xs font-bold transition"
                  >
                    Reactivar Acceso
                  </button>
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