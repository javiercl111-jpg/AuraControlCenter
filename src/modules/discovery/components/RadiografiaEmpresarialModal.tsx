
import type { DiscoverySession } from "../types/discoveryTypes";

interface RadiografiaEmpresarialModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: DiscoverySession | null;
}

export default function RadiografiaEmpresarialModal({
  isOpen,
  onClose,
  session,
}: RadiografiaEmpresarialModalProps) {
  if (!isOpen || !session) return null;

  const {
    companyName,
    contactName,
    createdAt,
    executiveBriefingDraft,
    businessAssessmentDraft,
    radiografiaEmpresarialDraft,
  } = session;

  const formattedDate = createdAt?.toDate
    ? createdAt.toDate().toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' })
    : "Fecha reciente";

  const handleCopySummary = () => {
    const score = businessAssessmentDraft?.score || 0;
    const status = radiografiaEmpresarialDraft?.overallStatus || "Evaluación inicial completada";
    
    const summaryText = `Hola ${contactName},

Comparto los resultados preliminares de la Radiografía Empresarial Aura™ elaborada para ${companyName}.

📊 Nivel de Madurez Tecnológica: ${score}/100
🔍 Estatus Operativo: ${status}

De acuerdo al diagnóstico, hemos detectado oportunidades clave de estabilización mediante la automatización de procesos internos.

Quedo a tu entera disposición para profundizar en los hallazgos y explorar el roadmap sugerido.`;

    navigator.clipboard.writeText(summaryText);
    alert("Resumen para prospecto copiado al portapapeles.");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-opacity font-sans overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fadeIn my-8">
        
        {/* Floating Actions Header */}
        <div className="absolute top-4 right-4 flex gap-3 z-10 print:hidden">
          <button
            onClick={handleCopySummary}
            className="rounded-xl bg-cyan-900/30 border border-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition shadow-lg"
          >
            Copiar Resumen Cliente
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition shadow-lg"
          >
            Cerrar Reporte
          </button>
        </div>

        {/* Future PDF Container */}
        <div id="radiografia-pdf-container" className="p-8 md:p-12 space-y-12">
          
          {/* Report Header */}
          <header className="border-b border-slate-800 pb-8 flex flex-col items-center text-center space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🌌</span>
              <div>
                <h1 className="text-sm font-black uppercase tracking-[0.3em] text-cyan-400">
                  Aura Intelligence
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Consulting Unit</p>
              </div>
            </div>
            
            <div className="mt-8 space-y-2">
              <h2 className="text-3xl font-bold text-white tracking-tight">Radiografía Empresarial Aura™</h2>
              <p className="text-sm text-slate-400 font-medium">Análisis de Madurez Tecnológica y Operativa</p>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-6 text-left border border-slate-800 bg-slate-950/50 rounded-2xl p-6 w-full max-w-2xl">
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Organización</span>
                <span className="text-sm font-semibold text-white">{companyName}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Fecha de Emisión</span>
                <span className="text-sm font-semibold text-white">{formattedDate}</span>
              </div>
            </div>
          </header>

          {/* Contexto Ejecutivo */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 border-l-2 border-cyan-500 pl-3">Contexto Ejecutivo</h3>
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              {executiveBriefingDraft?.summary || "Información de contexto ejecutivo no disponible."}
            </p>
          </section>

          {/* Maturity & Assessment */}
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 rounded-3xl border border-slate-800 bg-slate-950 p-8 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Maturity Score</span>
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
                  <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="transparent" 
                    strokeDasharray="377" 
                    strokeDashoffset={377 - (377 * (businessAssessmentDraft?.score || 0)) / 100}
                    className="text-emerald-400 transition-all duration-1000 ease-out" 
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-black text-white">{businessAssessmentDraft?.score || 0}</span>
                  <span className="text-[10px] font-medium text-emerald-400">/ 100</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-slate-950 p-8 space-y-6">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-2">
                  <span className="text-amber-500/50">✦</span> Hallazgos Principales
                </h4>
                {businessAssessmentDraft?.painPointsIdentified?.length ? (
                  <ul className="space-y-2">
                    {businessAssessmentDraft.painPointsIdentified.map((pt, i) => (
                      <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                        <span className="text-amber-500/40 mt-0.5">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No se identificaron hallazgos críticos.</p>
                )}
              </div>

              <div className="border-t border-slate-800/60 pt-6">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-3 flex items-center gap-2">
                  <span className="text-rose-400/50">✦</span> Áreas de Riesgo Operativo
                </h4>
                {businessAssessmentDraft?.processGaps?.length ? (
                  <ul className="space-y-2">
                    {businessAssessmentDraft.processGaps.map((gap, i) => (
                      <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                        <span className="text-rose-400/40 mt-0.5">•</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No se identificaron brechas de riesgo.</p>
                )}
              </div>
            </div>
          </section>

          {/* Consultative Roadmap */}
          <section className="rounded-3xl border border-cyan-900/30 bg-cyan-950/10 p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <span>💡</span> Posibles Escenarios de Optimización
            </h3>
            
            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                {radiografiaEmpresarialDraft?.potentialSavings || "Basado en los datos actuales, existe un margen considerable para optimizar la eficiencia interna."}
              </p>

              <div className="border-t border-cyan-900/30 pt-5 mt-5">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Cómo Aura podría apoyar
                </h4>
                <p className="text-xs text-slate-400 mb-4">
                  Existen capacidades dentro del ecosistema Aura que podrían apoyar este roadmap de maduración tecnológica:
                </p>
                <div className="flex flex-wrap gap-3">
                  {radiografiaEmpresarialDraft?.recommendedModules?.length ? (
                    radiografiaEmpresarialDraft.recommendedModules.map((mod, i) => (
                      <span key={i} className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200">
                        Aura {mod}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Análisis de arquitectura pendiente.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Footer Reflection */}
          <footer className="text-center pt-8 border-t border-slate-800 space-y-2">
            <p className="text-[11px] font-medium text-slate-500 tracking-wide">
              "La automatización preventiva es el pilar esencial para asegurar escalabilidad sin fricción operativa."
            </p>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-4">
              Reporte confidencial generado por Aura Intelligence
            </p>
          </footer>

        </div>
      </div>
    </div>
  );
}
