import type { InegiCompany } from "../types/inegi";
import { getCompanyState } from "./marketQueryEngine";

// Constantes de MRR potencial configurables (en pesos MXN)
export const POTENTIAL_MRR_LITE = {
  LOW: 1500,
  MEDIUM: 3500,
  HIGH: 7500,
  CRITICAL: 12500,
};

export interface CommercialAdvisorReport {
  executiveSummary: string;
  recommendedFocus: string;
  topRecommendedSuites: string[];
  suggestedNextActions: string[];
  riskWarnings: string[];
  opportunityByState: {
    state: string;
    totalCount: number;
    avgScore: number;
    criticalCount: number;
    highCount: number;
    dominantSuites: string[];
  }[];
  estimatedPotentialMrr: number;
}

/**
 * Servicio de Recomendaciones de Aura Intelligence (Lite - Basado en reglas).
 * Analiza un conjunto de prospectos para guiar la prospección comercial del asesor.
 */
export function generateAdvisorReport(
  companies: InegiCompany[],
  activeStateName?: string | null
): CommercialAdvisorReport {
  // 1. Valores fallback si no hay datos
  if (companies.length === 0) {
    return {
      executiveSummary: "Sin prospectos cargados. Importa datos del DENUE o carga la muestra piloto para iniciar el análisis.",
      recommendedFocus: "Foco recomendado en Estados piloto: Querétaro y Nuevo León.",
      topRecommendedSuites: ["People Suite", "Sales Suite"],
      suggestedNextActions: [
        "Cargar archivo Excel del DENUE de Querétaro o Nuevo León.",
        "Utilizar los filtros rápidos para identificar empresas medianas o grandes.",
      ],
      riskWarnings: ["No hay registros en la base local para procesar."],
      opportunityByState: [],
      estimatedPotentialMrr: 0,
    };
  }

  // 2. Clasificación de prospectos
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let contactCompleteCount = 0;

  let totalScore = 0;
  const globalSuiteCounts: Record<string, number> = {};

  const stateGroups: Record<string, {
    totalScore: number;
    totalCount: number;
    criticalCount: number;
    highCount: number;
    suites: Record<string, number>;
  }> = {};

  companies.forEach((company) => {
    const score = company.opportunityScore || 50;
    totalScore += score;

    // Prioridad
    if (company.priorityLevel === "CRITICAL" || score >= 85) {
      criticalCount++;
    } else if (company.priorityLevel === "HIGH" || score >= 70) {
      highCount++;
    } else if (company.priorityLevel === "MEDIUM" || score >= 50) {
      mediumCount++;
    } else {
      lowCount++;
    }

    // Datos de contacto completos
    const hasEmail = company.email && company.email !== "no disponible";
    const hasPhone = company.telefono && company.telefono !== "no disponible";
    if (hasEmail && hasPhone) {
      contactCompleteCount++;
    }

    // Suites sugeridas
    const companySuites = company.recommendedSuites || ["People Suite"];
    companySuites.forEach((suite) => {
      globalSuiteCounts[suite] = (globalSuiteCounts[suite] || 0) + 1;
    });

    // Agrupación por estado
    const state = getCompanyState(company);
    if (!stateGroups[state]) {
      stateGroups[state] = {
        totalScore: 0,
        totalCount: 0,
        criticalCount: 0,
        highCount: 0,
        suites: {},
      };
    }
    const group = stateGroups[state];
    group.totalCount++;
    group.totalScore += score;
    if (company.priorityLevel === "CRITICAL" || score >= 85) {
      group.criticalCount++;
    } else if (company.priorityLevel === "HIGH" || score >= 70) {
      group.highCount++;
    }
    companySuites.forEach((suite) => {
      group.suites[suite] = (group.suites[suite] || 0) + 1;
    });
  });

  // 3. Estimar MRR Potencial
  let estimatedPotentialMrr = 0;
  for (const company of companies) {
    const score = company.opportunityScore || 50;
    const priority = (company.priorityLevel || (score >= 85 ? "CRITICAL" : score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW")) as keyof typeof POTENTIAL_MRR_LITE;
    estimatedPotentialMrr += POTENTIAL_MRR_LITE[priority];
  }

  // 4. Mapear grupos por estado
  const opportunityByState = Object.entries(stateGroups).map(([state, data]) => {
    const sortedSuites = Object.entries(data.suites)
      .sort((a, b) => b[1] - a[1])
      .map(([suite]) => suite);

    return {
      state,
      totalCount: data.totalCount,
      avgScore: Math.round(data.totalScore / data.totalCount),
      criticalCount: data.criticalCount,
      highCount: data.highCount,
      dominantSuites: sortedSuites.length > 0 ? sortedSuites.slice(0, 2) : ["Sales Suite"],
    };
  });

  // Ordenar estados por volumen
  opportunityByState.sort((a, b) => b.totalCount - a.totalCount);

  // 5. Executive Summary & recommended Focus
  const avgScoreGlobal = Math.round(totalScore / companies.length);
  const bestStates = opportunityByState.slice(0, 2).map((s) => s.state).join(" y ");
  
  const executiveSummary = activeStateName
    ? `Analicé una muestra de ${companies.length} prospectos de ${activeStateName}. El nivel medio de afinidad tecnológica es del ${avgScoreGlobal}%. Identifiqué ${criticalCount} prospectos críticos y ${highCount} de alta prioridad que requieren atención inmediata.`
    : `Analicé un conjunto de ${companies.length} prospectos en base local. El nivel medio de afinidad tecnológica es del ${avgScoreGlobal}%. Identifiqué ${criticalCount} prospectos críticos y ${highCount} de alta prioridad que requieren atención inmediata.`;

  let recommendedFocus = `Recomiendo enfocar los esfuerzos en la región de ${bestStates || "estados activos"}. `;
  if (criticalCount > 0) {
    recommendedFocus += `Priorizar las llamadas a las ${criticalCount} organizaciones con nivel CRITICAL.`;
  } else {
    recommendedFocus += `Comenzar prospectando a las empresas de alta prioridad con perfiles corporativos medianos/grandes.`;
  }

  // 6. Top recommended suites
  const topRecommendedSuites = Object.entries(globalSuiteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([suite]) => suite);

  // 7. Acciones sugeridas
  const suggestedNextActions = [
    `Iniciar prospección directa con los ${criticalCount + highCount} prospectos clasificados con prioridad alta/crítica.`,
  ];
  if (contactCompleteCount > 0) {
    suggestedNextActions.push(
      `Exportar o contactar a los ${contactCompleteCount} prospectos con datos de contacto completos (teléfono + email).`
    );
  }
  suggestedNextActions.push(
    "Agendar llamadas exploratorias de 15 minutos enfocadas en el ecosistema " +
      (topRecommendedSuites[0] || "People Suite") +
      "."
  );

  // 8. Advertencias de riesgo
  const riskWarnings: string[] = [];
  const lowScoreCount = lowCount;
  if (lowScoreCount > companies.length * 0.4) {
    riskWarnings.push(
      `Más del 40% de los registros tienen baja afinidad (Score < 45). Se sugiere filtrar por empresas de más de 50 empleados.`
    );
  }
  const missingContactCount = companies.length - contactCompleteCount;
  if (missingContactCount > companies.length * 0.5) {
    riskWarnings.push(
      `Más del 50% de las empresas carecen de canal de contacto completo. Validar sitios web para enriquecer datos.`
    );
  }

  return {
    executiveSummary,
    recommendedFocus,
    topRecommendedSuites: topRecommendedSuites.length > 0 ? topRecommendedSuites : ["People Suite", "Sales Suite"],
    suggestedNextActions,
    riskWarnings: riskWarnings.length > 0 ? riskWarnings : ["No se detectaron riesgos de datos significativos."],
    opportunityByState,
    estimatedPotentialMrr,
  };
}

const CommercialAdvisorService = {
  POTENTIAL_MRR_LITE,
  generateAdvisorReport,
};

export default CommercialAdvisorService;
