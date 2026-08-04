import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { createHash, randomUUID } from "crypto";

import {
  DISCOVERY_COST_BOUND_POLICY_V1,
  DiscoveryPayloadError,
} from "./discoveryPayloadBounds";

export const DISCOVERY_CONVERSATION_BUDGETS_COLLECTION =
  "discovery_conversation_budgets_v1";
export const DISCOVERY_DOWNLOAD_BUDGETS_COLLECTION =
  "discovery_download_budgets_v1";

const id = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

function millis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value &&
      typeof value.toMillis === "function") {
    return (value.toMillis as () => number)();
  }
  return 0;
}

export class FirestoreDiscoveryCostBudgetRepository {
  constructor(
    private readonly db: Firestore,
    private readonly clock: () => number = Date.now,
  ) {}

  async reserveConversation(sessionCapabilityHash: string): Promise<string> {
    const now = this.clock();
    const leaseId = randomUUID();
    const ref = this.db.collection(DISCOVERY_CONVERSATION_BUDGETS_COLLECTION)
      .doc(id(sessionCapabilityHash));
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data() ?? {};
      const turnCount = Number(data.turnCount ?? 0);
      const geminiAttempts = Number(data.geminiAttempts ?? 0);
      if (!Number.isSafeInteger(turnCount) || !Number.isSafeInteger(geminiAttempts)) {
        throw new DiscoveryPayloadError("COST_BOUND_CONFIGURATION_ERROR");
      }
      if (millis(data.inFlightUntil) > now ||
          turnCount >= DISCOVERY_COST_BOUND_POLICY_V1.maxConversationTurns ||
          geminiAttempts + DISCOVERY_COST_BOUND_POLICY_V1.maxGeminiAttemptsPerTurn >
            DISCOVERY_COST_BOUND_POLICY_V1.maxGeminiAttemptsPerSession) {
        throw new DiscoveryPayloadError("CONVERSATION_BUDGET_EXCEEDED");
      }
      transaction.set(ref, {
        version: DISCOVERY_COST_BOUND_POLICY_V1.version,
        sessionCapabilityHash,
        turnCount: turnCount + 1,
        geminiAttempts:
          geminiAttempts + DISCOVERY_COST_BOUND_POLICY_V1.maxGeminiAttemptsPerTurn,
        leaseId,
        inFlightUntil: Timestamp.fromMillis(
          now + DISCOVERY_COST_BOUND_POLICY_V1.conversationLeaseMs,
        ),
        createdAt: data.createdAt ?? Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
      });
    }, { maxAttempts: 10 });
    return leaseId;
  }

  async releaseConversation(
    sessionCapabilityHash: string,
    leaseId: string,
  ): Promise<void> {
    const ref = this.db.collection(DISCOVERY_CONVERSATION_BUDGETS_COLLECTION)
      .doc(id(sessionCapabilityHash));
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.leaseId !== leaseId) return;
      transaction.update(ref, {
        leaseId: null,
        inFlightUntil: null,
        updatedAt: Timestamp.fromMillis(this.clock()),
      });
    }, { maxAttempts: 5 });
  }

  async consumeDownload(budgetKey: string): Promise<Readonly<{
    remaining: number;
    windowEndsAt: number;
  }>> {
    const now = this.clock();
    const windowStart = Math.floor(
      now / DISCOVERY_COST_BOUND_POLICY_V1.downloadWindowMs,
    ) * DISCOVERY_COST_BOUND_POLICY_V1.downloadWindowMs;
    const windowEndsAt = windowStart + DISCOVERY_COST_BOUND_POLICY_V1.downloadWindowMs;
    const ref = this.db.collection(DISCOVERY_DOWNLOAD_BUDGETS_COLLECTION)
      .doc(id(`${budgetKey}:${windowStart}`));
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const count = Number(snapshot.data()?.count ?? 0);
      if (!Number.isSafeInteger(count)) {
        throw new DiscoveryPayloadError("COST_BOUND_CONFIGURATION_ERROR");
      }
      if (count >= DISCOVERY_COST_BOUND_POLICY_V1.maxDownloadsPerWindow) {
        throw new DiscoveryPayloadError("DOWNLOAD_LIMIT_EXCEEDED");
      }
      const nextCount = count + 1;
      transaction.set(ref, {
        version: DISCOVERY_COST_BOUND_POLICY_V1.version,
        budgetKeyHash: id(budgetKey),
        windowStart: Timestamp.fromMillis(windowStart),
        windowEndsAt: Timestamp.fromMillis(windowEndsAt),
        count: nextCount,
        createdAt: snapshot.data()?.createdAt ?? Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
      });
      return Object.freeze({
        remaining:
          DISCOVERY_COST_BOUND_POLICY_V1.maxDownloadsPerWindow - nextCount,
        windowEndsAt,
      });
    }, { maxAttempts: 10 });
  }
}
