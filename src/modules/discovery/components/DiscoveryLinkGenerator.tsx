import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { createDiscoveryLink } from "../services/discoveryLinkService";

interface DiscoveryLinkGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCompanyName?: string;
  defaultContactName?: string;
}

export default function DiscoveryLinkGenerator({
  isOpen,
  onClose,
  defaultCompanyName = "",
  defaultContactName = "",
}: DiscoveryLinkGeneratorProps) {
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [contactName, setContactName] = useState(defaultContactName);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen) return null;

  function generateIdempotencyKey(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 16; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async function handleGenerate() {
    if (!companyName.trim()) {
      setError("El nombre de la empresa es obligatorio.");
      return;
    }
    if (!contactName.trim()) {
      setError("El nombre del contacto es obligatorio.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setSuccess("");

    try {
      const origin = window.location.origin;
      const idempotencyKey = generateIdempotencyKey();

      const newLink = await createDiscoveryLink({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: "asesor@auranexus.io", // Default fallback email if not asked
        phone: "",
        consent: true, // Advisor generated
        origin: "ADVISOR_SHARE",
        acquisitionSource: "DIRECT",
        idempotencyKey
      });

      const link = `${origin}/discover/${newLink.linkId}#access=${newLink.oneTimeToken}`;

      setGeneratedLink(link);
      setSuccess("¡Enlace único de Discovery generado con éxito!");
    } catch (err: any) {
      console.error("Error al generar enlace de Discovery:", err);
      setError("Error al guardar en base de datos: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  const wamessage = `Hola ${contactName}. Gracias por tu tiempo.

Antes de reunirnos contigo me gustaría comprender mejor cómo funciona tu empresa.

Aura preparó una experiencia de consultoría inteligente. No es un cuestionario. Es una conversación que nos permitirá preparar recomendaciones realmente útiles para tu organización.

Al finalizar recibirás gratuitamente tu Radiografía Empresarial Aura™. Nos tomará aproximadamente 8 minutos.

👇
${generatedLink}`;

  function handleCopyLink() {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      alert("Enlace copiado al portapapeles.");
    }
  }

  function handleCopyMessage() {
    if (generatedLink) {
      navigator.clipboard.writeText(wamessage);
      alert("Mensaje de WhatsApp copiado al portapapeles.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-sans animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Aura Discovery Portal™</h3>
              <p className="text-[10px] text-slate-400">Generar primer contacto de consultoría inteligente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-lg"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs text-emerald-400">
            {success}
          </div>
        )}

        {!generatedLink ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre de la Empresa</label>
              <input
                type="text"
                placeholder="e.g. Restaurante El Lago"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre del Contacto</label>
              <input
                type="text"
                placeholder="e.g. Carlos"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-50"
            >
              {isGenerating ? "Generando..." : "Generar Enlace Discovery"}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Enlace Único Generado</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="w-full bg-transparent text-xs text-cyan-400 font-mono focus:outline-none select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-slate-700 transition"
                >
                  Copiar
                </button>
              </div>
            </div>

            {/* Opciones de Compartido */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(wamessage)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/30 transition text-center"
              >
                <span>💬</span> WhatsApp
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent("Experiencia de Consultoría Inteligente Aura")}&body=${encodeURIComponent(wamessage)}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-950/20 py-2.5 text-xs font-semibold text-blue-400 hover:bg-blue-950/30 transition text-center"
              >
                <span>✉️</span> Correo
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(generatedLink)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition text-center"
              >
                <span>🔗</span> LinkedIn
              </a>
              <button
                onClick={handleCopyMessage}
                className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/20 py-2.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-950/30 transition text-center"
              >
                <span>📝</span> Copiar Msg
              </button>
            </div>

            {/* QR Mockup Rendering */}
            <div className="flex flex-col items-center justify-center border-t border-slate-800 pt-4 space-y-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Código QR Aura</span>
              <div className="bg-white p-3 rounded-2xl inline-block shadow-lg">
                <QRCodeCanvas value={generatedLink} size={112} level="H" />
              </div>
              <p className="text-[9px] text-slate-500">Escanea desde un dispositivo móvil para iniciar la consultoría.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
