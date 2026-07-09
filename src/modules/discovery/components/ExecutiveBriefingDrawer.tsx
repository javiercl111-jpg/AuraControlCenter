import { useState } from "react";
import type { DiscoverySession } from "../types/discoveryTypes";
import DiscoverySessionService from "../services/discoverySessionService";

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

  const handleMarkFollowUp = async () => {
    setIsUpdating(true);
    try {
      await DiscoverySessionService.updateDiscoverySessionStatus(session.id, "FOLLOW_UP_SCHEDULED");
      alert("Sesión marcada para seguimiento exitosamente.");
    } catch (err: any) {
      alert("Error al actualizar la sesión: " + err.message);
    } finally {
      setIsUpdating(false);
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 border-b border-slate-800 pb-2">Executive Summary</h3>
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3 border-b border-slate-800 pb-2">Aura Radiografía</h3>
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
                  <button 
                    onClick={handleMarkFollowUp} 
                    disabled={isUpdating}
                    className="flex-1 rounded-xl bg-amber-600 py-2.5 text-xs font-semibold text-white hover:bg-amber-500 transition disabled:opacity-50"
                  >
                    {isUpdating ? "Marcando..." : "Marcar Seguimiento"}
                  </button>
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
                {conversationHistory?.length ? conversationHistory.map((msg: any, idx: number) => (
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
                )) : (
                  <p className="text-xs text-slate-500 text-center italic">No hay historial disponible.</p>
                )}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
