import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Target,
  ArrowRight,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  BadgeAlert,
} from "lucide-react";
import type { InegiCompany } from "../types/inegi";
import { generateAuraSalesAdvice } from "../services/auraSalesAdvisorService";

interface AuraSalesAdvisorPanelProps {
  company: InegiCompany;
}

export default function AuraSalesAdvisorPanel({ company }: AuraSalesAdvisorPanelProps) {
  const advice = generateAuraSalesAdvice(company);

  const [copied, setCopied] = useState(false);
  const [activeObjectionIdx, setActiveObjectionIdx] = useState<number | null>(null);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(true);
  const [isObjectionsOpen, setIsObjectionsOpen] = useState(true);

  const handleCopySpeech = () => {
    navigator.clipboard.writeText(advice.openingSpeech);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Formateadores de moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-md hover:border-slate-700/80 transition-all duration-300 space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-cyan-500/10 p-2 border border-cyan-500/20 text-cyan-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Aura Sales Advisor</h3>
            <p className="text-xs text-slate-400">Asesor de ventas inteligente AI-Ready</p>
          </div>
        </div>

        {/* Priority & conversion badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border ${
              advice.priorityLabel === "CRITICAL"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : advice.priorityLabel === "HIGH"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : advice.priorityLabel === "MEDIUM"
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                : "bg-slate-800/40 text-slate-400 border-slate-700/30"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Prioridad: {advice.priorityLabel}
          </span>

          <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 border border-indigo-500/25">
            Probabilidad: {advice.conversionProbability}% ({advice.confidenceLevel})
          </span>
        </div>
      </div>

      {/* Razón de Contacto */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-cyan-400" />
          ¿Por qué vale la pena contactar?
        </h4>
        <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/30 rounded-xl p-4 border border-slate-900 font-medium">
          {advice.whyContact}
        </p>
      </div>

      {/* Ecosistemas / Solución Aura Recomendada */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          Solución Aura Recomendada
        </h4>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {advice.recommendedSolutions.map((sol, index) => {
            const isFirst = sol.product.includes(advice.recommendedFirstProduct);
            return (
              <div
                key={index}
                className={`relative rounded-xl border p-4 transition duration-200 ${
                  isFirst
                    ? "bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/50"
                    : "bg-slate-900/25 border-slate-800 hover:border-slate-700"
                }`}
              >
                {isFirst && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-cyan-400 px-2 py-0.5 text-[9px] font-extrabold uppercase text-slate-950 tracking-wider">
                    Primer Producto
                  </span>
                )}
                <div className="font-bold text-sm text-white">{sol.product}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90 mt-0.5">
                  {sol.suite}
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{sol.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primer Speech de Llamada */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
            Speech sugerido para primera llamada
          </h4>
          <button
            onClick={handleCopySpeech}
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar Speech</span>
              </>
            )}
          </button>
        </div>
        <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4 font-mono text-xs leading-relaxed text-indigo-200">
          {advice.openingSpeech}
        </div>
      </div>

      {/* Discovery Questions Section */}
      <div className="border border-slate-800/80 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsDiscoveryOpen(!isDiscoveryOpen)}
          className="flex w-full items-center justify-between bg-slate-900/20 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-350 hover:bg-slate-900/40 transition"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-cyan-400" />
            Preguntas de descubrimiento (Discovery)
          </span>
          {isDiscoveryOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {isDiscoveryOpen && (
          <div className="p-4 bg-slate-950/20 border-t border-slate-850 divide-y divide-slate-900">
            {advice.discoveryQuestions.map((q, idx) => (
              <div key={idx} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold">
                  {idx + 1}
                </span>
                <span className="text-xs text-slate-300 leading-relaxed font-sans">{q}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Objections and Responses Accordion */}
      <div className="border border-slate-800/80 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsObjectionsOpen(!isObjectionsOpen)}
          className="flex w-full items-center justify-between bg-slate-900/20 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-350 hover:bg-slate-900/40 transition"
        >
          <span className="flex items-center gap-2">
            <BadgeAlert className="h-4 w-4 text-cyan-400" />
            Manejo de objeciones comunes
          </span>
          {isObjectionsOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {isObjectionsOpen && (
          <div className="p-4 bg-slate-950/20 border-t border-slate-850 space-y-2">
            {advice.possibleObjections.map((obj, idx) => {
              const isOpen = activeObjectionIdx === idx;
              return (
                <div key={idx} className="rounded-lg border border-slate-900 bg-slate-950/40 overflow-hidden">
                  <button
                    onClick={() => setActiveObjectionIdx(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-slate-300 hover:bg-slate-900/20 transition"
                  >
                    <span>💬 "{obj}"</span>
                    {isOpen ? (
                      <ChevronUp className="h-3 w-3 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-slate-500" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-900 text-xs text-slate-400 leading-relaxed bg-slate-900/10">
                      <span className="font-bold text-cyan-450">Respuesta sugerida: </span>
                      {advice.objectionResponses[idx]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Siguiente Acción */}
      <div className="rounded-xl bg-cyan-950/10 border border-cyan-500/20 p-4">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" />
          Siguiente paso comercial recomendado
        </div>
        <div className="mt-1.5 text-xs text-white leading-relaxed font-bold font-sans">
          {advice.nextRecommendedAction}
        </div>
      </div>

      {/* MRR / ARR Estimado */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/15 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              MRR Estimado
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {formatCurrency(advice.estimatedMrr)} <span className="text-xs text-slate-450 font-medium">MXN/mes</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/15 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ARR Estimado
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {formatCurrency(advice.estimatedArr)} <span className="text-xs text-slate-450 font-medium">MXN/año</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
