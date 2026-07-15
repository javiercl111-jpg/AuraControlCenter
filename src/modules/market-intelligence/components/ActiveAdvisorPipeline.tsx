import { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../config/firebase";
import type { InegiCompany } from "../types/inegi";

function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const cleaned = email.trim().toLowerCase();
  if (cleaned === "no disponible" || cleaned === "n/a" || cleaned === "no aplica" || cleaned === "") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

function getCleanEmailHref(email: string | null | undefined): string {
  if (!isValidEmail(email)) return "";
  return `mailto:${email!.trim().toLowerCase()}`;
}

function getCleanPhoneHref(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.trim().toLowerCase();
  if (cleaned === "no disponible" || cleaned === "n/a" || cleaned === "") return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `tel:${digits}`;
}

function getCleanWebHref(web: string | null | undefined): string {
  if (!web) return "";
  const cleaned = web.trim();
  if (cleaned.toLowerCase() === "no disponible" || cleaned.toLowerCase() === "n/a" || cleaned === "") return "";
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  return `https://${cleaned}`;
}

interface ActiveAdvisorPipelineProps {
  advisorId: string;
  onSelectCompany: (company: InegiCompany) => void;
}

export function ActiveAdvisorPipeline({ advisorId, onSelectCompany }: ActiveAdvisorPipelineProps) {
  const [assignedCompanies, setAssignedCompanies] = useState<InegiCompany[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [replenishing, setReplenishing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Discard Modal State
  const [discardModalOpen, setDiscardModalOpen] = useState<boolean>(false);
  const [companyToDiscard, setCompanyToDiscard] = useState<InegiCompany | null>(null);
  const [discardReason, setDiscardReason] = useState<string>("NO_INTEREST");
  const [discardReasonText, setDiscardReasonText] = useState<string>("");
  const [discarding, setDiscarding] = useState<boolean>(false);

  const hasRequestedReplenish = useRef<boolean>(false);

  // 1. Reactive subscription to assigned companies in Firestore
  useEffect(() => {
    if (!advisorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Query companies where assignedAdvisorId matches advisorId
    // Note: status is either NEW or CONTACTED
    const q = query(
      collection(db, "market_companies"),
      where("assignedAdvisorId", "==", advisorId)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: InegiCompany[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as InegiCompany);
        });

        // Sort locally by opportunityScore desc, priority desc as desempate
        list.sort((a, b) => {
          const scoreA = a.opportunityScore || 0;
          const scoreB = b.opportunityScore || 0;
          return scoreB - scoreA;
        });

        setAssignedCompanies(list);
        setLoading(false);

        // 2. Auto-replenish if active count is less than 10, and not already replenishing
        if (list.length < 10 && !replenishing && !hasRequestedReplenish.current) {
          triggerReplenish();
        }
      },
      (err) => {
        console.error("Error cargando pipeline:", err);
        setError("Fallo al subscribirse al pipeline activo.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [advisorId]);

  // Trigger replenish call
  const triggerReplenish = async () => {
    if (replenishing || hasRequestedReplenish.current) return;
    setReplenishing(true);
    hasRequestedReplenish.current = true;
    setError(null);

    try {
      const replenishFn = httpsCallable<any, any>(functions, "replenishAdvisorPipeline");
      const idempotencyKey = `replenish_${advisorId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await replenishFn({
        advisorId,
        targetSize: 10,
        idempotencyKey
      });

      console.log("[Pipeline Replenish] Response:", response.data);
    } catch (err: any) {
      console.error("[Pipeline Replenish] Error:", err);
      setError("No se pudo reponer el pipeline automáticamente: " + (err.message || "Error desconocido"));
    } finally {
      setReplenishing(false);
      // Reset ref after a short delay to allow subscription to catch up and prevent double calls
      setTimeout(() => {
        hasRequestedReplenish.current = false;
      }, 3000);
    }
  };

  // Mark as contacted (update in-memory and Firestore status of company)
  const handleMarkContacted = async (company: InegiCompany) => {
    try {
      const companyRef = doc(db, "market_companies", company.id);
      await updateDoc(companyRef, {
        status: "CONTACTED",
        updatedAt: new Date().toISOString()
      });

      // Update active assignment status as well
      if (company.activeAssignmentId) {
        const assignmentRef = doc(db, "commercial_pipeline_assignments", company.activeAssignmentId);
        await updateDoc(assignmentRef, {
          status: "CONTACTED",
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error("Error al marcar como contactado:", err);
      setError("No se pudo actualizar el estado de contacto: " + err.message);
    }
  };

  // Open discard modal
  const openDiscardModal = (company: InegiCompany) => {
    setCompanyToDiscard(company);
    setDiscardReason("NO_INTEREST");
    setDiscardReasonText("");
    setDiscardModalOpen(true);
  };

  // Confirm discard
  const handleConfirmDiscard = async () => {
    if (!companyToDiscard || !companyToDiscard.activeAssignmentId) return;

    setDiscarding(true);
    setError(null);

    try {
      const discardFn = httpsCallable<any, any>(functions, "discardPipelineProspect");
      const idempotencyKey = `discard_${companyToDiscard.activeAssignmentId}_${Date.now()}`;
      
      await discardFn({
        assignmentId: companyToDiscard.activeAssignmentId,
        reasonCode: discardReason,
        reasonText: discardReasonText,
        idempotencyKey
      });

      setDiscardModalOpen(false);
      setCompanyToDiscard(null);
    } catch (err: any) {
      console.error("Error al descartar prospecto:", err);
      setError("No se pudo descartar el prospecto: " + (err.message || "Error desconocido"));
    } finally {
      setDiscarding(false);
    }
  };

  if (loading && assignedCompanies.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-900/50 border border-slate-800 rounded-xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-slate-400 text-sm">Cargando Pipeline Activo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-800 rounded-xl backdrop-blur-md">
        <div>
          <h3 className="text-md font-semibold text-slate-100 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Mi Pipeline Activo ({assignedCompanies.length}/10)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Prospectos prioritarios asignados para gestión inmediata.
          </p>
        </div>
        
        <button
          onClick={() => triggerReplenish()}
          disabled={replenishing || assignedCompanies.length >= 10}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/90 text-indigo-50 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
        >
          {replenishing ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b border-indigo-50"></div>
              Reponiendo...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
              </svg>
              Reponer Pipeline
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-800/50 p-3 rounded-lg flex items-start gap-2.5">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {assignedCompanies.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/20 border border-dashed border-slate-800 rounded-xl">
          <p className="text-sm text-slate-400">No tienes prospectos asignados en este momento.</p>
          <button
            onClick={() => triggerReplenish()}
            className="mt-3 inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold bg-indigo-600 text-indigo-50 rounded-lg hover:bg-indigo-500 transition-all"
          >
            Aprovisionar 10 Prospectos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignedCompanies.map((company) => {
            const priorityColors = 
              company.priorityLevel === "CRITICAL" ? "bg-red-950/40 text-red-400 border border-red-800/40" :
              company.priorityLevel === "HIGH" ? "bg-amber-950/40 text-amber-400 border border-amber-800/40" :
              "bg-slate-800/50 text-slate-400 border border-slate-700/50";

            return (
              <div 
                key={company.id}
                className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityColors}`}>
                      {company.priorityLevel || "MEDIUM"}
                    </span>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-900/30">
                      Score: {company.opportunityScore}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-100 mt-2 text-sm line-clamp-1">
                    {company.nombreComercial || company.razonSocial}
                  </h4>
                  
                  <div className="flex gap-2 mt-1.5 text-xs text-slate-400 flex-wrap">
                    <span className="bg-slate-800/40 px-2 py-0.5 rounded text-[11px] border border-slate-800">
                      {company.commercialIndustryLabel || company.sector || "Otros Sectores"}
                    </span>
                    <span className="bg-slate-800/40 px-2 py-0.5 rounded text-[11px] border border-slate-800">
                      {company.estado}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2 text-xs">
                    {/* Correo */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {isValidEmail(company.email) ? (
                        <a
                          href={getCleanEmailHref(company.email)}
                          className="hover:text-indigo-300 hover:underline truncate max-w-[200px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.email}
                        </a>
                      ) : (
                        <span className="text-slate-500">Correo no disponible</span>
                      )}
                    </div>

                    {/* Teléfono */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 00.099.281L7.75 7.75a10 10 0 005.678 5.678l1.24-1.24a1 1 0 01.285-.101l2.2.549a1 1 0 01.724.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {getCleanPhoneHref(company.telefono) ? (
                        <a
                          href={getCleanPhoneHref(company.telefono)}
                          className="hover:text-indigo-300 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.telefono}
                        </a>
                      ) : (
                        <span className="text-slate-500">Teléfono no disponible</span>
                      )}
                    </div>

                    {/* Sitio Web */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      {getCleanWebHref(company.sitioWeb) ? (
                        <a
                          href={getCleanWebHref(company.sitioWeb)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-indigo-300 hover:underline truncate max-w-[200px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.sitioWeb}
                        </a>
                      ) : (
                        <span className="text-slate-500">Sitio web no disponible</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSelectCompany(company)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 transition-colors"
                      title="Ver Detalles"
                    >
                      Detalles
                    </button>
                    {company.status !== "CONTACTED" && (
                      <button
                        onClick={() => handleMarkContacted(company)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-emerald-950/40 hover:text-emerald-400 hover:border-emerald-800 border border-slate-700/50 transition-colors"
                        title="Marcar como Contactado"
                      >
                        Contactar
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => openDiscardModal(company)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-900/30 text-red-500 hover:bg-red-950/20 hover:border-red-900/60 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discard Modal */}
      {discardModalOpen && companyToDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Descartar Prospecto</h3>
              <p className="text-xs text-slate-400 mt-1">
                ¿Por qué deseas descartar a <strong>{companyToDiscard.nombreComercial || companyToDiscard.razonSocial}</strong>?
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Motivo del Descarte</label>
                <select
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="NO_INTEREST">Sin Interés / Rechazado</option>
                  <option value="BAD_CONTACT_DATA">Datos de contacto incorrectos</option>
                  <option value="UNREACHABLE">Incontactable</option>
                  <option value="DUPLICATE">Duplicado</option>
                  <option value="OUT_OF_TARGET">Fuera de perfil / Segmento incorrecto</option>
                  <option value="OTHER">Otro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Comentarios adicionales (Opcional)</label>
                <textarea
                  value={discardReasonText}
                  onChange={(e) => setDiscardReasonText(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Detalles sobre la decisión..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDiscardModalOpen(false)}
                disabled={discarding}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                disabled={discarding}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-red-50 disabled:bg-slate-800 disabled:text-slate-500 transition-colors flex items-center gap-1.5"
              >
                {discarding ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-red-50"></div>
                    Descartando...
                  </>
                ) : (
                  "Descartar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActiveAdvisorPipeline;
