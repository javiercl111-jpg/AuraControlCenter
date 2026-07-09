import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { DiscoverySession, SmartBusinessDossier, ExecutiveBriefingDraft, BusinessAssessmentDraft, RadiografiaEmpresarialDraft, SalesAdvisorContext } from "../types/discoveryTypes";

/**
 * Mapea las respuestas conversacionales y construye el SmartBusinessDossier y borradores de diagnóstico.
 */
export function buildDossierPayload(
  linkId: string,
  companyName: string,
  contactName: string,
  answers: Record<string, string>
): Omit<DiscoverySession, "id"> {
  const sector = answers["sector"] || "Otros";
  const empMethod = answers["employees_method"] || "Pyme_Manual";
  const payrollIssues = answers["payroll_issues"] || "No_Perfecto";
  const priority = answers["priority"] || "Control_Asistencia";

  // 1. Deducir empleados y método
  let employees = 30;
  if (empMethod.includes("Micro")) employees = 5;
  else if (empMethod.includes("Pyme")) employees = 35;
  else if (empMethod.includes("Mediana")) employees = 150;
  else if (empMethod.includes("Grande")) employees = 650;

  let schedulingMethod = "Excel y papel";
  if (empMethod.includes("Local")) schedulingMethod = "Software local o ERP";
  else if (empMethod.includes("Cloud")) schedulingMethod = "Sistema en la nube";

  const payrollIncidents = payrollIssues === "Si_Frecuente" || payrollIssues === "Ocasional_Lento";

  const dossier: SmartBusinessDossier = {
    industry: sector,
    employees,
    schedulingMethod,
    payrollIncidents,
    priority,
  };

  // 2. Calcular Score y Diagnósticos
  let score = 100;
  if (schedulingMethod === "Excel y papel") score -= 30;
  if (payrollIncidents) score -= 25;
  if (priority === "Errores_Pago") score -= 10;
  score = Math.max(45, score);

  const painPointsIdentified: string[] = [];
  const processGaps: string[] = [];

  if (schedulingMethod === "Excel y papel") {
    painPointsIdentified.push("Falta de control centralizado y cuadrantes de asistencia físicos");
    processGaps.push("Validación manual de firmas o asistencia en sucursales");
  }
  if (payrollIncidents) {
    painPointsIdentified.push("Discrepancias y quejas en los pagos de nómina por horas extras");
    processGaps.push("Conciliación offline lenta entre el reporte de asistencia y el software de nómina");
  }
  if (priority === "Rotacion_Clima") {
    painPointsIdentified.push("Alta rotación y desmotivación operativa por falta de canales digitales");
  }

  // Briefing
  const keyObservations: string[] = [];
  const suggestedNextSteps: string[] = [];

  keyObservations.push(`Prospecto en giro "${sector}" con ${employees} colaboradores.`);
  if (schedulingMethod === "Excel y papel") {
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
  if (schedulingMethod === "Excel y papel") recommendedModules.push("Operations Suite");
  if (payrollIncidents) recommendedModules.push("Compensation Suite");

  const potentialSavings = schedulingMethod === "Excel y papel"
    ? "Ahorro proyectado del 10% al 15% del costo de horas extras no justificadas mediante validación biométrica facial Aura."
    : "Ahorro del 5% del tiempo administrativo de pre-nómina semanal.";

  const radiografiaEmpresarialDraft: RadiografiaEmpresarialDraft = {
    overallStatus,
    recommendedModules,
    potentialSavings,
  };

  // Contexto del Asesor
  let recommendedOpeningLine = `Hola ${contactName}, un gusto saludarte. Analicé el expediente que generaste en el Discovery Portal de Aura para ${companyName}. Vi que te interesa optimizar la gestión de tus ${employees} colaboradores...`;
  const alertFlags: string[] = [];
  if (schedulingMethod === "Excel y papel") alertFlags.push("PROCESO_MANUAL");
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
    answers,
    dossier,
    executiveBriefingDraft,
    businessAssessmentDraft,
    radiografiaEmpresarialDraft,
    salesAdvisorContext,
    createdAt: serverTimestamp(),
  };
}

/**
 * Guarda el expediente completo en Firestore y marca el enlace único como completado.
 */
export async function saveDiscoverySession(
  linkId: string,
  companyName: string,
  contactName: string,
  answers: Record<string, string>
): Promise<string> {
  const dossierId = `dossier_${linkId}_${Date.now()}`;
  const payload = buildDossierPayload(linkId, companyName, contactName, answers);

  // 1. Guardar la sesión de consultoría
  const sessionRef = doc(db, "discovery_sessions", dossierId);
  await setDoc(sessionRef, {
    id: dossierId,
    ...payload,
    completedAt: serverTimestamp(),
  });

  // 2. Si no es una sesión demo, marcar el enlace de prospección como completado
  if (linkId && linkId !== "demo") {
    try {
      const linkRef = doc(db, "market_discovery_links", linkId);
      await updateDoc(linkRef, {
        status: "completed",
        dossierId: dossierId,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("No se pudo actualizar el enlace de prospección a completado (podría ser demo):", err);
    }
  }

  return dossierId;
}

const DossierBuilderService = {
  buildDossierPayload,
  saveDiscoverySession,
};

export default DossierBuilderService;
