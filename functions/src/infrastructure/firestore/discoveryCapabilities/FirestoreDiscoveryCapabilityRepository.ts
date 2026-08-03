import type {
  DocumentData,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import {
  DISCOVERY_CAPABILITY_POLICY_V1,
  DISCOVERY_CAPABILITY_VERSION,
  DISCOVERY_COMPLETION_VERSION,
  DiscoveryCapabilityError,
  authorizeDiscoveryCapabilityV1,
  createDiscoveryCompletionEventIdV1,
  createDiscoveryCompletionIdV1,
  createDiscoveryNotificationKeyV1,
  createDiscoveryReportIdV1,
  createDiscoverySessionIdV1,
  hashDiscoveryCapabilityToken,
  parseDiscoveryCapabilityV1,
  type DiscoveryCapabilityV1,
  type DiscoveryCompletionRecordV1,
} from "../../../discovery/capabilities";
import {
  DISCOVERY_CAPABILITIES_COLLECTION,
  DISCOVERY_COMPLETIONS_COLLECTION,
  DISCOVERY_COMPLETION_OUTBOX_COLLECTION,
} from "./firestoreDiscoveryCapabilityCollections";
import {
  deserializeDiscoveryCapabilityV1,
  deserializeDiscoveryCompletionV1,
  serializeDiscoveryCapabilityV1,
  serializeDiscoveryCompletionV1,
} from "./firestoreDiscoveryCapabilitySerialization";

const MAX_TRANSACTION_ATTEMPTS = 20;

export interface DiscoveryCompletionEffectResult {
  readonly dossierData: Readonly<Record<string, unknown>>;
  readonly prospectId: string | null;
  readonly resolutionStatus: string | null;
  readonly trustDecision: string;
  readonly companyName: string;
  readonly prospectName: string;
  readonly advisorUid: string | null;
  readonly advisorId: string | null;
  readonly shadowEvaluationContext: unknown;
}

export type DiscoveryCompletionTransactionResult = Readonly<{
  kind: "NEW" | "REPLAY";
  completion: DiscoveryCompletionRecordV1;
  shadowEvaluationContext: unknown | null;
}>;

export interface DiscoveryCapabilityCompletionInput {
  readonly sessionToken: string;
  readonly linkId: string;
  readonly requestHash: string;
  readonly reportCapabilityHash: string;
  readonly effect: (context: Readonly<{
    transaction: Transaction;
    linkData: DocumentData;
    sessionId: string;
    dossierId: string;
    completionId: string;
    eventId: string;
    reportId: string;
  }>) => Promise<DiscoveryCompletionEffectResult>;
}

const inFlightCompletions = new Map<string, Readonly<{
  requestHash: string;
  reportCapabilityHash: string;
  promise: Promise<DiscoveryCompletionTransactionResult>;
}>>();

function nowMillis(): number {
  return Date.now();
}

function requireTimestamp(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === "object" && "toMillis" in value &&
      typeof value.toMillis === "function") {
    return (value.toMillis as () => number)();
  }
  throw new DiscoveryCapabilityError(
    "COMPLETION_INTERNAL_FAILURE", "Required timestamp is invalid.",
  );
}

function completionRecord(value: unknown): DiscoveryCompletionRecordV1 {
  const data = deserializeDiscoveryCompletionV1(value) as
    | Record<string, unknown>
    | null;
  if (
    !data || data.version !== DISCOVERY_COMPLETION_VERSION ||
    typeof data.completionId !== "string" ||
    typeof data.requestHash !== "string" ||
    typeof data.sessionCapabilityHash !== "string" ||
    typeof data.reportCapabilityHash !== "string" ||
    typeof data.sessionId !== "string" || typeof data.dossierId !== "string" ||
    typeof data.reportId !== "string" || typeof data.eventId !== "string" ||
    typeof data.notificationKey !== "string" ||
    !Number.isSafeInteger(data.createdAt) || !Number.isSafeInteger(data.completedAt)
  ) {
    throw new DiscoveryCapabilityError(
      "COMPLETION_INTERNAL_FAILURE", "Completion record is corrupt.",
    );
  }
  return data as unknown as DiscoveryCompletionRecordV1;
}

export class FirestoreDiscoveryCapabilityRepository {
  constructor(
    private readonly db: Firestore,
    private readonly clock: () => number = nowMillis,
  ) {}

  async exchangeLegacyLink(input: Readonly<{
    linkId: string;
    exchangeToken: string;
    sessionTokenHash: string;
  }>): Promise<Readonly<{ linkData: DocumentData; sessionId: string }>> {
    const now = this.clock();
    const exchangeHash = hashDiscoveryCapabilityToken(input.exchangeToken);
    const sessionId = createDiscoverySessionIdV1(
      input.linkId, DISCOVERY_CAPABILITY_POLICY_V1.sessionGeneration,
    );
    const linkRef = this.db.collection("market_discovery_links").doc(input.linkId);
    const exchangeRef = this.db.collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(exchangeHash);
    const sessionRef = this.db.collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(input.sessionTokenHash);
    try {
      return await this.db.runTransaction(async (transaction) => {
        const [linkSnap, exchangeSnap, sessionSnap] = await Promise.all([
          transaction.get(linkRef), transaction.get(exchangeRef), transaction.get(sessionRef),
        ]);
        if (exchangeSnap.exists) {
          const existing = parseDiscoveryCapabilityV1(
            deserializeDiscoveryCapabilityV1(exchangeSnap.data()),
          );
          if (existing.consumedAt !== null) {
            throw new DiscoveryCapabilityError(
              "CAPABILITY_ALREADY_CONSUMED", "Exchange already consumed.",
            );
          }
          throw new DiscoveryCapabilityError(
            "COMPLETION_INTERNAL_FAILURE", "Exchange state is inconsistent.",
          );
        }
        if (!linkSnap.exists || sessionSnap.exists) {
          throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
        }
        const linkData = linkSnap.data()!;
        if (
          linkData.status !== "pending" || linkData.usageCount !== 0 ||
          linkData.tokenHash !== exchangeHash
        ) {
          throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
        }
        const expiresAt = requireTimestamp(linkData.expiresAt);
        if (expiresAt <= now) {
          throw new DiscoveryCapabilityError("CAPABILITY_EXPIRED", "Exchange expired.");
        }
        const exchange: DiscoveryCapabilityV1 = {
          version: DISCOVERY_CAPABILITY_VERSION,
          type: "EXCHANGE", subjectId: input.linkId, linkId: input.linkId,
          sessionId: null, audience: "PUBLIC_DISCOVERY",
          purpose: "DISCOVERY_TOKEN_EXCHANGE", generation: 1,
          tokenHash: exchangeHash, issuedAt: now, expiresAt,
          consumedAt: now, completedAt: null, revokedAt: null,
          revocationReason: null, createdAt: now, updatedAt: now,
        };
        const session: DiscoveryCapabilityV1 = {
          version: DISCOVERY_CAPABILITY_VERSION,
          type: "SESSION", subjectId: sessionId, linkId: input.linkId,
          sessionId, audience: "PUBLIC_DISCOVERY", purpose: "DISCOVERY_SESSION",
          generation: DISCOVERY_CAPABILITY_POLICY_V1.sessionGeneration,
          tokenHash: input.sessionTokenHash, issuedAt: now, expiresAt,
          consumedAt: null, completedAt: null, revokedAt: null,
          revocationReason: null, createdAt: now, updatedAt: now,
        };
        transaction.create(exchangeRef, serializeDiscoveryCapabilityV1(exchange));
        transaction.create(sessionRef, serializeDiscoveryCapabilityV1(session));
        transaction.update(linkRef, {
          usageCount: 1, usedAt: Timestamp.fromMillis(now),
          sessionId, sessionCapabilityHash: input.sessionTokenHash,
          sessionCapabilityGeneration: session.generation,
          sessionTokenHash: FieldValue.delete(),
          sessionTokenExpiresAt: FieldValue.delete(), tokenHash: FieldValue.delete(),
          updatedAt: Timestamp.fromMillis(now),
        });
        return Object.freeze({ linkData, sessionId });
      }, { maxAttempts: MAX_TRANSACTION_ATTEMPTS });
    } catch (error: unknown) {
      if (error instanceof DiscoveryCapabilityError) throw error;
      throw new DiscoveryCapabilityError(
        "COMPLETION_INTERNAL_FAILURE", "Exchange transaction failed.", { cause: error },
      );
    }
  }

  async authorizeSession(input: Readonly<{
    token: string; linkId: string; allowCompleted?: boolean;
  }>): Promise<Readonly<{ capability: DiscoveryCapabilityV1; linkData: DocumentData }>> {
    const tokenHash = hashDiscoveryCapabilityToken(input.token);
    const [capSnap, linkSnap] = await Promise.all([
      this.db.collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(tokenHash).get(),
      this.db.collection("market_discovery_links").doc(input.linkId).get(),
    ]);
    if (!capSnap.exists || !linkSnap.exists) {
      throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
    }
    const linkData = linkSnap.data()!;
    const capability = authorizeDiscoveryCapabilityV1(
      deserializeDiscoveryCapabilityV1(capSnap.data()),
      {
        now: this.clock(), tokenHash, type: "SESSION", purpose: "DISCOVERY_SESSION",
        linkId: input.linkId,
        generation: linkData.sessionCapabilityGeneration,
        allowCompletedSession: input.allowCompleted,
      },
    );
    if (
      linkData.sessionCapabilityHash !== tokenHash ||
      linkData.sessionId !== capability.sessionId
    ) {
      throw new DiscoveryCapabilityError("CAPABILITY_BINDING_MISMATCH", "Binding mismatch.");
    }
    return Object.freeze({ capability, linkData });
  }

  async authorizeReport(input: Readonly<{
    token: string; reportId: string; linkId?: string;
  }>): Promise<Readonly<{
    capability: DiscoveryCapabilityV1;
    sessionData: DocumentData;
    linkData: DocumentData;
  }>> {
    const tokenHash = hashDiscoveryCapabilityToken(input.token);
    const capSnap = await this.db
      .collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(tokenHash).get();
    if (!capSnap.exists) {
      throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
    }
    const parsed = parseDiscoveryCapabilityV1(
      deserializeDiscoveryCapabilityV1(capSnap.data()),
    );
    const capability = authorizeDiscoveryCapabilityV1(parsed, {
      now: this.clock(), tokenHash, type: "REPORT", purpose: "DISCOVERY_REPORT",
      subjectId: input.reportId,
      ...(input.linkId ? { linkId: input.linkId } : {}),
    });
    if (capability.sessionId === null) {
      throw new DiscoveryCapabilityError("CAPABILITY_BINDING_MISMATCH", "Binding mismatch.");
    }
    const [sessionSnap, linkSnap] = await Promise.all([
      this.db.collection("discovery_sessions").doc(capability.sessionId).get(),
      this.db.collection("market_discovery_links").doc(capability.linkId).get(),
    ]);
    if (!sessionSnap.exists || !linkSnap.exists) {
      throw new DiscoveryCapabilityError("CAPABILITY_BINDING_MISMATCH", "Binding mismatch.");
    }
    const linkData = linkSnap.data()!;
    if (
      linkData.dossierId !== capability.sessionId ||
      linkData.reportCapabilityHash !== tokenHash ||
      linkData.reportCapabilityGeneration !== capability.generation
    ) {
      throw new DiscoveryCapabilityError("CAPABILITY_GENERATION_MISMATCH", "Generation mismatch.");
    }
    return Object.freeze({
      capability, sessionData: sessionSnap.data()!, linkData,
    });
  }

  async revoke(tokenHash: string, reason: string): Promise<void> {
    const now = this.clock();
    const ref = this.db.collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(tokenHash);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
      }
      const capability = parseDiscoveryCapabilityV1(
        deserializeDiscoveryCapabilityV1(snapshot.data()),
      );
      transaction.set(ref, serializeDiscoveryCapabilityV1({
        ...capability,
        revokedAt: capability.revokedAt ?? now,
        revocationReason: capability.revocationReason ?? reason,
        updatedAt: now,
      }));
    }, { maxAttempts: MAX_TRANSACTION_ATTEMPTS });
  }

  async rotateReportCapability(input: Readonly<{
    currentTokenHash: string;
    nextTokenHash: string;
    reason: string;
  }>): Promise<DiscoveryCapabilityV1> {
    const now = this.clock();
    const currentRef = this.db.collection(DISCOVERY_CAPABILITIES_COLLECTION)
      .doc(input.currentTokenHash);
    const nextRef = this.db.collection(DISCOVERY_CAPABILITIES_COLLECTION)
      .doc(input.nextTokenHash);
    try {
      return await this.db.runTransaction(async (transaction) => {
        const [currentSnap, nextSnap] = await Promise.all([
          transaction.get(currentRef), transaction.get(nextRef),
        ]);
        if (!currentSnap.exists || nextSnap.exists) {
          throw new DiscoveryCapabilityError(
            "CAPABILITY_NOT_FOUND", "Capability unavailable.",
          );
        }
        const current = authorizeDiscoveryCapabilityV1(
          deserializeDiscoveryCapabilityV1(currentSnap.data()),
          {
            now, tokenHash: input.currentTokenHash, type: "REPORT",
            purpose: "DISCOVERY_REPORT",
          },
        );
        const linkRef = this.db.collection("market_discovery_links").doc(current.linkId);
        const linkSnap = await transaction.get(linkRef);
        if (
          !linkSnap.exists ||
          linkSnap.data()?.reportCapabilityHash !== input.currentTokenHash ||
          linkSnap.data()?.reportCapabilityGeneration !== current.generation
        ) {
          throw new DiscoveryCapabilityError(
            "CAPABILITY_GENERATION_MISMATCH", "Generation mismatch.",
          );
        }
        const next: DiscoveryCapabilityV1 = {
          ...current,
          generation: current.generation + 1,
          tokenHash: input.nextTokenHash,
          issuedAt: now,
          expiresAt: now + DISCOVERY_CAPABILITY_POLICY_V1.reportTtlMs,
          revokedAt: null,
          revocationReason: null,
          createdAt: now,
          updatedAt: now,
        };
        transaction.set(currentRef, serializeDiscoveryCapabilityV1({
          ...current,
          revokedAt: now,
          revocationReason: input.reason,
          updatedAt: now,
        }));
        transaction.create(nextRef, serializeDiscoveryCapabilityV1(next));
        transaction.update(linkRef, {
          reportCapabilityHash: input.nextTokenHash,
          reportCapabilityGeneration: next.generation,
          updatedAt: Timestamp.fromMillis(now),
        });
        return Object.freeze(next);
      }, { maxAttempts: MAX_TRANSACTION_ATTEMPTS });
    } catch (error: unknown) {
      if (error instanceof DiscoveryCapabilityError) throw error;
      throw new DiscoveryCapabilityError(
        "COMPLETION_INTERNAL_FAILURE", "Capability rotation failed.",
        { cause: error },
      );
    }
  }

  completeWithEffect(
    input: DiscoveryCapabilityCompletionInput,
  ): Promise<DiscoveryCompletionTransactionResult> {
    const key = hashDiscoveryCapabilityToken(input.sessionToken);
    const pending = inFlightCompletions.get(key);
    if (pending) {
      if (
        pending.requestHash === input.requestHash &&
        pending.reportCapabilityHash === input.reportCapabilityHash
      ) {
        return pending.promise.then((result) => Object.freeze({
          kind: "REPLAY" as const,
          completion: result.completion,
          shadowEvaluationContext: null,
        }));
      }
      return pending.promise.then(
        () => this.completeWithEffect(input),
        () => this.completeWithEffect(input),
      );
    }
    const promise = this.completeWithEffectTransaction(input);
    inFlightCompletions.set(key, {
      requestHash: input.requestHash,
      reportCapabilityHash: input.reportCapabilityHash,
      promise,
    });
    return promise.finally(() => {
      if (inFlightCompletions.get(key)?.promise === promise) {
        inFlightCompletions.delete(key);
      }
    });
  }

  private async completeWithEffectTransaction(
    input: DiscoveryCapabilityCompletionInput,
  ): Promise<DiscoveryCompletionTransactionResult> {
    const now = this.clock();
    const sessionHash = hashDiscoveryCapabilityToken(input.sessionToken);
    const capabilityRef = this.db.collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(sessionHash);
    try {
      return await this.db.runTransaction(async (transaction) => {
        const capabilitySnap = await transaction.get(capabilityRef);
        if (!capabilitySnap.exists) {
          throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
        }
        const capability = authorizeDiscoveryCapabilityV1(
          deserializeDiscoveryCapabilityV1(capabilitySnap.data()),
          {
            now, tokenHash: sessionHash, type: "SESSION", purpose: "DISCOVERY_SESSION",
            linkId: input.linkId, allowCompletedSession: true,
          },
        );
        if (capability.sessionId === null) {
          throw new DiscoveryCapabilityError("CAPABILITY_BINDING_MISMATCH", "Binding mismatch.");
        }
        const sessionId = capability.sessionId;
        const completionId = createDiscoveryCompletionIdV1(sessionId);
        const eventId = createDiscoveryCompletionEventIdV1(sessionId);
        const notificationKey = createDiscoveryNotificationKeyV1(sessionId);
        const reportId = createDiscoveryReportIdV1(sessionId);
        const linkRef = this.db.collection("market_discovery_links").doc(input.linkId);
        const completionRef = this.db.collection(DISCOVERY_COMPLETIONS_COLLECTION).doc(completionId);
        const reportCapabilityRef = this.db
          .collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(input.reportCapabilityHash);
        const [linkSnap, completionSnap, reportCapabilitySnap] = await Promise.all([
          transaction.get(linkRef), transaction.get(completionRef),
          transaction.get(reportCapabilityRef),
        ]);
        if (!linkSnap.exists) {
          throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
        }
        const linkData = linkSnap.data()!;
        if (
          linkData.sessionCapabilityHash !== sessionHash ||
          linkData.sessionCapabilityGeneration !== capability.generation ||
          linkData.sessionId !== sessionId
        ) {
          throw new DiscoveryCapabilityError("CAPABILITY_GENERATION_MISMATCH", "Generation mismatch.");
        }

        if (capability.completedAt !== null) {
          if (!completionSnap.exists || !reportCapabilitySnap.exists) {
            throw new DiscoveryCapabilityError(
              "COMPLETION_INTERNAL_FAILURE", "Completed state is incomplete.",
            );
          }
          const completion = completionRecord(completionSnap.data());
          if (completion.requestHash !== input.requestHash) {
            throw new DiscoveryCapabilityError(
              "COMPLETION_REQUEST_CONFLICT", "Completion request conflict.",
            );
          }
          authorizeDiscoveryCapabilityV1(
            deserializeDiscoveryCapabilityV1(reportCapabilitySnap.data()),
            {
              now, tokenHash: input.reportCapabilityHash, type: "REPORT",
              purpose: "DISCOVERY_REPORT", linkId: input.linkId,
              sessionId, subjectId: reportId,
              generation: completion.reportCapabilityGeneration,
            },
          );
          return Object.freeze({
            kind: "REPLAY" as const, completion, shadowEvaluationContext: null,
          });
        }
        if (completionSnap.exists || reportCapabilitySnap.exists || linkData.status === "completed") {
          throw new DiscoveryCapabilityError(
            "COMPLETION_INTERNAL_FAILURE", "Completion state is inconsistent.",
          );
        }

        const effectResult = await input.effect({
          transaction, linkData, sessionId, dossierId: sessionId,
          completionId, eventId, reportId,
        });
        const reportCapability: DiscoveryCapabilityV1 = {
          version: DISCOVERY_CAPABILITY_VERSION,
          type: "REPORT", subjectId: reportId, linkId: input.linkId,
          sessionId, audience: "PUBLIC_DISCOVERY", purpose: "DISCOVERY_REPORT",
          generation: DISCOVERY_CAPABILITY_POLICY_V1.reportGeneration,
          tokenHash: input.reportCapabilityHash, issuedAt: now,
          expiresAt: now + DISCOVERY_CAPABILITY_POLICY_V1.reportTtlMs,
          consumedAt: null, completedAt: now, revokedAt: null,
          revocationReason: null, createdAt: now, updatedAt: now,
        };
        const completion: DiscoveryCompletionRecordV1 = {
          version: DISCOVERY_COMPLETION_VERSION,
          completionId, requestHash: input.requestHash,
          sessionCapabilityHash: sessionHash,
          reportCapabilityHash: input.reportCapabilityHash,
          reportCapabilityGeneration: reportCapability.generation,
          linkId: input.linkId, sessionId, dossierId: sessionId, reportId,
          eventId, notificationKey,
          prospectId: effectResult.prospectId,
          resolutionStatus: effectResult.resolutionStatus,
          trustDecision: effectResult.trustDecision,
          companyName: effectResult.companyName,
          prospectName: effectResult.prospectName,
          advisorUid: effectResult.advisorUid,
          advisorId: effectResult.advisorId,
          createdAt: now, completedAt: now,
        };
        transaction.create(
          this.db.collection("discovery_sessions").doc(sessionId),
          effectResult.dossierData,
        );
        transaction.set(capabilityRef, serializeDiscoveryCapabilityV1({
          ...capability, completedAt: now, updatedAt: now,
        }));
        transaction.create(reportCapabilityRef, serializeDiscoveryCapabilityV1(reportCapability));
        transaction.create(completionRef, serializeDiscoveryCompletionV1(completion));
        transaction.update(linkRef, {
          status: "completed", dossierId: sessionId,
          reportCapabilityHash: input.reportCapabilityHash,
          reportCapabilityGeneration: reportCapability.generation,
          sessionTokenHash: FieldValue.delete(),
          updatedAt: Timestamp.fromMillis(now), completedAt: Timestamp.fromMillis(now),
        });
        if (effectResult.prospectId) {
          transaction.update(
            this.db.collection("platform_leads").doc(effectResult.prospectId),
            { smartBusinessDossierId: sessionId, updatedAt: Timestamp.fromMillis(now) },
          );
        }
        transaction.set(this.db.collection("platform_events").doc(eventId), {
          eventId,
          type: effectResult.prospectId ? "DOSSIER_ATTACHED" : "DISCOVERY_COMPLETED",
          prospectId: effectResult.prospectId,
          linkId: input.linkId, sessionId, createdAt: Timestamp.fromMillis(now),
          actorType: "SYSTEM", source: "completeDiscoverySession",
          metadata: { dossierId: sessionId, completionId },
        });
        const outboxId = hashDiscoveryCapabilityToken(notificationKey);
        transaction.create(
          this.db.collection(DISCOVERY_COMPLETION_OUTBOX_COLLECTION).doc(outboxId),
          {
            version: "DISCOVERY_COMPLETION_OUTBOX_V1",
            completionId, notificationKey, eventId,
            sessionId, dossierId: sessionId,
            advisorUid: effectResult.advisorUid,
            advisorId: effectResult.advisorId,
            prospectId: effectResult.prospectId,
            companyName: effectResult.companyName,
            prospectName: effectResult.prospectName,
            status: "PENDING", createdAt: Timestamp.fromMillis(now),
            updatedAt: Timestamp.fromMillis(now),
          },
        );
        return Object.freeze({
          kind: "NEW" as const,
          completion,
          shadowEvaluationContext: effectResult.shadowEvaluationContext,
        });
      }, { maxAttempts: MAX_TRANSACTION_ATTEMPTS });
    } catch (error: unknown) {
      if (error instanceof DiscoveryCapabilityError) throw error;
      if (error instanceof Error && error.constructor.name === "HttpsError") throw error;
      throw new DiscoveryCapabilityError(
        "COMPLETION_INTERNAL_FAILURE", "Completion transaction failed.",
        { cause: error },
      );
    }
  }
}
