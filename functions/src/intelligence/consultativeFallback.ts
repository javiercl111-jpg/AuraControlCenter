import {
  calculateQuestionSimilarity,
  MAX_HYPOTHESIS_SIMILARITY,
} from "./conversationSimilarity";
import type {
  ExecutiveConversationContext,
} from "./executiveConversationContext";

const GENERIC_CONSULTATIVE_QUESTIONS = [
  "¿Qué le gustaría que cambiara dentro de seis meses?",
  "¿Cuál proceso consume hoy más tiempo?",
  "¿Qué parte de la operación considera más difícil de controlar?",
  "¿Qué resultado tendría mayor valor para la organización en este momento?",
  "¿Qué decisión necesita poder tomar con mayor claridad?",
] as const;

export function selectConsultativeFallback(
  context: ExecutiveConversationContext,
  canonicalHypothesisQuestion: string,
  existingQuestions: readonly string[] = [],
): string {
  const candidates = [
    ...industryQuestions(context.industry),
    ...gapQuestions(context.criticalMissingInformation),
    ...GENERIC_CONSULTATIVE_QUESTIONS,
  ];

  return candidates.find((candidate) =>
    calculateQuestionSimilarity(
      candidate,
      canonicalHypothesisQuestion,
    ) <= MAX_HYPOTHESIS_SIMILARITY &&
    existingQuestions.every((existingQuestion) =>
      calculateQuestionSimilarity(candidate, existingQuestion) <=
        MAX_HYPOTHESIS_SIMILARITY
    )
  ) ?? "¿Qué información falta para decidir con claridad cuál debe ser el siguiente cambio?";
}

function industryQuestions(industry: string): string[] {
  const normalizedIndustry = normalize(industry);

  if (/hotel|hospeda|hospitalidad|turis/.test(normalizedIndustry)) {
    return [
      "¿Qué resultado debería notar primero el huésped o su equipo al modernizar la operación del hotel?",
      "¿Qué momento de la experiencia del huésped desea transformar primero?",
    ];
  }

  if (/manufactur|fabrica|industrial|produccion/.test(normalizedIndustry)) {
    return [
      "¿En qué etapa de la producción necesita primero mayor visibilidad para tomar decisiones?",
      "¿Qué resultado operativo tendría mayor valor en la planta dentro de seis meses?",
    ];
  }

  if (/retail|tienda|comerc|minoris/.test(normalizedIndustry)) {
    return [
      "¿Qué resultado busca priorizar entre la experiencia de compra, el inventario y la operación de tienda?",
      "¿En qué momento de la operación de tienda necesita tomar decisiones con mayor claridad?",
    ];
  }

  if (/servic|consultor|despacho|agencia/.test(normalizedIndustry)) {
    return [
      "¿Qué parte de la entrega del servicio quiere hacer más consistente primero?",
      "¿Qué cambio debería percibir primero el cliente en la experiencia de servicio?",
    ];
  }

  return [];
}

function gapQuestions(criticalMissingInformation: readonly string[]): string[] {
  const gaps = normalize(criticalMissingInformation.join(" "));
  const questions: string[] = [];

  if (/tiempo|carga|consume|capacidad/.test(gaps)) {
    questions.push("¿Cuál proceso consume hoy más tiempo?");
  }
  if (/resultado|seis meses|cambio/.test(gaps)) {
    questions.push("¿Qué le gustaría que cambiara dentro de seis meses?");
  }
  if (/control|visibilidad|decision/.test(gaps)) {
    questions.push(
      "¿Qué parte de la operación considera más difícil de controlar?",
    );
  }

  return questions;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
