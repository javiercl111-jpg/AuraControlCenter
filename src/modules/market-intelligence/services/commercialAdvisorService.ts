import type { InegiCompany } from "../types/inegi";

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
  companies: InegiCompany[]
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
  let totalScore = 0;
  let contactCompleteCount = 0;

  // Contadores por estado
  const stateGroups: Record<
    string,
    {
      totalCount: number;
      totalScore: number;
      criticalCount: number;
      highCount: number;
      suiteCounts: Record<string, number>;
    }
  > = {};

  // Contadores de suites
  const globalSuiteCounts: Record<string, number> = {};

  for (const company of companies) {
    const score = company.opportunityScore;
    totalScore += score;

    // Calcular prioridad
    const priority =
      company.priorityLevel ||
      (score >= 85 ? "CRITICAL" : score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW");

    if (priority === "CRITICAL") criticalCount++;
    else if (priority === "HIGH") highCount++;
    else if (priority === "MEDIUM") mediumCount++;
    else lowCount++;

    // Contacto completo (Email Y Teléfono disponibles)
    const hasEmail = company.email && company.email !== "no disponible";
    const hasPhone = company.telefono && company.telefono !== "no disponible";
    if (hasEmail && hasPhone) {
      contactCompleteCount++;
    }

    // Suites recomendadas
    if (company.recommendedSuites) {
      for (const suite of company.recommendedSuites) {
        globalSuiteCounts[suite] = (globalSuiteCounts[suite] || 0) + 1;
      }
    }

    // Agrupación por estado
    const state = company.estado || "No Especificado";
    if (!stateGroups[state]) {
      stateGroups[state] = {
        totalCount: 0,
        totalScore: 0,
        criticalCount: 0,
        highCount: 0,
        suiteCounts: {},
      };
    }
    const stGroup = stateGroups[state];
    stGroup.totalCount++;
    stGroup.totalScore += score;
    if (priority === "CRITICAL") stGroup.criticalCount++;
    if (priority === "HIGH") stGroup.highCount++;

    if (company.recommendedSuites) {
      for (const suite of company.recommendedSuites) {
        stGroup.suiteCounts[suite] = (stGroup.suiteCounts[suite] || 0) + 1;
      }
    }
  }

  // 3. Estimar MRR Potencial
  let estimatedPotentialMrr = 0;
  for (const company of companies) {
    const score = company.opportunityScore;
    const priority =
      company.priorityLevel ||
      (score >= 85 ? "CRITICAL" : score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW");
    estimatedPotentialMrr += POTENTIAL_MRR_LITE[priority];
  }

  // 4. Generar reportes por estado
  const opportunityByState = Object.entries(stateGroups).map(([state, data]) => {
    // Dominantes (top 2 suites más repetidas en el estado)
    const sortedSuites = Object.entries(data.suiteCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);

    return {
      state,
      totalCount: data.totalCount,
      avgScore: Math.round(data.totalScore / data.totalCount),
      criticalCount: data.criticalCount,
      highCount: data.highCount,
      dominantSuites: sortedSuites.length > 0 ? sortedSuites : ["Sales Suite"],
    };
  });

  // Ordenar estados por volumen y criticidad
  opportunityByState.sort((a, b) => b.totalCount - a.totalCount);

  // 5. Executive Summary & recommended Focus
  const avgScoreGlobal = Math.round(totalScore / companies.length);
  const bestStates = opportunityByState.slice(0, 2).map((s) => s.state).join(" y ");
  
  const executiveSummary = `Analicé un conjunto de ${companies.length} prospectos en base local. El nivel medio de afinidad tecnológica es del ${avgScoreGlobal}%. Identifiqué ${criticalCount} prospectos críticos y ${highCount} de alta prioridad que requieren atención inmediata.`;

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
