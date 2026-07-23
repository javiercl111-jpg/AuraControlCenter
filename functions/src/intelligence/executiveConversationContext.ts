export interface ExecutiveConversationHistoryItem {
  id?: string;
  role: string;
  content: string;
  timestamp?: unknown;
}

export interface ExecutiveConversationContextSource {
  companyName: string;
  industry: string;
  currentResponse: string;
  conversationHistory: readonly ExecutiveConversationHistoryItem[];
  partialDossier?: Readonly<Record<string, unknown>>;
  confirmedFacts?: readonly string[];
  pendingHypotheses?: readonly string[];
  criticalMissingInformation?: readonly string[];
  discoveryObjective?: string;
  confidenceLevel?: number;
}

export interface ExecutiveConversationContext {
  summary: string;
  latestResponses: string[];
  confirmedFacts: string[];
  pendingHypotheses: string[];
  criticalMissingInformation: string[];
  discoveryObjective: string;
  industry: string;
  confidenceLevel: number;
}

const DEFAULT_DISCOVERY_OBJECTIVE =
  "Comprender la prioridad operativa, el cambio esperado y la evidencia necesaria para orientar el diagnóstico ejecutivo.";

const DOSSIER_LABELS: Readonly<Record<string, string>> = {
  employees: "Número de colaboradores",
  industry: "Industria registrada",
  payrollIncidents: "Incidencias de nómina confirmadas",
  priority: "Prioridad declarada",
  schedulingMethod: "Método de programación",
};

export function buildExecutiveConversationContext(
  source: ExecutiveConversationContextSource,
): ExecutiveConversationContext {
  const companyName = clip(cleanText(source.companyName), 100) ||
    "la organización";
  const industry = clip(cleanText(source.industry), 100) || "No confirmada";
  const latestResponses = collectLatestResponses(source);
  const responseKeys = new Set(latestResponses.map(normalizeForDeduplication));
  const confirmedFacts = uniqueCompact([
    ...(source.confirmedFacts ?? []),
    ...factsFromDossier(source.partialDossier),
  ], 6, 180).filter((fact) =>
    !responseKeys.has(normalizeForDeduplication(fact))
  );
  const pendingHypotheses = uniqueCompact(
    source.pendingHypotheses ?? [],
    5,
    180,
  );
  const criticalMissingInformation = uniqueCompact(
    source.criticalMissingInformation ?? [],
    4,
    160,
  );
  const resolvedMissingInformation = criticalMissingInformation.length > 0
    ? criticalMissingInformation
    : defaultMissingInformation(industry);
  const confidenceLevel = normalizeConfidence(source.confidenceLevel);
  const summary = clip(
    `Discovery ejecutivo de ${companyName} en curso: ` +
      `${confirmedFacts.length} hechos confirmados y ` +
      `${pendingHypotheses.length} hipótesis pendientes.`,
    180,
  );

  return {
    summary,
    latestResponses,
    confirmedFacts,
    pendingHypotheses,
    criticalMissingInformation: resolvedMissingInformation,
    discoveryObjective: clip(
      cleanText(source.discoveryObjective) || DEFAULT_DISCOVERY_OBJECTIVE,
      220,
    ),
    industry,
    confidenceLevel,
  };
}

function collectLatestResponses(
  source: ExecutiveConversationContextSource,
): string[] {
  const candidates = [
    ...source.conversationHistory
      .filter((item) => item.role === "user")
      .map((item) => item.content),
    source.currentResponse,
  ];
  const selected: string[] = [];
  const seen = new Set<string>();

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const text = clip(cleanText(candidates[index]), 260);
    const key = normalizeForDeduplication(text);
    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    selected.push(text);
    if (selected.length === 3) {
      break;
    }
  }

  return selected.reverse();
}

function factsFromDossier(
  partialDossier?: Readonly<Record<string, unknown>>,
): string[] {
  if (!partialDossier) {
    return [];
  }

  return Object.entries(partialDossier)
    .filter(([, value]) =>
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
    .map(([key, value]) => {
      const label = DOSSIER_LABELS[key] ?? humanizeKey(key);
      return `${label}: ${formatPrimitive(value as string | number | boolean)}`;
    });
}

function defaultMissingInformation(industry: string): string[] {
  const normalizedIndustry = normalizeForDeduplication(industry);
  const industryGap = /hotel|hospeda|hospitalidad/.test(normalizedIndustry)
    ? "Área de la operación hotelera que se desea modernizar primero"
    : /manufactur|fabrica|industrial|produccion/.test(normalizedIndustry)
      ? "Etapa de producción que requiere mayor visibilidad"
      : /retail|tienda|comerc|minoris/.test(normalizedIndustry)
        ? "Prioridad entre experiencia de compra, inventario y tienda"
        : /servic|consultor|despacho|agencia/.test(normalizedIndustry)
          ? "Parte de la entrega del servicio que se desea fortalecer"
          : "Proceso que debe atenderse primero";

  return [
    industryGap,
    "Resultado observable esperado dentro de seis meses",
    "Criterio ejecutivo para priorizar el cambio",
  ];
}

function uniqueCompact(
  values: readonly string[],
  maximumItems: number,
  maximumLength: number,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = clip(cleanText(values[index]), maximumLength);
    const key = normalizeForDeduplication(value);
    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
    if (result.length === maximumItems) {
      break;
    }
  }

  return result.reverse();
}

function normalizeConfidence(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value ?? 0)));
}

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function clip(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) {
    return value;
  }

  return `${value.slice(0, maximumLength - 1).trimEnd()}…`;
}

function normalizeForDeduplication(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function humanizeKey(value: string): string {
  const humanized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  return humanized
    ? `${humanized.charAt(0).toUpperCase()}${humanized.slice(1)}`
    : "Hecho";
}

function formatPrimitive(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "sí" : "no";
  }

  return String(value);
}
