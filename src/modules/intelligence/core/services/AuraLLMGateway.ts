import type {
  ConversationDraftRequest,
  ConversationEvaluationResult,
} from "../../engine/types/orchestrator.types";

interface CallableResult {
  data: unknown;
}

export type ConversationEvaluationCallable = (
  request: ConversationDraftRequest,
) => Promise<CallableResult>;

const DEFAULT_TIMEOUT_MS = 12_000;

export class AuraLLMGateway {
  private evaluateFn?: ConversationEvaluationCallable;
  private readonly timeoutMs: number;

  public constructor(
    evaluateFn?: ConversationEvaluationCallable,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.evaluateFn = evaluateFn;
    this.timeoutMs = timeoutMs;
  }

  public async evaluateTurn(
    request: ConversationDraftRequest,
  ): Promise<ConversationEvaluationResult> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const evaluateFn = await this.getEvaluateFn();
      const callPromise = evaluateFn(request);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error("LLM_TIMEOUT")),
          this.timeoutMs,
        );
      });

      const result = await Promise.race([callPromise, timeoutPromise]);
      return result.data as ConversationEvaluationResult;
    } catch (error: unknown) {
      console.warn("AuraLLMGateway failed; ConversationEngine fallback will be used.");

      return {
        ok: false,
        validationPassed: false,
        safetyPassed: false,
        intentCompatible: false,
        fallbackUsed: true,
        safeErrorCode: this.mapSafeErrorCode(error),
      };
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async getEvaluateFn(): Promise<ConversationEvaluationCallable> {
    if (this.evaluateFn) {
      return this.evaluateFn;
    }

    const [{ getFunctions, httpsCallable }, { firebaseApp }] = await Promise.all([
      import("firebase/functions"),
      import("../../../../config/firebase"),
    ]);

    this.evaluateFn = httpsCallable<ConversationDraftRequest, unknown>(
      getFunctions(firebaseApp),
      "evaluateConversation",
    );

    return this.evaluateFn;
  }

  private mapSafeErrorCode(error: unknown): string {
    const errorRecord = this.asRecord(error);
    const message = typeof errorRecord?.message === "string"
      ? errorRecord.message
      : "";
    const code = typeof errorRecord?.code === "string" ? errorRecord.code : "";

    if (
      message === "LLM_TIMEOUT" ||
      code === "functions/deadline-exceeded" ||
      code === "deadline-exceeded"
    ) {
      return "LLM_TIMEOUT";
    }

    if (
      code === "functions/unauthenticated" ||
      code === "functions/failed-precondition" ||
      code === "unauthenticated" ||
      code === "failed-precondition"
    ) {
      return "APP_CHECK_REQUIRED";
    }

    if (code === "functions/resource-exhausted" || code === "resource-exhausted") {
      return "RATE_LIMITED";
    }

    if (
      code === "functions/internal" ||
      code === "functions/unavailable" ||
      code === "internal" ||
      code === "unavailable"
    ) {
      return "LLM_UNAVAILABLE";
    }

    if (code === "functions/invalid-argument" || code === "invalid-argument") {
      return "LLM_REQUEST_INVALID";
    }

    return "NETWORK_OR_SERVER_ERROR";
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null
      ? value as Record<string, unknown>
      : undefined;
  }
}

export default AuraLLMGateway;
