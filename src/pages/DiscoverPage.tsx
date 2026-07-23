import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

import DossierBuilderService from "../modules/discovery/services/dossierBuilderService";
import ConversationOrchestrator from "../modules/intelligence/engine/services/ConversationOrchestrator";
import ConversationState from "../modules/intelligence/engine/domain/ConversationState";
import { ReflectionEngine } from "../modules/intelligence/engine/services/ReflectionEngine";
import type { ReflectionState, ConfidenceMatrix } from "../modules/intelligence/engine/types/reflection.types";
import type { ConversationPhase } from "../modules/intelligence/engine/types/orchestrator.types";
import {
  createDiscoveryIdempotencyKey,
  createDiscoveryLink,
  exchangeDiscoveryToken,
  getDiscoveryNavigationTarget,
  resolveAdvisorByCode,
  resolveDiscoverySession,
} from "../modules/discovery/services/discoveryLinkService";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

interface SessionLinkInfo {
  linkId: string;
  companyName: string;
  contactName: string;
}

interface GenerateDiscoveryReportRequest {
  sessionId: string;
  prospectId: string;
  linkId: string;
  sessionToken: string;
  isInternalOnly?: boolean;
}

interface GenerateDiscoveryReportResponse {
  success: boolean;
  reportId: string;
  message: string;
}

interface RequestExecutiveDocumentRequest {
  reportId: string;
  linkId: string;
  sessionToken: string;
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

type DiscoveryErrorType =
  | "SESSION_STARTING"
  | "TOKEN_ALREADY_USED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "APP_CHECK_REQUIRED"
  | "APP_CHECK_THROTTLED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

function mapDiscoveryError(err: unknown): DiscoveryErrorType {
  if (!err) return "UNKNOWN";

  const errorObj = err as Record<string, unknown>;
  const fbCode = typeof errorObj.code === "string" ? errorObj.code : "";
  const details = errorObj.details as Record<string, unknown> | undefined;
  const safeCode = details && typeof details.safeErrorCode === "string" ? details.safeErrorCode : "";
  const messageStr = typeof errorObj.message === "string" ? errorObj.message : "";

  // SESSION_STARTING
  if (
    fbCode === "functions/already-exists" ||
    fbCode === "already-exists" ||
    safeCode.includes("SESSION_ALREADY_CREATED_RECENTLY") ||
    messageStr.includes("SESSION_ALREADY_CREATED_RECENTLY")
  ) {
    return "SESSION_STARTING";
  }

  // APP_CHECK_THROTTLED
  if (
    fbCode === "functions/resource-exhausted" ||
    messageStr.includes("throttled") ||
    (messageStr.includes("403") && messageStr.includes("AppCheck"))
  ) {
    return "APP_CHECK_THROTTLED";
  }

  // TOKEN_ALREADY_USED
  if (
    safeCode === "TOKEN_ALREADY_USED" ||
    messageStr.includes("used") ||
    messageStr.includes("no longer pending")
  ) {
    return "TOKEN_ALREADY_USED";
  }

  // TOKEN_EXPIRED
  if (
    safeCode === "TOKEN_EXPIRED" ||
    messageStr.includes("expired")
  ) {
    return "TOKEN_EXPIRED";
  }

  // TOKEN_INVALID
  if (
    fbCode === "functions/not-found" ||
    fbCode === "functions/permission-denied" ||
    safeCode === "LINK_NOT_FOUND" ||
    safeCode === "TOKEN_INVALID" ||
    messageStr.includes("not found") ||
    messageStr.includes("Invalid token")
  ) {
    return "TOKEN_INVALID";
  }

  // APP_CHECK_REQUIRED
  if (
    safeCode === "APP_CHECK_REQUIRED" ||
    messageStr.includes("APP_CHECK") ||
    messageStr.includes("AppCheck")
  ) {
    return "APP_CHECK_REQUIRED";
  }

  // NETWORK_ERROR
  if (
    fbCode === "unavailable" ||
    fbCode === "functions/unavailable" ||
    messageStr.includes("network") ||
    messageStr.includes("connect")
  ) {
    return "NETWORK_ERROR";
  }

  return "UNKNOWN";
}

export default function DiscoverPage() {
  const showAuraThoughts = false; // Disabled by default for public experience
  const { linkId, commercialCode } = useParams<{ linkId?: string, commercialCode?: string }>();
  const navigate = useNavigate();

  const [linkInfo, setLinkInfo] = useState<SessionLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Conversational Flow States
  const [screen, setScreen] = useState<"landing" | "preform" | "welcome" | "chat" | "completed">("welcome");

  // Pending Token State for Landing
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);

  // Pre-form States
  const [advisorContext, setAdvisorContext] = useState<Record<string, unknown> & { name?: string } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [consent, setConsent] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [acquisitionSource, setAcquisitionSource] = useState("DIRECT");
  const [manualAdvisorCode, setManualAdvisorCode] = useState("");
  const preformAttemptRef = useRef<{ signature: string; idempotencyKey: string } | null>(null);

  // Real-time Chat log
  const [chatLog, setChatLog] = useState<{ sender: "aura" | "user"; text: string }[]>([]);
  const [isAuraTyping, setIsAuraTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatLog, isAuraTyping]);

  // AI Orchestrator & State Instances
  const orchestratorRef = useRef<ConversationOrchestrator | null>(null);
  const stateRef = useRef<ConversationState | null>(null);
  const reflectionStateRef = useRef<ReflectionState | null>(null);
  const confidenceMatrixRef = useRef<ConfidenceMatrix | null>(null);

  // Thoughts Sidebar (Telemetry Mirror)
  const [telemetry, setTelemetry] = useState({
    intent: "INITIALIZING",
    reason: "Awaiting sector to formulate initial hypothesis",
    confidence: 0,
    hypotheses: [] as string[],
    internalSummary: "",
    usefulResponses: 0,
    turnCount: 0,
    askedIntents: [] as string[],
    validationStatus: true,
    reflectionAction: "-",
    relevance: 0,
    coherence: 100,
    contradictions: 0,
    dimensions: 0,
    phase: "DISCOVERY" as ConversationPhase
  });

  // Load link information on mount
  useEffect(() => {
    async function loadLink() {
      if (commercialCode) {
        try {
          const advisor = await resolveAdvisorByCode(commercialCode);
          if (advisor) {
            setAdvisorContext(advisor);
          }
          setScreen("preform");
        } catch (err: unknown) {
          console.error("Error resolving advisor:", err);
          setScreen("preform");
        } finally {
          setLoading(false);
        }
        return;
      }

      // If no linkId and no commercialCode, it's a direct website visit
      if (!linkId || linkId === "undefined" || linkId === "null" || linkId.trim() === "") {
        setScreen("preform");
        setLoading(false);
        return;
      }

      if (linkId === "demo") {
        setLinkInfo({
          linkId: "demo",
          companyName: "Empresa Demo S.A.",
          contactName: "Invitado"
        });
        setLoading(false);
        return;
      }

      if (import.meta.env.DEV) {
        console.info("PUBLIC_DISCOVERY_PATH_MATCHED", { pathnameMatched: true });
      }

      try {
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.substring(1)); // Remove '#'
        const access = hashParams.get("access");

        if (access) {
          // We don't automatically exchange it. We show landing.
          setPendingAccessToken(access);
          setScreen("landing");
          setLoading(false);
          return;
        }

        const sessionToken = sessionStorage.getItem(`discovery_session_token_${linkId}`);
        if (!sessionToken) {
          setError("El enlace no contiene un token de acceso o la sesión ha caducado.");
          setLoading(false);
          return;
        }

        const result = await resolveDiscoverySession(linkId, sessionToken);

        if (result.status === "completed") {
          setError("Esta sesión de consultoría inteligente ya ha sido completada anteriormente. ¡Muchas gracias!");
          setLoading(false);
          return;
        }

        setLinkInfo({
          linkId: result.id,
          companyName: result.companyName,
          contactName: result.contactName
        });
      } catch (err) {
        console.error("Error al cargar enlace Discovery:", err);
        const mappedError = mapDiscoveryError(err);

        if (import.meta.env.DEV) {
          console.info("TOKEN_EXCHANGE_FAILED", {
            pathnameMatched: true,
            hasAccessFragment: new URLSearchParams(window.location.hash.slice(1)).has("access"),
            hasSessionToken: !!sessionStorage.getItem(`discovery_session_token_${linkId}`),
            safeErrorCode: mappedError,
            appCheckConfigured: !!import.meta.env.VITE_RECAPTCHA_SITE_KEY
          });
        }
        setError(mappedError);
      } finally {
        setLoading(false);
      }
    }
    loadLink();
  }, [linkId, commercialCode]);

  async function handlePreformSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !email.trim() || !consent) {
      alert("Por favor completa los campos obligatorios y acepta la política de privacidad.");
      return;
    }

    setCreatingLink(true);
    try {
      let finalAdvisorContext = advisorContext;

      if (!finalAdvisorContext && manualAdvisorCode.trim()) {
        const advisor = await resolveAdvisorByCode(manualAdvisorCode.trim());
        if (advisor) finalAdvisorContext = advisor;
      }

      const attemptSignature = JSON.stringify({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: role.trim(),
        location: location.trim(),
        acquisitionSource,
        commercialCode:
          (typeof finalAdvisorContext?.commercialCode === "string"
            ? finalAdvisorContext.commercialCode
            : manualAdvisorCode
          ).trim().toUpperCase(),
      });

      if (preformAttemptRef.current?.signature !== attemptSignature) {
        preformAttemptRef.current = {
          signature: attemptSignature,
          idempotencyKey: createDiscoveryIdempotencyKey(),
        };
      }

      const newLink = await createDiscoveryLink({
        companyName,
        contactName,
        email,
        phone,
        role,
        location,
        consent,
        acquisitionSource,
        idempotencyKey: preformAttemptRef.current.idempotencyKey,
      }, finalAdvisorContext || undefined);

      navigate(getDiscoveryNavigationTarget(newLink), { replace: true });
    } catch (err) {
      console.error(err);
      alert("Error al iniciar sesión de descubrimiento.");
      setCreatingLink(false);
    }
  }

  const isExchangingToken = useRef(false);

  async function handleStartFromLanding() {
    if (!linkId || !pendingAccessToken) return;
    if (isExchangingToken.current) return;
    isExchangingToken.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await exchangeDiscoveryToken(linkId, pendingAccessToken);
      sessionStorage.setItem(`discovery_session_token_${linkId}`, result.sessionAccessToken);

      // Clear URL fragment without exposing token
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

      setLinkInfo({
        linkId: result.linkId,
        companyName: result.companyName,
        contactName: result.contactName
      });
      setPendingAccessToken(null);
      setScreen("welcome");
    } catch (err) {
      console.error("Error exchanging token:", err);
      const mappedError = mapDiscoveryError(err);
      setError(mappedError);
    } finally {
      setLoading(false);
      isExchangingToken.current = false;
    }
  }

  // Welcome page text starts chat
  function handleStartChat() {
    if (!linkInfo) return;

    // Instantiate Orchestrator and States
    orchestratorRef.current = new ConversationOrchestrator();
    const tempReflectionEngine = new ReflectionEngine();
    reflectionStateRef.current = tempReflectionEngine.createInitialState();
    confidenceMatrixRef.current = reflectionStateRef.current.matrix;
    stateRef.current = new ConversationState(
      linkId || "demo",
      linkInfo.companyName,
      "Industria General" // We can update this later if we know it
    );

    setScreen("chat");
    processTurn(""); // Start the conversation
  }

  async function processTurn(userText: string) {
    if (!orchestratorRef.current || !stateRef.current || !reflectionStateRef.current || !confidenceMatrixRef.current || !linkInfo) return;

    // Record User Message
    if (userText) {
      stateRef.current.addMessage("user", userText);
      setChatLog(prev => [...prev, { sender: "user", text: userText }]);
    }

    setIsAuraTyping(true);

    try {
      // Build Engine Input
      const engineInput = {
        companyName: linkInfo.companyName,
        industry: stateRef.current.industry,
        context: {},
        currentResponse: userText,
        conversationHistory: stateRef.current.getHistory(),
        hypotheses: stateRef.current.getHypotheses(),
        confidenceLevel: stateRef.current.currentConfidence,
        partialDossier: stateRef.current.dossier,
        usefulResponsesCount: stateRef.current.usefulResponsesCount,
        turnCount: stateRef.current.turnCount,
        askedIntents: Array.from(stateRef.current.askedIntents),
        askedQuestions: Array.from(stateRef.current.askedQuestions)
      };

      // Build Orchestrator Input
      const input = {
        engineInput,
        conversationStateSnapshot: stateRef.current.getSnapshot(),
        reflectionState: reflectionStateRef.current,
        confidenceMatrix: confidenceMatrixRef.current
      };

      // Simulate Network/Processing Delay for realism
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Process logic
      const output = await orchestratorRef.current.processTurn(input);

      // Apply Output to State
      reflectionStateRef.current = output.updatedReflectionState;
      confidenceMatrixRef.current = output.updatedConfidenceMatrix;

      stateRef.current.conversationPhase = output.updatedConversationPhase;
      stateRef.current.pendingSummary = output.pendingSummary;
      if (output.updatedFallbackCount !== undefined) {
        stateRef.current.fallbackConsecutiveCount = output.updatedFallbackCount;
      }

      if (output.conversationOutput && (output.shouldAdvance || output.shouldPersistEvidence)) {
        stateRef.current.updateConfidence(output.conversationOutput.updatedConfidence);
        stateRef.current.updateDossier(output.conversationOutput.updatedDossier);
        output.conversationOutput.newHypotheses.forEach(h => stateRef.current?.addHypothesis(h));
        output.conversationOutput.discardedHypotheses.forEach(h => stateRef.current?.removeHypothesis(h));
      }

      // Update trackers only if advanced
      if (output.shouldAdvance) {
        stateRef.current.turnCount += 1;
        stateRef.current.askedIntents.add(output.finalIntent);
        stateRef.current.askedQuestions.add(output.finalMessage);
        if (userText) {
          stateRef.current.usefulResponsesCount += 1;
        }
      }

      // Add Aura Message to State
      stateRef.current.addMessage("aura", output.finalMessage);
      setChatLog(prev => [...prev, { sender: "aura", text: output.finalMessage }]);

      // Update Telemetry UI
      setTelemetry({
        intent: output.finalIntent,
        reason: output.conversationOutput?.reason || output.reflectionOutput.internalReflection || "Clarification or Summary logic",
        confidence: stateRef.current.currentConfidence,
        hypotheses: stateRef.current.getHypotheses(),
        internalSummary: output.conversationOutput?.internalSummary || output.reflectionOutput.internalReflection,
        usefulResponses: stateRef.current.usefulResponsesCount,
        turnCount: stateRef.current.turnCount,
        askedIntents: Array.from(stateRef.current.askedIntents),
        validationStatus: !output.reflectionOutput.isTooShort && !output.reflectionOutput.isAmbiguous && !output.reflectionOutput.hasContradiction,
        reflectionAction: output.reflectionOutput.recommendedAction,
        relevance: output.reflectionOutput.responseRelevance,
        coherence: output.reflectionOutput.coherenceScore,
        contradictions: output.reflectionOutput.contradictionDetails.length,
        dimensions: output.reflectionOutput.dimensionsUpdated.length,
        phase: output.updatedConversationPhase
      });

      // Check Completion
      if (output.shouldComplete) {
        handleComplete();
      }
    } catch (err) {
      console.error("Error processing turn:", err);
    } finally {
      setIsAuraTyping(false);
    }

  }

  function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isAuraTyping) return;
    setInputValue("");
    processTurn(text);
  }

  // State for report generation
  const [reportStatus, setReportStatus] = useState<"IDLE" | "GENERATING" | "READY" | "REVOKED" | "ERROR">("IDLE");
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const hasHandledComplete = useRef(false);

  // Finalizar consultoría y persistir resultados
  async function handleComplete() {
    if (!linkInfo || !stateRef.current) return;
    if (hasHandledComplete.current) return;
    hasHandledComplete.current = true;

    setIsAuraTyping(true);
    setReportStatus("GENERATING");
    try {
      const sessionToken = sessionStorage.getItem(`discovery_session_token_${linkInfo.linkId}`);

      if (!linkInfo.linkId || !sessionToken) {
        setError("Error crítico: Faltan parámetros de sesión obligatorios.");
        setReportStatus("ERROR");
        return;
      }

      const { sessionId, prospectId } = await DossierBuilderService.saveDiscoverySession(
        linkInfo.linkId,
        linkInfo.companyName,
        linkInfo.contactName,
        stateRef.current.dossier,
        stateRef.current.getHistory(),
        stateRef.current.getSnapshot(),
        sessionToken
      );

      // Request PDF Generation
      try {
        const generateReportFn = httpsCallable<GenerateDiscoveryReportRequest, GenerateDiscoveryReportResponse>(
          functions,
          "generateDiscoveryReport"
        );
        const res = await generateReportFn({
          sessionId,
          prospectId: prospectId || "UNKNOWN",
          linkId: linkInfo.linkId,
          sessionToken,
          isInternalOnly: false
        });
        console.log("Report generated:", res.data.reportId);
        setGeneratedReportId(res.data.reportId);
        setReportStatus("READY");
      } catch (pdfErr) {
        console.error("Error generating PDF:", pdfErr);
        setReportStatus("ERROR");
      }

      setTimeout(() => {
        setScreen("completed");
        setIsAuraTyping(false);
      }, 1500);
    } catch (err: unknown) {
      console.error("Error al guardar sesión de Discovery:", err);
      alert("No fue posible finalizar el expediente en este momento. Tu conversación está guardada y puedes reintentar sin comenzar de nuevo.");
      hasHandledComplete.current = false;
      setIsAuraTyping(false);
      setReportStatus("ERROR");
    }
  }

  async function handleDownloadReport() {
    if (!generatedReportId || !linkInfo) return;
    const sessionToken = sessionStorage.getItem(`discovery_session_token_${linkInfo.linkId}`);
    if (!sessionToken) {
      setDownloadError("Sesión expirada. Por favor recargue la página e ingrese nuevamente.");
      return;
    }

    setDownloadingReport(true);
    setDownloadError("");

    try {
      const requestDocFn = httpsCallable<RequestExecutiveDocumentRequest, RequestExecutiveDocumentResponse>(
        functions,
        "requestExecutiveDocument"
      );
      const res = await requestDocFn({ reportId: generatedReportId, linkId: linkInfo.linkId, sessionToken });

      const data = res.data;
      if (data.status === "READY" && data.downloadUrl) {
        setReportStatus("READY");
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      } else if (data.status === "GENERATING") {
        setReportStatus("GENERATING");
        setTimeout(() => handleDownloadReport(), (data.retryAfterSeconds || 5) * 1000);
      } else if (data.status === "REVOKED") {
        setReportStatus("REVOKED");
        setDownloadError("Este documento ha sido revocado por razones de seguridad o actualización.");
      } else {
        setReportStatus("ERROR");
        setDownloadError("Ocurrió un error al preparar el documento.");
      }
    } catch (error: unknown) {
      console.error("Download report error:", error);
      setDownloadError("No se pudo obtener el documento. Intente nuevamente más tarde.");
    } finally {
      setDownloadingReport(false);
    }
  }

  function handleFinalize() {
    if (linkInfo?.linkId) {
      sessionStorage.removeItem(`discovery_session_token_${linkInfo.linkId}`);
    }
    if (linkId) {
      sessionStorage.removeItem(`discovery_session_token_${linkId}`);
    }
    
    window.close();
    
    setTimeout(() => {
      window.location.replace("https://auranexus.io");
    }, 150);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white font-sans p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Aura está preparando el entorno...</p>
        </div>
      </div>
    );
  }

  if (error) {
    let displayMessage: string;
    let showRetry: boolean;

    if (error === "SESSION_STARTING") {
      displayMessage = "La sesión se está iniciando. Por favor, recarga la página.";
      showRetry = true;
    } else if (error === "APP_CHECK_REQUIRED") {
      displayMessage = "No fue posible validar la seguridad de esta sesión. Actualiza la página e inténtalo nuevamente.";
      showRetry = true;
    } else if (error === "APP_CHECK_THROTTLED") {
      displayMessage = "La validación de seguridad está temporalmente bloqueada después de varios intentos fallidos. Inténtalo más tarde.";
      showRetry = true;
    } else if (error === "TOKEN_ALREADY_USED") {
      displayMessage = "Este enlace ya fue utilizado en una sesión anterior. Solicita uno nuevo a tu asesor.";
      showRetry = false;
    } else if (error === "TOKEN_EXPIRED") {
      displayMessage = "Este enlace ha expirado. Solicita uno nuevo a tu asesor.";
      showRetry = false;
    } else if (error === "TOKEN_INVALID") {
      displayMessage = "Este enlace no es válido. Verifica que hayas abierto la dirección completa.";
      showRetry = false;
    } else if (error === "NETWORK_ERROR") {
      displayMessage = "No fue posible conectar con Aura. Revisa tu conexión e inténtalo nuevamente.";
      showRetry = true;
    } else if (error === "UNKNOWN") {
      displayMessage = "No fue posible iniciar la sesión. Inténtalo nuevamente o solicita asistencia.";
      showRetry = true;
    } else {
      displayMessage = error;
      showRetry = false;
    }

    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-4 font-sans text-center">
        <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-6 shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50 text-3xl">
            ⚠️
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-white uppercase tracking-wider">Acceso Restringido</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{displayMessage}</p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {showRetry && (
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-cyan-600 px-5 py-3 text-xs font-bold text-white hover:bg-cyan-500 transition active:scale-95"
              >
                Reintentar
              </button>
            )}
            <a
              href="https://auranexus.io"
              className="inline-block w-full rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-xs font-bold text-white hover:bg-slate-700 transition active:scale-95"
            >
              Volver a Aura Nexus
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "landing") {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-white font-sans">
        <header className="p-6 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center">
              <div className="w-3 h-3 bg-slate-950 rounded-full" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Aura Discovery
            </h1>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full items-center justify-center py-20">
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-8 rounded-2xl w-full max-w-xl text-center space-y-6">
            <h2 className="text-2xl font-semibold tracking-tight">Consultoría Inteligente</h2>
            <p className="text-slate-300">
              Estás a punto de iniciar un diagnóstico empresarial guiado por Aura.
            </p>
            <p className="text-sm text-slate-500">
              No necesitas preparar información técnica. Será una conversación ejecutiva.
            </p>
            <button
              onClick={handleStartFromLanding}
              className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
            >
              Comenzar diagnóstico
            </button>
          </div>
        </main>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-cyan-500/30">
      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-45 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/branding/aura-logo-oficial-800.png" alt="Aura Logo" className="h-8 w-auto object-contain" />
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-cyan-400">Aura</span>
            <span className="text-[10px] text-slate-500 ml-1.5 uppercase font-medium tracking-wider">Discovery Portal™</span>
          </div>
        </div>
        <div className="rounded-full bg-cyan-950/30 border border-cyan-500/20 px-3 py-1 text-[9px] font-extrabold text-cyan-400 uppercase tracking-widest animate-pulse">
          Aura Intelligence V1
        </div>
      </header>

      {/* Pre-Form: Company Data (Only when accessed via general advisor link) */}
      {screen === "preform" && (
        <main className="flex-1 flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-xl rounded-3xl border border-slate-900 bg-slate-900/40 p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-lg shadow-inner">
                ✨
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Aura Intelligence™</h2>
                <p className="text-[10px] text-cyan-400">Validación de Perfil Empresarial</p>
              </div>
            </div>

            <div className="space-y-4 text-slate-300 text-xs leading-relaxed font-normal">
              {advisorContext ? (
                <p><strong>{advisorContext.name}</strong> me pidió acompañarte durante este diagnóstico empresarial. Mi objetivo es comprender mejor cómo funciona tu organización para preparar un análisis útil antes de su conversación. Por favor, ingresa los datos mínimos de tu empresa para comenzar.</p>
              ) : (
                <p>Estás a punto de iniciar un diagnóstico comercial. Por favor, ingresa los datos mínimos de tu empresa para comenzar.</p>
              )}
            </div>

            <form onSubmit={handlePreformSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre de la Empresa *</label>
                  <input required value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tu Nombre *</label>
                  <input required value={contactName} onChange={e => setContactName(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Correo Electrónico *</label>
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono (Opcional)</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cargo (Opcional)</label>
                  <input value={role} onChange={e => setRole(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Estado / Ciudad (Opcional)</label>
                  <input value={location} onChange={e => setLocation(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white" />
                </div>

                {!advisorContext && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">¿Algún asesor de Aura te invitó? (Código)</label>
                      <input value={manualAdvisorCode} onChange={e => setManualAdvisorCode(e.target.value)} placeholder="Ej. ADV123 (Opcional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">¿Cómo nos conociste?</label>
                      <select value={acquisitionSource} onChange={e => setAcquisitionSource(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white appearance-none">
                        <option value="DIRECT">Directo / Búsqueda web</option>
                        <option value="GOOGLE">Búsqueda en Google</option>
                        <option value="LINKEDIN">LinkedIn</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="EMAIL">Correo electrónico</option>
                        <option value="REFERRAL">Recomendación</option>
                        <option value="EVENT">Evento</option>
                        <option value="QR">Código QR</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
                <span className="text-[10px] text-slate-500">
                  Acepto la política de privacidad de Aura Intelligence y autorizo el procesamiento de estos datos para el diagnóstico de descubrimiento y contacto comercial.
                </span>
              </div>

              <button
                type="submit"
                disabled={creatingLink}
                className="w-full rounded-xl bg-cyan-600 px-5 py-3 text-xs font-bold text-white hover:bg-cyan-500 transition shadow-lg active:scale-98 disabled:opacity-50"
              >
                {creatingLink ? "Generando sesión..." : "Iniciar Diagnóstico"}
              </button>
            </form>
          </div>
        </main>
      )}

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
              <p className="text-[10px] text-slate-500 italic">Esta conversación toma aproximadamente 3 minutos.</p>
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
        <main className={`flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid gap-6 animate-fadeIn ${showAuraThoughts ? 'md:grid-cols-3' : 'grid-cols-1'}`}>
          {/* Chat Panel */}
          <div className={`${showAuraThoughts ? 'md:col-span-2' : 'col-span-1'} flex flex-col rounded-3xl border border-slate-900 bg-slate-900/20 shadow-xl overflow-hidden backdrop-blur-sm h-[calc(100vh-140px)]`}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
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
              <div ref={messagesEndRef} />
            </div>

            {/* Natural Text Input & Quick Suggestions */}
            <div className="border-t border-slate-900 bg-slate-950/60 p-4 space-y-3">
              {telemetry.intent === "FALLBACK_OPTIONS" && !isAuraTyping ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-amber-400 font-semibold mb-1">Opciones de recuperación:</p>
                  <button
                    onClick={() => {
                      if (stateRef.current) {
                        stateRef.current.llmModeForSession = "HEURISTIC_ONLY";
                        stateRef.current.fallbackConsecutiveCount = 0;
                      }
                      processTurn("Continuar con diagnóstico básico");
                    }}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-white hover:border-cyan-500 hover:bg-slate-800 transition"
                  >
                    Continuar con diagnóstico básico
                  </button>
                  <button
                    onClick={() => {
                      if (stateRef.current) stateRef.current.fallbackConsecutiveCount = 0;
                      setInputValue("");
                      // Just allow typing again by updating intent to something else to reveal input
                      setTelemetry(prev => ({ ...prev, intent: "CLARIFY" }));
                    }}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-white hover:border-cyan-500 hover:bg-slate-800 transition"
                  >
                    Intentar nuevamente (escribir otra respuesta)
                  </button>
                  <button
                    onClick={() => {
                      if (stateRef.current) {
                        stateRef.current.conversationPhase = "SUMMARY_REVIEW";
                      }
                      processTurn("Finalizar");
                    }}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-white hover:border-emerald-500 hover:bg-slate-800 transition"
                  >
                    Finalizar y guardar lo aprendido
                  </button>
                </div>
              ) : telemetry.phase === "SUMMARY_REVIEW" && !isAuraTyping ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => processTurn("Sí, es correcto")}
                    className="flex-1 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg"
                  >
                    ✅ Sí, es correcto
                  </button>
                  <button
                    onClick={() => {
                      // Allow user to type a correction
                      setTelemetry(prev => ({ ...prev, phase: "DISCOVERY", intent: "SUMMARY_REVIEW" }));
                      setInputValue("Quiero corregir: ");
                    }}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-xs font-bold text-white hover:bg-slate-700 transition"
                  >
                    ✏️ Quiero corregir algo
                  </button>
                </div>
              ) : (
                <>
                  {!isAuraTyping && telemetry.intent !== "SUMMARIZE" && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        onClick={() => setInputValue("Usamos Excel")}
                        className="whitespace-nowrap rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-300 hover:border-cyan-500/50 hover:bg-slate-900 transition"
                      >
                        💡 "Usamos Excel"
                      </button>
                      <button
                        onClick={() => setInputValue("Tenemos un sistema, pero no está integrado")}
                        className="whitespace-nowrap rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-300 hover:border-cyan-500/50 hover:bg-slate-900 transition"
                      >
                        💡 "Tenemos un sistema, pero no está integrado"
                      </button>
                      <button
                        onClick={() => setInputValue("Todo lo hacemos manualmente")}
                        className="whitespace-nowrap rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-300 hover:border-cyan-500/50 hover:bg-slate-900 transition"
                      >
                        💡 "Todo lo hacemos manualmente"
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleUserSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={isAuraTyping || telemetry.intent === "SUMMARIZE"}
                      placeholder={isAuraTyping ? "Aura está procesando..." : "Escribe tu respuesta aquí..."}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isAuraTyping || telemetry.intent === "SUMMARIZE"}
                      className="rounded-xl bg-cyan-600 px-6 text-xs font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50 disabled:hover:bg-cyan-600"
                    >
                      Enviar
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          {/* Real-time Aura Thoughts Sidebar */}
          {showAuraThoughts && (
          <div className="flex flex-col rounded-3xl border border-slate-900 bg-slate-900/20 p-5 shadow-xl space-y-5 h-[calc(100vh-140px)] justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <span>🧠</span> Aura Thoughts
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Live telemetry</span>
              </div>

              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/10 p-4 space-y-2 animate-fadeIn">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400">Current Phase & Intent</span>
                <p className="text-[11px] text-slate-300 leading-relaxed font-mono font-bold text-emerald-400">[{telemetry.phase}] [{telemetry.intent}]</p>

                <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400 mt-3">Cognitive Action</span>
                <p className={`text-[11px] leading-relaxed font-mono font-bold ${telemetry.reflectionAction === "CLARIFY" || telemetry.reflectionAction === "CHALLENGE" ? "text-amber-400" : "text-cyan-400"}`}>
                  [{telemetry.reflectionAction}]
                </p>

                <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-400 mt-3">Reasoning</span>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">"{telemetry.reason}"</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-center">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Relevance</span>
                  <span className="text-sm font-black text-white">{telemetry.relevance}%</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-center">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Coherence</span>
                  <span className="text-sm font-black text-white">{telemetry.coherence}%</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-center">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Contradictions</span>
                  <span className={`text-sm font-black ${telemetry.contradictions > 0 ? "text-rose-500" : "text-emerald-500"}`}>{telemetry.contradictions}</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-center">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Dims Updated</span>
                  <span className="text-sm font-black text-white">{telemetry.dimensions}</span>
                </div>
              </div>

              {telemetry.hypotheses.length > 0 && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-950/10 p-4 space-y-2 animate-fadeIn">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-400">Active Hypotheses</span>
                  <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                    {telemetry.hypotheses.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Confidence Level</span>
                  <span className="text-cyan-400 font-mono">{telemetry.confidence}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-900">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-700 ease-out"
                    style={{ width: `${telemetry.confidence}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-center">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Turnos</span>
                  <span className="text-lg font-black text-white">{telemetry.turnCount} <span className="text-xs text-slate-600">/ 8</span></span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-center">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Útiles</span>
                  <span className={`text-lg font-black ${telemetry.validationStatus ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {telemetry.usefulResponses} <span className="text-xs text-slate-600">/ 5</span>
                  </span>
                </div>
              </div>
            </div>

            {telemetry.internalSummary && (
              <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Internal Summary</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">{telemetry.internalSummary}</p>
              </div>
            )}
          </div>
          )}
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
                Gracias por completar la consultoría, {linkInfo.contactName}. Hemos recopilado la información necesaria.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left font-sans">
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Diagnóstico completado exitosamente</span>
              </div>
            </div>

            {reportStatus === "GENERATING" && (
              <div className="p-4 rounded-xl border border-cyan-900/50 bg-cyan-950/20 text-cyan-400 text-xs flex flex-col items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                Tu diagnóstico fue recibido. Estamos preparando tu Radiografía Empresarial.
              </div>
            )}

            {reportStatus === "READY" && (
              <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 space-y-3">
                <p className="text-emerald-400 text-xs font-semibold">Tu Radiografía Empresarial Aura™ está lista.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadReport}
                    disabled={downloadingReport}
                    className="flex-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/40 transition disabled:opacity-50"
                  >
                    {downloadingReport ? "Preparando..." : "Descargar Radiografía"}
                  </button>
                  {import.meta.env.VITE_DISCOVERY_EMAIL_DELIVERY_ENABLED === "true" && (
                    <button className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                      ✉️ Enviar a mi correo
                    </button>
                  )}
                </div>
                {downloadError && (
                  <p className="text-rose-400 text-[10px] text-center pt-2">{downloadError}</p>
                )}
              </div>
            )}

            {reportStatus === "REVOKED" && (
              <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/20 space-y-3">
                <p className="text-rose-400 text-xs font-semibold">Documento Revocado</p>
                <p className="text-rose-300 text-[10px] text-center pt-1">{downloadError || "Este documento ya no está disponible."}</p>
              </div>
            )}

            {reportStatus === "ERROR" && (
              <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/20 text-rose-400 text-xs">
                Tu diagnóstico fue recibido correctamente, pero no fue posible generar el documento en este momento. Nuestro equipo dará seguimiento.
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-normal">
              Nuestro consultor de Aura revisará el expediente consolidado y se pondrá en contacto contigo muy pronto para agendar tu presentación comercial.
            </p>

            <button
              onClick={handleFinalize}
              className="w-full rounded-xl bg-slate-800 px-5 py-3 text-xs font-semibold text-white hover:bg-slate-700 transition active:scale-98"
            >
              Finalizar y volver a Aura Nexus
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
