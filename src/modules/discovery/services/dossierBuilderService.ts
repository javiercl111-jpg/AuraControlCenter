
import type { DiscoverySession, SmartBusinessDossier, ExecutiveBriefingDraft, BusinessAssessmentDraft, RadiografiaEmpresarialDraft, SalesAdvisorContext } from "../types/discoveryTypes";
import type { ConversationMessage } from "../../intelligence/engine/types/conversation.types";

/**
 * Construye el SmartBusinessDossier y borradores de diagnóstico basado en el estado final.
 */
export function buildDossierPayload(
  linkId: string,
  companyName: string,
  contactName: string,
  dossierState: Partial<SmartBusinessDossier>,
  conversationHistory: ConversationMessage[],
  conversationStateSnapshot: any
): Omit<DiscoverySession, "id"> {
  
  const dossier: SmartBusinessDossier = {
    industry: dossierState.industry || "Otros",
    employees: dossierState.employees || 0,
    schedulingMethod: dossierState.schedulingMethod || "No especificado",
    payrollIncidents: dossierState.payrollIncidents || false,
    priority: dossierState.priority || "Sin prioridad definida",
  };

  const sector = dossier.industry;
  const employees = dossier.employees;
  const schedulingMethod = dossier.schedulingMethod;
  const payrollIncidents = dossier.payrollIncidents;
  const priority = dossier.priority;

  // 2. Calcular Score y Diagnósticos
  let score = 100;
  if (schedulingMethod.toLowerCase().includes("excel") || schedulingMethod.toLowerCase().includes("papel")) score -= 30;
  if (payrollIncidents) score -= 25;
  if (priority.toLowerCase().includes("error") || priority.toLowerCase().includes("nómina")) score -= 10;
  score = Math.max(45, score);

  const painPointsIdentified: string[] = [];
  const processGaps: string[] = [];

  if (schedulingMethod.toLowerCase().includes("excel") || schedulingMethod.toLowerCase().includes("papel")) {
    painPointsIdentified.push("Falta de control centralizado y cuadrantes de asistencia físicos");
    processGaps.push("Validación manual de firmas o asistencia en sucursales");
  }
  if (payrollIncidents) {
    painPointsIdentified.push("Discrepancias y quejas en los pagos de nómina por horas extras");
    processGaps.push("Conciliación offline lenta entre el reporte de asistencia y el software de nómina");
  }
  if (priority.includes("Rotacion")) {
    painPointsIdentified.push("Alta rotación y desmotivación operativa por falta de canales digitales");
  }

  // Briefing
  const keyObservations: string[] = [];
  const suggestedNextSteps: string[] = [];

  keyObservations.push(`Prospecto en giro "${sector}" con aprox. ${employees > 0 ? employees : 'varios'} colaboradores.`);
  if (schedulingMethod.toLowerCase().includes("excel")) {
    keyObservations.push("Planificación de personal altamente manual (papel o hojas de cálculo).");
    suggestedNextSteps.push("Demostración enfocada en Operations Suite para control de asistencia móvil y turnos.");
  }
  if (payrollIncidents) {
    keyObservations.push("Frecuentes quejas sobre cálculo de horas extras y compensaciones.");
    suggestedNextSteps.push("Ofrecer piloto de People Suite + Compensation Suite para automatización de incidencias.");
  } else {
    suggestedNextSteps.push("Presentar propuesta de valor corporativa HCM general.");
  }

  const executiveBriefingDraft: ExecutiveBriefingDraft = {
    summary: `El prospecto ${companyName} representado por ${contactName} completó la consultoría inteligente de Aura. Se detectó una madurez tecnológica clasificada en ${score}/100 debido al uso de ${schedulingMethod}.`,
    keyObservations,
    suggestedNextSteps,
  };

  const businessAssessmentDraft: BusinessAssessmentDraft = {
    score,
    painPointsIdentified,
    processGaps,
  };

  // Radiografía
  let overallStatus = "Estable - Con oportunidad de automatización preventiva";
  if (score < 65) {
    overallStatus = "Urgente - Fugas de costos activas debido a procesos 100% manuales";
  } else if (score < 80) {
    overallStatus = "Crítico - Requiere integración y automatización para mitigar fricciones";
  }

  const recommendedModules: string[] = ["People Suite"];
  if (schedulingMethod.toLowerCase().includes("excel") || schedulingMethod.toLowerCase().includes("papel")) recommendedModules.push("Operations Suite");
  if (payrollIncidents) recommendedModules.push("Compensation Suite");

  const potentialSavings = schedulingMethod.toLowerCase().includes("excel")
    ? "Ahorro proyectado del 10% al 15% del costo de horas extras no justificadas mediante validación biométrica facial Aura."
    : "Ahorro del 5% del tiempo administrativo de pre-nómina semanal.";

  const radiografiaEmpresarialDraft: RadiografiaEmpresarialDraft = {
    overallStatus,
    recommendedModules,
    potentialSavings,
  };

  // Contexto del Asesor
  let recommendedOpeningLine = `Hola ${contactName}, un gusto saludarte. Analicé el expediente que generaste con Aura para ${companyName}. Vi que te interesa optimizar la gestión de tus colaboradores...`;
  const alertFlags: string[] = [];
  if (schedulingMethod.toLowerCase().includes("excel")) alertFlags.push("PROCESO_MANUAL");
  if (payrollIncidents) alertFlags.push("RIESGO_CONCILIACION_NOMINA");

  const salesAdvisorContext: SalesAdvisorContext = {
    recommendedOpeningLine,
    alertFlags,
    qualificationStatus: score < 70 ? "HIGH_POTENTIAL" : "QUALIFIED_PROSPECT",
  };

  return {
    linkId,
    companyName,
    contactName,
    answers: {}, // Legacy
    conversationHistory,
    conversationStateSnapshot,
    dossier,
    executiveBriefingDraft,
    businessAssessmentDraft,
    radiografiaEmpresarialDraft,
    salesAdvisorContext,
    createdAt: new Date().toISOString(),
  };
}

import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export interface SaveDiscoverySessionResult {
  sessionId: string;
  prospectId: string;
}

export async function saveDiscoverySession(
  linkId: string,
  companyName: string,
  contactName: string,
  dossierState: Partial<SmartBusinessDossier>,
  conversationHistory: ConversationMessage[],
  conversationStateSnapshot: any,
  sessionToken?: string
): Promise<SaveDiscoverySessionResult> {
  const payload = buildDossierPayload(linkId, companyName, contactName, dossierState, conversationHistory, conversationStateSnapshot);

  const completeFn = httpsCallable<any, { dossierId: string; prospectId: string }>(functions, "completeDiscoverySession");
  const result = await completeFn({
    linkId,
    sessionToken,
    dossierPayload: payload
  });

  const { dossierId, prospectId } = result.data;
  return { sessionId: dossierId, prospectId };
}

const DossierBuilderService = {
  buildDossierPayload,
  saveDiscoverySession,
};

export default DossierBuilderService;
