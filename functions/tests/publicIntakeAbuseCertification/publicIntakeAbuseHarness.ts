export type FakeAppCheckState = "MISSING" | "INVALID" | "VALID";

export interface FakePublicIntakeRequest {
  readonly appCheckState: FakeAppCheckState;
  readonly appId?: string;
  readonly attestationId?: string;
}

export interface PublicIntakeAbuseLedger {
  appCheck: number;
  containment: number;
  quota: number;
  stateWrites: number;
  gemini: number;
  pdf: number;
  signedUrl: number;
  notifications: number;
}

export type FakePublicIntakeResult =
  | Readonly<{ decision: "ALLOW" }>
  | Readonly<{
      decision: "DENY";
      reason:
        | "APP_CHECK_REQUIRED"
        | "APP_CHECK_INVALID"
        | "APP_CHECK_REPLAYED"
        | "APP_ID_BLOCKED"
        | "QUOTA_EXCEEDED";
    }>;

const FAKE_ALLOWED_APP_ID = "demo-app-public-intake";
const FAKE_BLOCKED_APP_ID = "demo-app-blocked";

export class PublicIntakeAbuseHarness {
  readonly ledger: PublicIntakeAbuseLedger = {
    appCheck: 0,
    containment: 0,
    quota: 0,
    stateWrites: 0,
    gemini: 0,
    pdf: 0,
    signedUrl: 0,
    notifications: 0,
  };

  readonly #usedAttestations = new Set<string>();
  #remainingQuota: number;

  constructor(quota = 1) {
    this.#remainingQuota = quota;
  }

  execute(request: FakePublicIntakeRequest): FakePublicIntakeResult {
    this.ledger.appCheck += 1;
    if (request.appCheckState === "MISSING") {
      return { decision: "DENY", reason: "APP_CHECK_REQUIRED" };
    }
    if (
      request.appCheckState === "INVALID" ||
      request.appId === undefined ||
      request.attestationId === undefined
    ) {
      return { decision: "DENY", reason: "APP_CHECK_INVALID" };
    }
    if (this.#usedAttestations.has(request.attestationId)) {
      return { decision: "DENY", reason: "APP_CHECK_REPLAYED" };
    }
    this.#usedAttestations.add(request.attestationId);

    this.ledger.containment += 1;
    if (request.appId === FAKE_BLOCKED_APP_ID) {
      return { decision: "DENY", reason: "APP_ID_BLOCKED" };
    }
    if (request.appId !== FAKE_ALLOWED_APP_ID) {
      return { decision: "DENY", reason: "APP_CHECK_INVALID" };
    }

    this.ledger.quota += 1;
    if (this.#remainingQuota <= 0) {
      return { decision: "DENY", reason: "QUOTA_EXCEEDED" };
    }
    this.#remainingQuota -= 1;
    this.ledger.stateWrites += 1;
    return { decision: "ALLOW" };
  }
}

export const PUBLIC_INTAKE_FAKE_APP_IDS = Object.freeze({
  allowed: FAKE_ALLOWED_APP_ID,
  blocked: FAKE_BLOCKED_APP_ID,
});

