import { Type, type Schema } from "@google/genai";

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
  const normalizedAuthority = normalizeForValidation(authoritativeQuestion);
  const authorityTerms = normalizedAuthority
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 5 && !INTENT_STOP_WORDS.has(term));
  const sharesAuthorityTerm = authorityTerms.some((term) =>
    normalizedQuestion.includes(term),
  );
  const hasBusinessDiscoverySignal = /\b(proceso|procesos|operacion|operaciones|equipo|prioridad|sistema|sistemas|administracion|cliente|clientes|venta|ventas|tiempo|dificultad|dificultades|problema|problemas|impacto|incidencia|incidencias|empresa|organizacion|inventario|nomina|crecimiento)\b/.test(
    normalizedQuestion,
  );

  if (authoritativeIntent === "DISCOVER_PROBLEM") {
    return sharesAuthorityTerm || hasBusinessDiscoverySignal;
  }

  const hasConfirmationSignal = /\b(han|tienen|ocurre|sucede|existe|consideran|experimentado|confirman|siguen|usan|cuentan)\b/.test(
    normalizedQuestion,
  );
  return hasConfirmationSignal && (sharesAuthorityTerm || hasBusinessDiscoverySignal);
}

const INTENT_STOP_WORDS = new Set([
  "actual",
  "actualmente",
  "consideran",
  "cual",
  "cuando",
  "empresa",
  "estos",
  "principal",
  "puedes",
  "quiero",
  "tienen",
]);

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
