import EphemeralBrowserCapabilityHandoffV1 from "./ephemeralBrowserCapabilityHandoffV1";

export const DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1 =
  "DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_V1" as const;
export const DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_TTL_MS_V1 =
  5 * 60 * 1_000;

const BEARER = /^[a-f0-9]{64}$/u;
const SAFE_LOCATOR = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const INJECTION_KEYS = Object.freeze([
  "bearer",
  "expiresAt",
  "version",
] as const);

export interface DirectEphemeralDiscoveryCapabilityScopeV1 {
  readonly environment: "PREVIEW";
  readonly linkId: string;
  readonly sessionId: string;
  readonly turnId: string;
}

export interface DirectEphemeralDiscoveryDisplayContextV1 {
  readonly companyName: string;
  readonly contactName: string;
}

export interface DirectEphemeralDiscoveryCapabilityInjectionV1 {
  readonly version:
    typeof DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1;
  readonly bearer: string;
  readonly expiresAt: number;
}

export interface DirectEphemeralDiscoveryCapabilityRequestV1 {
  readonly sessionToken: string;
  readonly linkId: string;
  readonly sessionId: string;
  readonly turnId: string;
}

export interface DirectEphemeralDiscoveryCapabilityReceiptV1<Result> {
  readonly version:
    typeof DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1;
  readonly status: "CONSUMED";
  readonly result: Result;
}

export type DirectEphemeralDiscoveryCapabilityConsumerV1 = (
  injection: DirectEphemeralDiscoveryCapabilityInjectionV1,
) => Promise<DirectEphemeralDiscoveryCapabilityReceiptV1<unknown>>;

export interface DirectEphemeralDiscoveryCapabilitySourceV1 {
  readonly version:
    typeof DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1;
  readonly scope: DirectEphemeralDiscoveryCapabilityScopeV1;
  readonly displayContext: DirectEphemeralDiscoveryDisplayContextV1;
  connect(
    consumer: DirectEphemeralDiscoveryCapabilityConsumerV1,
  ): () => void;
}

export interface DirectEphemeralDiscoveryCapabilityIssuerPortV1 {
  isReady(): boolean;
  deliverOnce(
    injection: DirectEphemeralDiscoveryCapabilityInjectionV1,
  ): Promise<DirectEphemeralDiscoveryCapabilityReceiptV1<unknown>>;
}

export class DirectEphemeralDiscoveryCapabilityInjectionErrorV1
  extends Error {
  public readonly code:
      | "DIRECT_CAPABILITY_SCOPE_INVALID"
      | "DIRECT_CAPABILITY_INJECTION_INVALID"
      | "DIRECT_CAPABILITY_EXPIRED"
      | "DIRECT_CAPABILITY_ALREADY_CONSUMED"
      | "DIRECT_CAPABILITY_CONSUMER_UNAVAILABLE"
      | "DIRECT_CAPABILITY_CONSUMER_ALREADY_CONNECTED";

  public constructor(code: DirectEphemeralDiscoveryCapabilityInjectionErrorV1["code"]) {
    super(code);
    this.code = code;
    this.name = "DirectEphemeralDiscoveryCapabilityInjectionErrorV1";
  }
}

function fail(
  code: DirectEphemeralDiscoveryCapabilityInjectionErrorV1["code"],
): never {
  throw new DirectEphemeralDiscoveryCapabilityInjectionErrorV1(code);
}

function assertScope(
  scope: DirectEphemeralDiscoveryCapabilityScopeV1,
): void {
  if (
    scope.environment !== "PREVIEW" ||
    !SAFE_LOCATOR.test(scope.linkId) ||
    !SAFE_LOCATOR.test(scope.sessionId) ||
    !SAFE_LOCATOR.test(scope.turnId)
  ) {
    fail("DIRECT_CAPABILITY_SCOPE_INVALID");
  }
}

function assertInjection(
  injection: DirectEphemeralDiscoveryCapabilityInjectionV1,
  now: number,
): string {
  if (!injection || typeof injection !== "object") {
    fail("DIRECT_CAPABILITY_INJECTION_INVALID");
  }
  const keys = Object.keys(injection).sort();
  const expectedKeys = [...INJECTION_KEYS].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    injection.version !==
      DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1 ||
    typeof injection.bearer !== "string" ||
    !BEARER.test(injection.bearer) ||
    !Number.isSafeInteger(injection.expiresAt)
  ) {
    fail("DIRECT_CAPABILITY_INJECTION_INVALID");
  }
  if (
    injection.expiresAt <= now ||
    injection.expiresAt - now >
      DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_TTL_MS_V1
  ) {
    fail("DIRECT_CAPABILITY_EXPIRED");
  }
  return injection.bearer;
}

export class DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1 {
  readonly #handoff = new EphemeralBrowserCapabilityHandoffV1();
  readonly #scope: DirectEphemeralDiscoveryCapabilityScopeV1;
  readonly #clock: () => number;
  #available = true;

  public constructor(
    scope: DirectEphemeralDiscoveryCapabilityScopeV1,
    clock: () => number = Date.now,
  ) {
    assertScope(scope);
    this.#scope = Object.freeze({ ...scope });
    this.#clock = clock;
  }

  public async injectAndExecute<Result>(
    injection: DirectEphemeralDiscoveryCapabilityInjectionV1,
    operation: (
      request: DirectEphemeralDiscoveryCapabilityRequestV1,
    ) => Promise<Result>,
  ): Promise<DirectEphemeralDiscoveryCapabilityReceiptV1<Result>> {
    if (!this.#available) {
      fail("DIRECT_CAPABILITY_ALREADY_CONSUMED");
    }
    this.#available = false;
    const bearer = assertInjection(injection, this.#clock());
    this.#handoff.accept("SESSION", bearer);
    try {
      const result = await this.#handoff.execute(
        "SESSION",
        (sessionToken) => operation(Object.freeze({
          sessionToken,
          linkId: this.#scope.linkId,
          sessionId: this.#scope.sessionId,
          turnId: this.#scope.turnId,
        })),
      );
      return Object.freeze({
        version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
        status: "CONSUMED" as const,
        result,
      });
    } finally {
      this.#handoff.clear("SESSION");
    }
  }

  public clear(): void {
    this.#available = false;
    this.#handoff.clearAll();
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
      status: this.#available ? "READY" : "UNAVAILABLE",
    });
  }
}

export function createDirectEphemeralDiscoveryCapabilityChannelV1(
  scope: DirectEphemeralDiscoveryCapabilityScopeV1,
  displayContext: DirectEphemeralDiscoveryDisplayContextV1,
): Readonly<{
  source: DirectEphemeralDiscoveryCapabilitySourceV1;
  issuerPort: DirectEphemeralDiscoveryCapabilityIssuerPortV1;
}> {
  assertScope(scope);
  let consumer: DirectEphemeralDiscoveryCapabilityConsumerV1 | null = null;
  let delivered = false;

  const source: DirectEphemeralDiscoveryCapabilitySourceV1 = Object.freeze({
    version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
    scope: Object.freeze({ ...scope }),
    displayContext: Object.freeze({ ...displayContext }),
    connect(nextConsumer: DirectEphemeralDiscoveryCapabilityConsumerV1) {
      if (consumer !== null) {
        fail("DIRECT_CAPABILITY_CONSUMER_ALREADY_CONNECTED");
      }
      consumer = nextConsumer;
      let connected = true;
      return () => {
        if (connected && consumer === nextConsumer) {
          consumer = null;
        }
        connected = false;
      };
    },
  });

  const issuerPort: DirectEphemeralDiscoveryCapabilityIssuerPortV1 =
    Object.freeze({
      isReady() {
        return !delivered && consumer !== null;
      },
      async deliverOnce(
        injection: DirectEphemeralDiscoveryCapabilityInjectionV1,
      ) {
        if (delivered) {
          fail("DIRECT_CAPABILITY_ALREADY_CONSUMED");
        }
        if (consumer === null) {
          fail("DIRECT_CAPABILITY_CONSUMER_UNAVAILABLE");
        }
        delivered = true;
        const target = consumer;
        consumer = null;
        return target(injection);
      },
    });

  return Object.freeze({ source, issuerPort });
}
