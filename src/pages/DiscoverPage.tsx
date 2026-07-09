import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import type { DiscoveryLink, AuraThoughtState } from "../modules/discovery/types/discoveryTypes";
import DiscoveryEngine, { DISCOVERY_QUESTIONS } from "../modules/discovery/services/discoveryEngine";
import DossierBuilderService from "../modules/discovery/services/dossierBuilderService";

export default function DiscoverPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();

  const [linkInfo, setLinkInfo] = useState<DiscoveryLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Conversational Flow States
  const [screen, setScreen] = useState<"welcome" | "chat" | "completed">("welcome");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // Real-time Chat log
  const [chatLog, setChatLog] = useState<{ sender: "aura" | "user"; text: string }[]>([]);
  const [isAuraTyping, setIsAuraTyping] = useState(false);

  // Thoughts Sidebar
  const [thoughts, setThoughts] = useState<AuraThoughtState>({
    hypothesis: "Iniciando canal de prospección. Esperando sector industrial para formular hipótesis operativa inicial.",
    confidence: 15,
    nextSteps: "Identificar el giro comercial principal del prospecto.",
  });

  // Load link information on mount
  useEffect(() => {
    async function loadLink() {
      if (!linkId || linkId === "demo") {
        setLinkInfo({
          id: "demo",
          companyName: "Empresa Demo S.A.",
          contactName: "Invitado",
          createdAt: new Date(),
          createdBy: "system",
          status: "pending",
          dossierId: "",
        });
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "market_discovery_links", linkId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setError("El enlace de consultoría inteligente no es válido o ha expirado.");
          setLoading(false);
          return;
        }

        const data = snap.data() as DiscoveryLink;
        if (data.status === "completed") {
          setError("Esta sesión de consultoría inteligente ya ha sido completada anteriormente. ¡Muchas gracias!");
          setLoading(false);
          return;
        }

        setLinkInfo(data);
      } catch (err: any) {
        console.error("Error al cargar enlace Discovery:", err);
        setError("Error al conectar con el servidor: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadLink();
  }, [linkId]);

  // Welcome page text starts chat
  function handleStartChat() {
    setScreen("chat");
    triggerAuraQuestion(0, {});
  }

  // Trigger Aura Question with typing animation
  function triggerAuraQuestion(stepIndex: number, currentAnswers: Record<string, string>) {
    if (stepIndex >= DISCOVERY_QUESTIONS.length) {
      handleComplete(currentAnswers);
      return;
    }

    const question = DISCOVERY_QUESTIONS[stepIndex];
    let text = question.text;

    // Personalizar pregunta en base al sector
    if (question.id === "employees_method") {
      const selectedSector = currentAnswers["sector"] || "tu sector";
      text = `Entendido. En el sector de "${selectedSector}", la rotación y la coordinación horaria son críticas. ¿Cuántos colaboradores activos tienen actualmente y qué método utilizan para programar sus turnos?`;
    }

    setIsAuraTyping(true);
    setTimeout(() => {
      setChatLog((prev) => [...prev, { sender: "aura", text }]);
      setIsAuraTyping(false);
    }, 1200);

    // Actualizar pensamientos
    const t = DiscoveryEngine.getAuraThoughts(currentAnswers);
    setThoughts(t);
  }

  // Handle User Response Selection
  function handleUserSelect(value: string, label: string) {
    const question = DISCOVERY_QUESTIONS[currentStepIndex];
    const updatedAnswers = { ...answers, [question.id]: value };
    setAnswers(updatedAnswers);

    // Añadir respuesta al chat log
    setChatLog((prev) => [...prev, { sender: "user", text: label }]);

    const nextIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextIndex);

    // Triggerear siguiente pregunta
    triggerAuraQuestion(nextIndex, updatedAnswers);
  }

  // Finalizar consultoría y persistir resultados
  async function handleComplete(finalAnswers: Record<string, string>) {
    if (!linkInfo) return;
    setIsAuraTyping(true);
    try {
      await DossierBuilderService.saveDiscoverySession(
        linkInfo.id,
        linkInfo.companyName,
        linkInfo.contactName,
        finalAnswers
      );
      setTimeout(() => {
        setScreen("completed");
        setIsAuraTyping(false);
      }, 1500);
    } catch (err: any) {
      console.error("Error al guardar sesión de Discovery:", err);
      alert("Error al guardar expediente: " + err.message);
      setIsAuraTyping(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-400 tracking-wider">Aura Discovery Portal™</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-4 font-sans text-center">
        <div className="max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
          <span className="text-3xl">⚠️</span>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Acceso Restringido</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
          >
            Ir a Control Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-cyan-500/30">
      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-45 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌌</span>
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-cyan-400">Aura</span>
            <span className="text-[10px] text-slate-500 ml-1.5 uppercase font-medium tracking-wider">Discovery Portal™</span>
          </div>
        </div>
        <div className="rounded-full bg-cyan-950/30 border border-cyan-500/20 px-3 py-1 text-[9px] font-extrabold text-cyan-400 uppercase tracking-widest animate-pulse">
          Aura Intelligence V1
        </div>
      </header>

      {/* Screen 1: Welcome Greeting */}
      {screen === "welcome" && linkInfo && (
        <main className="flex-1 flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-xl rounded-3xl border border-slate-900 bg-slate-900/40 p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-lg shadow-inner">
                🤖
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Aura Intelligence™</h2>
                <p className="text-[10px] text-cyan-400">Consultor Inteligente</p>
              </div>
            </div>

            <div className="space-y-4 text-slate-300 text-xs leading-relaxed font-normal">
              <p className="text-sm font-semibold text-white">Bienvenido, {linkInfo.contactName}.</p>
              <p>
                Soy <strong className="text-cyan-400">Aura Intelligence</strong>. Antes de recomendar cualquier solución tecnológica, quiero comprender cómo funciona tu organización en <strong className="text-white">{linkInfo.companyName}</strong>.
              </p>
              <p>
                Mi trabajo no consiste en venderte software. Mi trabajo consiste en ayudarte a descubrir oportunidades de mejora operativa y mitigar fugas financieras.
              </p>
              <p>
                Durante esta conversación construiré tu <strong>Expediente Empresarial Inteligente</strong> en segundo plano.
              </p>
              <p>
                Al finalizar recibirás gratuitamente tu <strong>Radiografía Empresarial Aura™</strong> y prepararé un Executive Briefing para nuestro consultor de negocios.
              </p>
              <p className="text-[10px] text-slate-500 italic">Esta conversación toma aproximadamente 8 minutos.</p>
            </div>

            <button
              onClick={handleStartChat}
              className="w-full rounded-xl bg-cyan-600 px-5 py-3 text-xs font-bold text-white hover:bg-cyan-500 transition shadow-lg active:scale-98"
            >
              Comenzar Diagnóstico
            </button>
          </div>
        </main>
      )}

      {/* Screen 2: Interactive Conversational Engine */}
      {screen === "chat" && linkInfo && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid gap-6 md:grid-cols-3 animate-fadeIn">
          {/* Chat Panel */}
          <div className="md:col-span-2 flex flex-col rounded-3xl border border-slate-900 bg-slate-900/20 shadow-xl overflow-hidden backdrop-blur-sm h-[calc(100vh-140px)]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatLog.map((chat, idx) => (
                <div
                  key={idx}
                  className={`flex ${chat.sender === "user" ? "justify-end" : "justify-start"} animate-fadeIn`}
                >
                  <div
                    className={`max-w-md rounded-2xl p-4 text-xs leading-relaxed ${
                      chat.sender === "user"
                        ? "bg-cyan-600 text-white rounded-tr-none"
                        : "bg-slate-900 border border-slate-800/80 text-slate-200 rounded-tl-none"
                    }`}
                  >
                    {chat.text}
                  </div>
                </div>
              ))}

              {isAuraTyping && (
                <div className="flex justify-start animate-pulse">
                  <div className="max-w-xs rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center gap-1.5 rounded-tl-none">
                    <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce delay-75" />
                    <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce delay-150" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Selection Options */}
            <div className="border-t border-slate-900 bg-slate-950/60 p-4">
              {currentStepIndex < DISCOVERY_QUESTIONS.length && !isAuraTyping ? (
                <div className="space-y-2">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Selecciona tu respuesta:
                  </span>
                  <div className="grid gap-2">
                    {DISCOVERY_QUESTIONS[currentStepIndex].options?.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleUserSelect(opt.value, opt.label)}
                        className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-900 transition active:scale-99"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-500 italic">
                  Aura está procesando el análisis del expediente...
                </div>
              )}
            </div>
          </div>

          {/* Real-time Aura Thoughts Sidebar */}
          <div className="flex flex-col rounded-3xl border border-slate-900 bg-slate-900/20 p-5 shadow-xl space-y-5 h-[calc(100vh-140px)] justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <span>🧠</span> Pensamiento de Aura
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Live telemetry</span>
              </div>

              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/10 p-4 space-y-2 animate-fadeIn">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400">Hipótesis de Trabajo</span>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{thoughts.hypothesis}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Nivel de Confianza</span>
                  <span className="text-cyan-400 font-mono">{thoughts.confidence}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-900">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-700 ease-out"
                    style={{ width: `${thoughts.confidence}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Próxima Acción de IA</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">{thoughts.nextSteps}</p>
            </div>
          </div>
        </main>
      )}

      {/* Screen 3: Diagnostic Finished / Summary */}
      {screen === "completed" && linkInfo && (
        <main className="flex-1 flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-xl rounded-3xl border border-slate-900 bg-slate-900/40 p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-sm text-center">
            <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-center text-xl shadow-inner">
              ✨
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">¡Expediente Completado!</h2>
              <p className="text-xs text-slate-400">
                Gracias por completar la experiencia, {linkInfo.contactName}. Hemos recopilado la información necesaria.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left space-y-3 font-sans">
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Radiografía Empresarial Aura™ (Estructura lista en Control Center)</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Executive Briefing™ (Draft de consultoría generado)</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Contexto de Asesor de Ventas (Sales Advisor Context creado)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Nuestro consultor de Aura revisará el expediente consolidado y se pondrá en contacto contigo muy pronto para agendar tu presentación comercial.
            </p>

            <button
              onClick={() => navigate("/login")}
              className="w-full rounded-xl bg-slate-800 px-5 py-3 text-xs font-semibold text-white hover:bg-slate-700 transition active:scale-98"
            >
              Regresar al Portal
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
