import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";
import { getCurrentUserRole, checkUserCapability } from "../services/rbacService";
import PermissionDenied from "../components/PermissionDenied";
import { getSalesAdvisors } from "../services/platformSalesAdvisorService";
import { getMexicoStatesWithMetadata } from "../services/mexicoStatesService";
import { MEXICO_STATES, type MexicoStateOption } from "../types/mexicoStates";
import type { PlatformSalesAdvisor } from "../types/platformSalesAdvisor";

export default function SalesAdvisorsPage() {
  const [advisors, setAdvisors] = useState<PlatformSalesAdvisor[]>([]);
  const [mexicoStates, setMexicoStates] = useState<MexicoStateOption[]>([]);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [platformRole, setPlatformRole] = useState("SALES_ADVISOR");
  const [commercialTier, setCommercialTier] = useState("TIER_1");
  const [commissionPlanId, setCommissionPlanId] = useState("STANDARD_TIER_1");
  const [selectedStateCodes, setSelectedStateCodes] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState("");

  const [stateSearch, setStateSearch] = useState("");
  const [showStatesDropdown, setShowStatesDropdown] = useState(false);

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
    async function checkRole() {
      try {
        const hasManageCap = await checkUserCapability("advisors.manage");
        const role = await getCurrentUserRole();
        setHasAccess(hasManageCap);
        setIsOwner(role === "SUPER_ADMIN" || role === "FOUNDER" || role === "PLATFORM_OWNER");
        if (hasManageCap) {
          await loadAdvisors();
          const statesMeta = await getMexicoStatesWithMetadata();
          setMexicoStates(statesMeta);
        }
      } catch (err) {
        console.error("Error checking role:", err);
        setHasAccess(false);
      }
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
      const mappedStates = selectedStateCodes
        .map(code => MEXICO_STATES.find(s => s.code === code)?.label)
        .filter(Boolean) as string[];

      const result = await provisionCommercialAdvisor({
        name,
        email,
        phone,
        assignedStates: mappedStates,
        assignedStateCodes: selectedStateCodes,
        assignedStateLabels: mappedStates,
        assignedCities: [],
        specialties: specialties.split(",").map(s => s.trim()).filter(Boolean),
        platformRole,
        commercialTier,
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
        setPlatformRole("SALES_ADVISOR");
        setCommercialTier("TIER_1");
        setCommissionPlanId("STANDARD_TIER_1");
        setSelectedStateCodes([]);
        setSpecialties("");
        setStateSearch("");
        setShowStatesDropdown(false);

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

  const toggleStateCode = (code: string) => {
    setSelectedStateCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const filteredStates = mexicoStates.filter(state =>
    state.label.toLowerCase().includes(stateSearch.toLowerCase()) ||
    state.code.toLowerCase().includes(stateSearch.toLowerCase())
  );

  if (hasAccess === null) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent"></div>
      </div>
    );
  }

  if (hasAccess === false) {
    return <PermissionDenied />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white">Asesores Comerciales</h1>
        <p className="mt-3 text-slate-400">
          Gestión de perfiles de asesores, roles de plataforma, planes comerciales y cobertura territorial.
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
                <input readOnly value={activationLink} className="flex-1 bg-black p-2 rounded text-xs text-slate-300 font-mono" />
                <button onClick={() => copyToClipboard(activationLink)} className="px-3 py-2 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-600">Copiar</button>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Crear Asesor (Provisión Integral)</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre Completo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo del asesor"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Teléfono (Opcional)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Número de contacto"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rol de Plataforma</label>
            <select
              value={platformRole}
              onChange={(e) => setPlatformRole(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="SALES_ADVISOR">Sales Advisor (Asesor Comercial)</option>
              <option value="PLATFORM_PARTNER">Platform Partner (Socio de Negocio)</option>
              <option value="SALES_DIRECTOR">Sales Director (Director Comercial)</option>
              <option value="CONSULTANT">Consultant (Consultor)</option>
              <option value="READ_ONLY">Read Only (Solo Lectura)</option>
              <option value="PLATFORM_OWNER">Platform Owner (Propietario Global)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nivel Comercial</label>
            <select
              value={commercialTier}
              onChange={(e) => setCommercialTier(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="TIER_1">Tier 1 - Junior</option>
              <option value="TIER_2">Tier 2 - Senior</option>
              <option value="TIER_3_PARTNER">Tier 3 - Partner</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Plan de Comisión</label>
            <select
              value={commissionPlanId}
              onChange={(e) => setCommissionPlanId(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="STANDARD_TIER_1">Standard Tier 1</option>
              <option value="EXECUTIVE_TIER_2">Executive Tier 2</option>
              <option value="PARTNER_TIER_3">Partner Tier 3</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Cobertura Territorial Multi-select */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cobertura Territorial (Estados)</label>
            <div 
              onClick={() => setShowStatesDropdown(prev => !prev)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white cursor-pointer flex justify-between items-center"
            >
              <span className="text-slate-400 text-sm">
                {selectedStateCodes.length === 0 ? "Seleccionar estados..." : `${selectedStateCodes.length} seleccionado(s)`}
              </span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${showStatesDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {showStatesDropdown && (
              <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-xl">
                <input
                  type="text"
                  placeholder="Buscar estado..."
                  value={stateSearch}
                  onChange={(e) => setStateSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full mb-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
                <div className="space-y-1">
                  {filteredStates.map(state => {
                    const isChecked = selectedStateCodes.includes(state.code);
                    return (
                      <div 
                        key={state.code}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStateCode(state.code);
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-900 cursor-pointer text-sm text-white"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="rounded border-slate-700 text-cyan-400 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                          />
                          {state.label}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px]">
                          {state.imported ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                              Con Datos
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded border border-slate-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
                              Vacío
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected chips */}
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedStateCodes.map(code => {
                const state = MEXICO_STATES.find(s => s.code === code);
                return (
                  <span key={code} className="inline-flex items-center gap-1 bg-cyan-400/10 border border-cyan-400/30 text-cyan-200 text-xs px-2.5 py-1 rounded-full font-medium">
                    {state?.label}
                    <button 
                      type="button" 
                      onClick={() => toggleStateCode(code)} 
                      className="text-cyan-400 hover:text-cyan-200 ml-1 font-bold focus:outline-none"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Especialidades</label>
            <input
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              placeholder="HCM, Manufactura, Servicios (separadas por coma)"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Al crear al asesor, se le enviará un correo de activación. El sistema generará automáticamente su código comercial y enlace de prospección.
        </p>

        <button
          onClick={handleCreateAdvisor}
          disabled={isLoading}
          className="mt-6 rounded-2xl bg-cyan-400 hover:bg-cyan-300 transition-colors px-6 py-3 font-bold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Provisionando..." : "Crear Asesor y Enviar Invitación"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Directorio Comercial</h2>

        <div className="space-y-4">
          {advisors.map((advisor) => (
            <article key={advisor.id} className="rounded-2xl border border-slate-800 p-5 bg-slate-950/40">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <h3 className="font-bold text-white text-lg flex flex-wrap items-center gap-2">
                    {advisor.name}
                    
                    {/* Role badge */}
                    <span className="bg-cyan-950/50 text-cyan-300 text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/20 uppercase font-bold tracking-wider">
                      {advisor.platformRole || "SALES_ADVISOR"}
                    </span>

                    {/* Status badge */}
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
                  {advisor.phone && <p className="text-slate-400 text-xs mt-0.5">📞 {advisor.phone}</p>}
                  {advisor.uid && (
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      UID: {advisor.uid}
                    </span>
                  )}
                </div>
                
                {advisor.commercialCode && (
                  <div className="text-left md:text-right bg-slate-900/50 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Código Comercial</span>
                    <p className="font-mono font-bold text-cyan-400 text-lg mt-0.5">{advisor.commercialCode}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Enlace Discovery</span>
                  <span className="text-xs text-slate-300 truncate font-mono mt-1">
                    {advisor.discoveryLink || 'No generado aún'}
                  </span>
                </div>
                {advisor.discoveryLink && (
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => copyToClipboard(advisor.discoveryLink!)} 
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Copiar
                    </button>
                    <button 
                      onClick={() => window.open(`https://wa.me/?text=Hola, te comparto el enlace para iniciar el diagnóstico comercial de Aura: ${advisor.discoveryLink}`, '_blank')} 
                      className="px-3 py-1.5 bg-emerald-900/50 border border-emerald-500/30 hover:bg-emerald-800/50 text-emerald-400 rounded-lg text-xs font-bold transition-colors"
                    >
                      WhatsApp
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {advisor.assignedStates && advisor.assignedStates.map((state, i) => (
                  <span key={i} className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-slate-300">
                    📍 {state}
                  </span>
                ))}
                
                {advisor.specialties && advisor.specialties.map((spec, i) => (
                  <span key={i} className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-slate-300">
                    ⭐ {spec}
                  </span>
                ))}

                <span className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-slate-300">
                  Nivel: {advisor.commercialTier || 'TIER_1'}
                </span>

                <span className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-slate-300">
                  Plan: {advisor.commissionPlanId || 'N/A'}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-end border-t border-slate-800/50 pt-3">
                {(advisor.invitationStatus === 'PENDING' || advisor.invitationStatus === 'SEND_FAILED') && (
                  <button
                    onClick={() => handleAdvisorAccessAction("reinvite", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-500/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Reenviar Invitación
                  </button>
                )}

                {advisor.advisorStatus === 'ACTIVE' && (
                  <button
                    onClick={() => handleAdvisorAccessAction("resetPassword", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Restablecer Contraseña
                  </button>
                )}

                {advisor.advisorStatus === 'ACTIVE' ? (
                  <button
                    onClick={() => handleAdvisorAccessAction("deactivate", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-red-900/40 border border-red-500/20 hover:bg-red-900/60 text-red-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Desactivar Acceso
                  </button>
                ) : (
                  <button
                    onClick={() => handleAdvisorAccessAction("reactivate", advisor.id!)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-emerald-900/40 border border-emerald-500/20 hover:bg-emerald-900/60 text-emerald-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Reactivar Acceso
                  </button>
                )}
              </div>
            </article>
          ))}

          {!advisors.length && (
            <p className="text-slate-500 text-center py-6">No existen asesores registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}