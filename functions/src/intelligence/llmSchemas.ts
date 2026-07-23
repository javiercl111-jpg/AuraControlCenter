import { Type, type Schema } from "@google/genai";
import { isQuestionTooSimilar } from "./conversationSimilarity";

export const MAX_CONVERSATION_QUESTION_LENGTH = 360;

export interface LLMConversationDraft {
  safetyPassed: boolean;
  conversationProposal: {
    nextQuestion: string;
  };
}

export const outputSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    safetyPassed: {
      type: Type.BOOLEAN,
      description: "True only when the prospect input and drafted question are safe.",
    },
    conversationProposal: {
      type: Type.OBJECT,
      properties: {
        nextQuestion: {
          type: Type.STRING,
          description: "One concise Spanish business-discovery question.",
        },
      },
      required: ["nextQuestion"],
    },
  },
  required: ["safetyPassed", "conversationProposal"],
};

export function validateLLMOutput(data: unknown): data is LLMConversationDraft {
  const root = asRecord(data);
  if (!root || !hasOnlyKeys(root, ["safetyPassed", "conversationProposal"])) {
    return false;
  }

  if (typeof root.safetyPassed !== "boolean") {
    return false;
  }

  const proposal = asRecord(root.conversationProposal);
  if (!proposal || !hasOnlyKeys(proposal, ["nextQuestion"])) {
    return false;
  }

  if (typeof proposal.nextQuestion !== "string") {
    return false;
  }

  const question = proposal.nextQuestion.trim();
  return (
    question.length >= 8 &&
    question.length <= MAX_CONVERSATION_QUESTION_LENGTH
  );
}

export function containsUnsafeConversationInstruction(text: string): boolean {
  const normalized = normalizeForValidation(text);
  return [
    /\bignora\b.*\binstruccion/,
    /\b(?:system prompt|prompt del sistema|revela el prompt|imprime el prompt)\b/,
    /\b(?:revela|comparte|muestra|imprime|dime)\b.*\b(?:api key|clave de api|contrasena|password|token|secreto)\b/,
    /(?:<script|javascript:|powershell|cmd\.exe)/,
    /\b(?:desactiva|omite|evade|salta)\b.*\b(?:seguridad|validacion|proteccion)\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function isSafeConversationDraft(question: string): boolean {
  const normalized = normalizeForValidation(question);
  const containsControlToken = /\b(?:stop|closing)\b/.test(normalized);
  const containsClosingInstruction = /\b(?:finalicemos|terminemos)\b/.test(normalized) ||
    /\b(?:he|hemos)\s+(?:recopilado|terminado|concluido)\b/.test(normalized) ||
    normalized.includes("muchas gracias por tu tiempo");

  return (
    !containsControlToken &&
    !containsClosingInstruction &&
    !containsUnsafeConversationInstruction(question)
  );
}

export function isIntentCompatible(
  nextQuestion: string,
  authoritativeIntent: string,
  authoritativeQuestion: string,
): boolean {
  if (
    !["DISCOVER_PROBLEM", "CONFIRM_HYPOTHESIS"].includes(authoritativeIntent) ||
    !nextQuestion.includes("?")
  ) {
    return false;
  }

  const normalizedQuestion = normalizeForValidation(nextQuestion);
  const isOpenQuestion =
    /^(?:¿\s*)?(?:que|cual|cuales|como|cuando|donde|en que|de que|por que)\b/.test(
      normalizedQuestion.trim(),
    );
  const hasBusinessDiscoverySignal = /\b(proceso|procesos|operacion|operaciones|equipo|prioridad|administracion|cliente|clientes|venta|ventas|tiempo|dificultad|dificultades|resultado|resultados|impacto|empresa|organizacion|inventario|nomina|crecimiento|cambio|cambios|decision|decisiones|situacion|hotel|huesped|produccion|planta|tienda|servicio|experiencia|modernizar|transformar|capacidad|control|visibilidad)\b/.test(
    normalizedQuestion,
  );

  return (
    isOpenQuestion &&
    hasBusinessDiscoverySignal &&
    !isQuestionTooSimilar(nextQuestion, authoritativeQuestion)
  );
}

function normalizeForValidation(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === allowedKeys.length &&
    keys.every((key) => allowedKeys.includes(key))
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}
