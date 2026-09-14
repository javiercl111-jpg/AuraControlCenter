export type EphemeralCapabilityKind = "SESSION" | "REPORT";

export interface EphemeralCapabilityUsePolicy<Result> {
  retainAfterSuccess?: (result: Result) => boolean;
}

type CapabilitySlot = {
  bearer: string | null;
  inFlight: boolean;
};

/**
 * Component-lifetime bearer custody. This object deliberately has no
 * serialization, hydration, or browser-storage integration.
 */
export class EphemeralBrowserCapabilityHandoffV1 {
  readonly #slots: Record<EphemeralCapabilityKind, CapabilitySlot> = {
    SESSION: { bearer: null, inFlight: false },
    REPORT: { bearer: null, inFlight: false },
  };

  public accept(kind: EphemeralCapabilityKind, bearer: string): void {
    const normalized = bearer.trim();
    if (!normalized) {
      throw new Error("EPHEMERAL_CAPABILITY_REQUIRED");
    }

    const slot = this.#slots[kind];
    if (slot.bearer !== null || slot.inFlight) {
      throw new Error("EPHEMERAL_CAPABILITY_ALREADY_PRESENT");
    }

    slot.bearer = normalized;
  }

  public has(kind: EphemeralCapabilityKind): boolean {
    return this.#slots[kind].bearer !== null;
  }

  public isInFlight(kind: EphemeralCapabilityKind): boolean {
    return this.#slots[kind].inFlight;
  }

  public async execute<Result>(
    kind: EphemeralCapabilityKind,
    operation: (requestBearer: string) => Promise<Result>,
    policy: EphemeralCapabilityUsePolicy<Result> = {},
  ): Promise<Result> {
    const slot = this.#slots[kind];
    if (slot.inFlight) {
      throw new Error("EPHEMERAL_CAPABILITY_USE_IN_FLIGHT");
    }
    if (slot.bearer === null) {
      throw new Error("EPHEMERAL_CAPABILITY_UNAVAILABLE");
    }

    slot.inFlight = true;
    const requestBearer = slot.bearer;

    try {
      const result = await operation(requestBearer);
      const retain = policy.retainAfterSuccess?.(result) === true;
      if (!retain) {
        slot.bearer = null;
      }
      return result;
    } catch (error: unknown) {
      // Receipt is unknowable after a thrown transport failure. Fail closed.
      slot.bearer = null;
      throw error;
    } finally {
      slot.inFlight = false;
    }
  }

  public clear(kind: EphemeralCapabilityKind): void {
    const slot = this.#slots[kind];
    slot.bearer = null;
    slot.inFlight = false;
  }

  public clearAll(): void {
    this.clear("SESSION");
    this.clear("REPORT");
  }
}

export default EphemeralBrowserCapabilityHandoffV1;
