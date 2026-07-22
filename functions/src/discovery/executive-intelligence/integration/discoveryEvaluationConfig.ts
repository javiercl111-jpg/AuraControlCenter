import {
  defineBoolean,
  defineInt,
  defineSecret,
  defineString,
} from "firebase-functions/params";

export const DISCOVERY_SHADOW_EVALUATION_FEATURE =
  "discovery.shadowEvaluation" as const;
export const DISCOVERY_PRIMARY_EVALUATION_FEATURE =
  "discovery.primaryEvaluation" as const;

const shadowEvaluationParam = defineBoolean("DISCOVERY_SHADOW_EVALUATION", {
  default: true,
  description: "Evaluate completed Discovery sessions in shadow mode.",
});

const primaryEvaluationParam = defineBoolean("DISCOVERY_PRIMARY_EVALUATION", {
  default: false,
  description: "Reserved flag. Primary evaluation remains hard-disabled.",
});

export const executiveDiscoveryEndpointParam = defineString(
  "EXECUTIVE_DISCOVERY_ENDPOINT",
  {
    default: "",
    description: "Non-production Aura Intelligence evaluation endpoint.",
  },
);

export const executiveDiscoveryTimeoutMsParam = defineInt(
  "EXECUTIVE_DISCOVERY_TIMEOUT_MS",
  {
    default: 10_000,
    description: "Shadow evaluation timeout in milliseconds.",
  },
);

export const EXECUTIVE_DISCOVERY_SERVICE_TOKEN_SECRET =
  "EXECUTIVE_DISCOVERY_SERVICE_TOKEN" as const;

export const executiveDiscoveryServiceTokenParam = defineSecret(
  EXECUTIVE_DISCOVERY_SERVICE_TOKEN_SECRET,
);

export interface DiscoveryEvaluationFeatureFlags {
  readonly shadowEvaluation: boolean;
  readonly primaryEvaluation: false;
}

/** Primary evaluation is intentionally impossible to activate in this sprint. */
export function resolveDiscoveryEvaluationFeatureFlags(
  configured: {
    readonly shadowEvaluation: boolean;
    readonly primaryEvaluation: boolean;
  } = {
    shadowEvaluation: shadowEvaluationParam.value(),
    primaryEvaluation: primaryEvaluationParam.value(),
  },
): DiscoveryEvaluationFeatureFlags {
  void configured.primaryEvaluation;
  return {
    shadowEvaluation: configured.shadowEvaluation,
    primaryEvaluation: false,
  };
}
