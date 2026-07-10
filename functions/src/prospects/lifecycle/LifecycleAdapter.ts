import { PlatformLeadV2, ContactAttempt, PlatformEvent, ProspectLifecycleStatus } from "../types";
import { ProspectLifecycleEngine, ProspectLifecycleInput, ProspectLifecycleOutput } from "./ProspectLifecycleEngine";

export class LifecycleAdapter {

  /**
   * Translates database representations into the Engine's required input format
   * and invokes the Engine.
   */
  public static evaluate(
    prospect: PlatformLeadV2,
    currentDate: Date,
    contactAttempts: ContactAttempt[],
    newContactAttempt?: ContactAttempt,
    newActivityEvent?: PlatformEvent,
    manualStatusOverride?: ProspectLifecycleStatus,
    commercialDecisionStatus?: string
  ): ProspectLifecycleOutput {
    
    // Convert Firestore Timestamp / string dates to JS Dates
    const lastContactAt = this.toDate(prospect.lastContactAt);
    
    const input: ProspectLifecycleInput = {
      prospectId: prospect.id || "unknown_id",
      currentStatus: prospect.lifecycleStatus || ProspectLifecycleStatus.NEW,
      lastContactAt: lastContactAt,
      contactAttemptsCount: prospect.contactAttemptsCount || 0,
      contactAttempts: contactAttempts,
      currentDate,
      newContactAttempt,
      newActivityEvent,
      manualStatusOverride,
      commercialDecisionStatus
    };

    return ProspectLifecycleEngine.evaluate(input);
  }

  /**
   * Safely parse various date formats that might come from Firestore or JSON
   */
  private static toDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val.toDate === "function") return val.toDate(); // Firestore Timestamp
    if (typeof val === "string") return new Date(val);
    if (typeof val === "number") return new Date(val);
    return null;
  }
}
