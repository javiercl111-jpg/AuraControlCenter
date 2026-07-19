import { useState, useEffect } from "react";
import type { DiscoverySession } from "../types/discoveryTypes";
import RadiografiaEmpresarialModal from "./RadiografiaEmpresarialModal";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

interface RequestExecutiveDocumentRequest {
  reportId: string;
  sessionToken?: string;
}

interface RequestExecutiveDocumentResponse {
  status: "READY" | "GENERATING" | "REVOKED" | "ERROR";
  reportId?: string;
  reportType?: string;
  documentVersion?: string;
  downloadUrl?: string;
  expiresAt?: string;
  generatedAt?: string;
  retryAfterSeconds?: number;
  safeErrorCode?: string;
}
interface ExecutiveBriefingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  session: DiscoverySession | null;
}

export default function ExecutiveBriefingDrawer({
  isOpen,
  onClose,
  session,
}: ExecutiveBriefingDrawerProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isRadiografiaModalOpen, setIsRadiografiaModalOpen] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [currentStage, setCurrentStage] = useState<string>("DISCOVERY_COMPLETED");
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoDate, setDemoDate] = useState("");
  const [demoTime, setDemoTime] = useState("");
  const [demoNotes, setDemoNotes] = useState("");

  useEffect(() => {
    if (!isOpen || !session) return;
    const fetchStage = async () => {
      try {
        const { collection, query, where, getDocs, limit } = await import("firebase/firestore");
        const { db } = await import("../../../config/firebase");
        const q = query(collection(db, "platform_leads"), where("smartBusinessDossierId", "==", session.id), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const lead = snap.docs[0].data();
          if (lead.lifecycleStatus) {
            setCurrentStage(lead.lifecycleStatus);
          }
        }
      } catch (err) {
        console.error("Error fetching lead stage:", err);
      }
    };
    fetchStage();
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  const {
    companyName,
    contactName,
    createdAt,
    executiveBriefingDraft,
    businessAssessmentDraft,
    radiografiaEmpresarialDraft,
    salesAdvisorContext,
    conversationHistory,
  } = session;

  const formattedDate = createdAt?.toDate ? createdAt.toDate().toLocaleDateString() : "Fecha desconocida";

  const handleCopyOpening = () => {
    if (salesAdvisorContext?.recommendedOpeningLine) {
      navigator.clipboard.writeText(salesAdvisorContext.recommendedOpeningLine);
      alert("Apertura sugerida copiada al portapapeles.");
    }
  };

  const handleCommercialAction = async (action: "MARK_CONTACTED" | "SCHEDULE_DEMO") => {
    if (action === "SCHEDULE_DEMO") {
      if (!demoDate || !demoTime) {
        alert("Seleccione fecha y hora.");
        return;
      }
      const selected = new Date(`${demoDate}T${demoTime}`);
      if (isNaN(selected.getTime()) || selected.getTime() < Date.now()) {
        alert("Fecha de demo inválida o en el pasado.");
        return;
      }
    }
    
    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, "updateProspectCommercialStage");
      const payload: any = {
        dossierId: session.id,
        action,
      };
      
      if (action === "SCHEDULE_DEMO") {
        payload.scheduledAt = new Date(`${demoDate}T${demoTime}`).toISOString();
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        payload.notes = demoNotes;
      }
      
      const res = await updateFn(payload);
      const data = res.data as any;
      if (data.success && data.lifecycleStatus) {
        setCurrentStage(data.lifecycleStatus);
        if (action === "SCHEDULE_DEMO") {
          setShowDemoModal(false);
          alert("Demo programada exitosamente.");
        } else {
          alert("Prospecto marcado como contactado.");
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "functions/not-found") {
         alert("Dossier no asociado a un prospecto, o prospecto no encontrado.");
      } else if (err.code === "functions/permission-denied") {
         alert("Acceso denegado. No tienes permisos sobre este prospecto.");
      } else {
         alert("Error al actualizar la sesión: " + err.message);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadPdf = async (reportType: "EXTERNAL_RADIOGRAFIA" | "INTERNAL_BRIEFING") => {
    setDownloadingDoc(reportType);
    setDownloadError("");

    // reportId is constructed as sessionId_reportType_v1.0
    // The service can resolve it if it's not present, or we can build it:
    const documentVersion = "1.0";
    const reportId = `${session.id}_${reportType}_v${documentVersion}`;

    try {
      const requestDocFn = httpsCallable<RequestExecutiveDocumentRequest, RequestExecutiveDocumentResponse>(
        functions,
        "requestExecutiveDocument"
      );
      const res = await requestDocFn({ reportId });

      const data = res.data;
      if (data.status === "READY" && data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      } else if (data.status === "GENERATING") {
        setDownloadError("El documento se está generando. Por favor intente en unos segundos.");
      } else if (data.status === "REVOKED") {
        setDownloadError("El documento ha sido revocado.");
      } else {
        setDownloadError("Error en la preparación del documento.");
      }
    } catch (error: any) {
      console.error("Download error:", error);
      setDownloadError("No se pudo obtener el documento. Verifique sus permisos.");
    } finally {
      setDownloadingDoc(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity">
      <div className="flex h-full w-full max-w-2xl flex-col bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto animate-slideLeft font-sans">
        
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 backdrop-blur px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">{companyName}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">Contacto: {contactName} • Creado: {formattedDate}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition">
            &times;
          </button>
        </header>

        <div className="flex-1 p-6 space-y-8">
          
          {/* Executive Summary */}
          <section>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Executive Summary</h3>
              <button
                onClick={() => handleDownloadPdf("INTERNAL_BRIEFING")}
                disabled={downloadingDoc !== null}
                className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 bg-cyan-900/30 hover:bg-cyan-900/60 px-3 py-1 rounded-md transition border border-cyan-500/20 disabled:opacity-50"
              >
                {downloadingDoc === "INTERNAL_BRIEFING" ? "Descargando..." : "Descargar Briefing"}
              </button>
            </div>
            {downloadError && downloadingDoc === "INTERNAL_BRIEFING" && (
              <p className="text-rose-400 text-[10px] mb-2">{downloadError}</p>
            )}
            {executiveBriefingDraft ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                <p className="text-sm text-slate-300 leading-relaxed">{executiveBriefingDraft.summary}</p>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Key Observations</h4>
                  <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                    {executiveBriefingDraft.keyObservations?.map((obs, i) => <li key={i}>{obs}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-xl border border-slate-800">Draft no disponible.</p>
            )}
          </section>

          {/* Business Assessment */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 border-b border-slate-800 pb-2">Business Assessment</h3>
            {businessAssessmentDraft ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Maturity Score</span>
                  <span className="text-4xl font-black text-emerald-400">{businessAssessmentDraft.score}</span>
                  <span className="text-[10px] text-slate-600">/100</span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Process Gaps</h4>
                  <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                    {businessAssessmentDraft.processGaps?.length ? 
                      businessAssessmentDraft.processGaps.map((gap, i) => <li key={i}>{gap}</li>) : 
                      <li>No gaps identified</li>
                    }
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-xl border border-slate-800">Assessment no disponible.</p>
            )}
          </section>

          {/* Radiografía & Modules */}
          <section>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Aura Radiografía</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsRadiografiaModalOpen(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-purple-300 bg-purple-900/30 hover:bg-purple-900/60 px-3 py-1 rounded-md transition border border-purple-500/20"
                >
                  Visualizar
                </button>
                <button
                  onClick={() => handleDownloadPdf("EXTERNAL_RADIOGRAFIA")}
                  disabled={downloadingDoc !== null}
                  className="text-[10px] font-bold uppercase tracking-widest text-purple-300 bg-purple-900/30 hover:bg-purple-900/60 px-3 py-1 rounded-md transition border border-purple-500/20 disabled:opacity-50"
                >
                  {downloadingDoc === "EXTERNAL_RADIOGRAFIA" ? "Descargando..." : "Descargar PDF"}
                </button>
              </div>
            </div>
            {downloadError && downloadingDoc === "EXTERNAL_RADIOGRAFIA" && (
              <p className="text-rose-400 text-[10px] mb-2">{downloadError}</p>
            )}
            {radiografiaEmpresarialDraft ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Overall Status</h4>
                  <p className="text-sm font-semibold text-purple-300">{radiografiaEmpresarialDraft.overallStatus}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Recommended Modules</h4>
                  <div className="flex flex-wrap gap-2">
                    {radiografiaEmpresarialDraft.recommendedModules?.map((mod, i) => (
                      <span key={i} className="rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs text-purple-300">
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-xl border border-slate-800">Radiografía no generada.</p>
            )}
          </section>

          {/* Sales Advisor Context & Actions */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 border-b border-slate-800 pb-2">Sales Context & Actions</h3>
            {salesAdvisorContext ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                    {salesAdvisorContext.qualificationStatus}
                  </span>
                  {salesAdvisorContext.alertFlags?.map((flag, i) => (
                    <span key={i} className="rounded-md border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-400 uppercase">
                      ⚠️ {flag}
                    </span>
                  ))}
                </div>
                
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 relative group">
                  <p className="text-xs text-slate-300 italic">"{salesAdvisorContext.recommendedOpeningLine}"</p>
                  <button 
                    onClick={handleCopyOpening}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-slate-800 text-[10px] px-2 py-1 rounded text-white transition-opacity"
                  >
                    Copiar
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={handleCopyOpening} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition">
                    Copiar Apertura
                  </button>
                  {["DISCOVERY_COMPLETED", "CONTACT_PENDING", "QUALIFIED", "NEW"].includes(currentStage) && (
                    <button 
                      onClick={() => handleCommercialAction("MARK_CONTACTED")}
                      disabled={isUpdating}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      {isUpdating ? "Marcando..." : "Marcar como Contactado"}
                    </button>
                  )}
                  {currentStage === "CONTACTED" && (
                    <button 
                      onClick={() => setShowDemoModal(true)}
                      disabled={isUpdating}
                      className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
                    >
                      Programar Demo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-xl border border-slate-800">Contexto de ventas no disponible.</p>
            )}
          </section>

          {/* Conversation History Log */}
          <section>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 hover:text-white transition"
            >
              <span>Ver Historial de Conversación</span>
              <span>{showHistory ? "▲" : "▼"}</span>
            </button>
            {showHistory && (
              <div className="mt-3 space-y-3 rounded-2xl bg-slate-950 p-4 border border-slate-800 h-64 overflow-y-auto">
                {(() => {
                  const visibleHistory = conversationHistory?.filter(
                    (msg: any) => ["user", "assistant", "aura"].includes(msg.role)
                  ) || [];
                  if (visibleHistory.length === 0) {
                    return <p className="text-xs text-slate-500 text-center italic">Historial no disponible o sin mensajes públicos.</p>;
                  }
                  return visibleHistory.map((msg: any, idx: number) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl p-3 text-[11px] leading-relaxed ${
                        msg.role === "user" ? "bg-cyan-900/50 text-cyan-100 rounded-tr-none" : "bg-slate-800 text-slate-300 rounded-tl-none"
                      }`}>
                        <strong className="block text-[9px] uppercase tracking-wider mb-1 opacity-50">
                          {msg.role}
                        </strong>
                        {msg.content}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </section>

        </div>
      </div>
      
      {showDemoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-[400px] shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Programar Demo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha</label>
                <input 
                  type="date" 
                  value={demoDate} 
                  onChange={(e) => setDemoDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Hora (Local)</label>
                <input 
                  type="time" 
                  value={demoTime} 
                  onChange={(e) => setDemoTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notas (Opcional)</label>
                <textarea 
                  value={demoNotes} 
                  onChange={(e) => setDemoNotes(e.target.value)}
                  maxLength={1000}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white resize-none h-24"
                  placeholder="Detalles sobre la demo..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowDemoModal(false)}
                  className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleCommercialAction("SCHEDULE_DEMO")}
                  disabled={isUpdating}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
                >
                  {isUpdating ? "Guardando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <RadiografiaEmpresarialModal
        isOpen={isRadiografiaModalOpen}
        onClose={() => setIsRadiografiaModalOpen(false)}
        session={session}
      />
    </div>
  );
}
