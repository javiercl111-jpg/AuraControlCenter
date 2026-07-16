"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProspectLifecycleEngine = void 0;
const types_1 = require("../types");
class ProspectLifecycleEngine {
    static evaluate(input) {
        const output = {
            nextStatus: input.currentStatus,
            transitionAllowed: true,
            reason: "No transition required.",
            nextContactAt: null,
            eventsToEmit: [],
            warnings: [],
            noResponseSince: null, // Keep existing unless updated
            nurtureUntil: null,
            archivedAt: null
        };
        // 1. FINAL STATES CHECK
        if (input.currentStatus === types_1.ProspectLifecycleStatus.CUSTOMER && !input.manualStatusOverride) {
            output.reason = "CUSTOMER is a final state and does not transition automatically.";
            output.transitionAllowed = false;
            return output;
        }
        if (input.currentStatus === types_1.ProspectLifecycleStatus.DISQUALIFIED && !input.manualStatusOverride) {
            output.reason = "DISQUALIFIED requires manual override to reactivate.";
            output.transitionAllowed = false;
            return output;
        }
        // 2. MANUAL OVERRIDE (e.g. Admin re-assigns or changes status manually)
        if (input.manualStatusOverride) {
            if (this.isValidTransition(input.currentStatus, input.manualStatusOverride)) {
                output.nextStatus = input.manualStatusOverride;
                output.reason = `Manual override to ${input.manualStatusOverride}`;
                if (input.manualStatusOverride === types_1.ProspectLifecycleStatus.ARCHIVED) {
                    output.archivedAt = input.currentDate;
                }
                if (input.manualStatusOverride === types_1.ProspectLifecycleStatus.NURTURE) {
                    output.nurtureUntil = new Date(input.currentDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days nurture
                }
                this.addStatusChangeEvent(output, input, output.nextStatus, output.reason);
            }
            else {
                output.transitionAllowed = false;
                output.reason = `Invalid manual transition from ${input.currentStatus} to ${input.manualStatusOverride}`;
                output.warnings.push(output.reason);
            }
            return output;
        }
        // 3. REACTIVATION TRIGGERS (Incoming responses / Discovery completions)
        if (input.newActivityEvent) {
            const isReactivationState = [
                types_1.ProspectLifecycleStatus.NO_RESPONSE,
                types_1.ProspectLifecycleStatus.NURTURE,
                types_1.ProspectLifecycleStatus.ARCHIVED
            ].includes(input.currentStatus);
            if (isReactivationState) {
                // Any inbound valid activity reactivates
                output.nextStatus = types_1.ProspectLifecycleStatus.CONTACTED;
                output.reason = `Reactivated by event: ${input.newActivityEvent.type}`;
                this.addStatusChangeEvent(output, input, output.nextStatus, output.reason);
                output.eventsToEmit.push(this.createEvent(input, types_1.LifecycleEventType.PROSPECT_REACTIVATED, { reason: output.reason, sourceEventId: input.newActivityEvent.eventId }));
            }
            else {
                // Advance state based on activity
                if (input.newActivityEvent.type === types_1.LifecycleEventType.DISCOVERY_ATTACHED || input.newActivityEvent.type === "DISCOVERY_SENT") {
                    this.tryTransition(input, output, types_1.ProspectLifecycleStatus.DISCOVERY_SENT, "Discovery Link Sent");
                }
                else if (input.newActivityEvent.type === "DISCOVERY_STARTED") {
                    this.tryTransition(input, output, types_1.ProspectLifecycleStatus.DISCOVERY_IN_PROGRESS, "Discovery Started");
                }
                else if (input.newActivityEvent.type === types_1.LifecycleEventType.DOSSIER_ATTACHED || input.newActivityEvent.type === "DISCOVERY_COMPLETED") {
                    this.tryTransition(input, output, types_1.ProspectLifecycleStatus.DISCOVERY_COMPLETED, "Discovery Completed");
                }
                // Handle generic prospect replies
                else if (input.newActivityEvent.type === "PROSPECT_REPLIED") {
                    if (input.currentStatus === types_1.ProspectLifecycleStatus.CONTACT_PENDING) {
                        this.tryTransition(input, output, types_1.ProspectLifecycleStatus.CONTACTED, "Prospect Replied");
                    }
                }
            }
            return output;
        }
        // 4. NEW CONTACT ATTEMPT LOGIC
        if (input.newContactAttempt) {
            // Are we allowed to transition to CONTACTED?
            if ([types_1.ProspectLifecycleStatus.NEW, types_1.ProspectLifecycleStatus.QUALIFIED, types_1.ProspectLifecycleStatus.CONTACT_PENDING, types_1.ProspectLifecycleStatus.NO_RESPONSE, types_1.ProspectLifecycleStatus.NURTURE].includes(input.currentStatus)) {
                this.tryTransition(input, output, types_1.ProspectLifecycleStatus.CONTACTED, "Contact Attempt Recorded");
            }
            else {
                // Just record the attempt, state stays the same (e.g. FOLLOW_UP)
                output.reason = "Contact Attempt Recorded but state remains " + input.currentStatus;
            }
            // Calculate next contact based on policy
            const attemptsCount = input.contactAttemptsCount + 1;
            // No Response Policy Evaluation
            // Day 0: attempt 1
            // Day 3: attempt 2
            // Day 7: attempt 3
            // Day 14: NO_RESPONSE
            if (attemptsCount === 1) {
                output.nextContactAt = new Date(input.currentDate.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
            }
            else if (attemptsCount === 2) {
                output.nextContactAt = new Date(input.currentDate.getTime() + 4 * 24 * 60 * 60 * 1000); // +4 days (day 7 total)
            }
            else if (attemptsCount >= 3) {
                output.nextContactAt = new Date(input.currentDate.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days (day 14 total)
            }
            output.eventsToEmit.push(this.createEvent(input, types_1.LifecycleEventType.CONTACT_ATTEMPT_RECORDED, { attemptId: input.newContactAttempt.attemptId, outcome: input.newContactAttempt.outcome }));
            return output;
        }
        // 5. TIME-BASED DECAY / NO RESPONSE POLICY
        if (input.lastContactAt) {
            const daysSinceLastContact = (input.currentDate.getTime() - input.lastContactAt.getTime()) / (1000 * 3600 * 24);
            if (input.currentStatus === types_1.ProspectLifecycleStatus.CONTACTED ||
                input.currentStatus === types_1.ProspectLifecycleStatus.CONTACT_PENDING ||
                input.currentStatus === types_1.ProspectLifecycleStatus.FOLLOW_UP) {
                // If 14+ days since last contact, and they haven't replied -> NO_RESPONSE
                if (daysSinceLastContact >= 14 && input.contactAttemptsCount >= 3) {
                    this.tryTransition(input, output, types_1.ProspectLifecycleStatus.NO_RESPONSE, "14 days passed with 3+ attempts and no response");
                    if (output.nextStatus === types_1.ProspectLifecycleStatus.NO_RESPONSE) {
                        output.noResponseSince = input.currentDate;
                        output.eventsToEmit.push(this.createEvent(input, types_1.LifecycleEventType.NO_RESPONSE_ENTERED, { daysSinceLastContact }));
                    }
                }
            }
            if (input.currentStatus === types_1.ProspectLifecycleStatus.NO_RESPONSE) {
                // If in NO_RESPONSE for another 16 days (30 days total)
                if (daysSinceLastContact >= 30) {
                    // Move to NURTURE (could be ARCHIVED depending on other flags, but we default to NURTURE for safety)
                    this.tryTransition(input, output, types_1.ProspectLifecycleStatus.NURTURE, "30 days with no response");
                    if (output.nextStatus === types_1.ProspectLifecycleStatus.NURTURE) {
                        output.nurtureUntil = new Date(input.currentDate.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
                        output.eventsToEmit.push(this.createEvent(input, types_1.LifecycleEventType.NURTURE_ENTERED, { daysSinceLastContact }));
                    }
                }
            }
        }
        // 6. DEFAULT NEW PROSPECT BEHAVIOR
        if (input.currentStatus === types_1.ProspectLifecycleStatus.NEW) {
            // Typically needs fields filled to become QUALIFIED. 
            // For this pure engine, if they ask to qualify, we assume caller verified fields.
        }
        return output;
    }
    // --- Helpers ---
    static tryTransition(input, output, targetState, reason) {
        if (this.isValidTransition(output.nextStatus, targetState)) {
            output.nextStatus = targetState;
            output.reason = reason;
            this.addStatusChangeEvent(output, input, targetState, reason);
        }
        else {
            output.warnings.push(`Attempted invalid automatic transition from ${output.nextStatus} to ${targetState}`);
        }
    }
    static addStatusChangeEvent(output, input, nextStatus, reason) {
        output.eventsToEmit.push(this.createEvent(input, types_1.LifecycleEventType.PROSPECT_STATUS_CHANGED, { previousStatus: input.currentStatus, newStatus: nextStatus, reason }));
    }
    static createEvent(input, type, metadata) {
        // Basic idempotency key: prospectId + eventType + day string
        const dateStr = input.currentDate.toISOString().split('T')[0];
        // If it's related to a specific attempt, bind to attemptId to avoid duplicate events for same attempt
        let uniqueness = dateStr;
        if (type === types_1.LifecycleEventType.CONTACT_ATTEMPT_RECORDED && metadata.attemptId) {
            uniqueness = metadata.attemptId;
        }
        else if (metadata.sourceEventId) {
            uniqueness = metadata.sourceEventId;
        }
        return {
            eventId: `evt_${input.prospectId}_${type}_${uniqueness}`,
            type,
            prospectId: input.prospectId,
            createdAt: input.currentDate,
            actorType: "SYSTEM",
            source: "ProspectLifecycleEngine",
            metadata,
            eventKey: `${input.prospectId}_${type}_${uniqueness}`
        };
    }
    // Define valid transitions
    static isValidTransition(from, to) {
        if (from === to)
            return true;
        const allowedTransitions = {
            [types_1.ProspectLifecycleStatus.NEW]: [types_1.ProspectLifecycleStatus.QUALIFIED, types_1.ProspectLifecycleStatus.CONTACT_PENDING, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.QUALIFIED]: [types_1.ProspectLifecycleStatus.CONTACT_PENDING, types_1.ProspectLifecycleStatus.CONTACTED, types_1.ProspectLifecycleStatus.DISCOVERY_SENT, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.CONTACT_PENDING]: [types_1.ProspectLifecycleStatus.CONTACTED, types_1.ProspectLifecycleStatus.NO_RESPONSE, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.CONTACTED]: [types_1.ProspectLifecycleStatus.DISCOVERY_SENT, types_1.ProspectLifecycleStatus.DISCOVERY_IN_PROGRESS, types_1.ProspectLifecycleStatus.FOLLOW_UP, types_1.ProspectLifecycleStatus.NO_RESPONSE, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.DISCOVERY_SENT]: [types_1.ProspectLifecycleStatus.DISCOVERY_IN_PROGRESS, types_1.ProspectLifecycleStatus.DISCOVERY_COMPLETED, types_1.ProspectLifecycleStatus.FOLLOW_UP, types_1.ProspectLifecycleStatus.NO_RESPONSE, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.DISCOVERY_IN_PROGRESS]: [types_1.ProspectLifecycleStatus.DISCOVERY_COMPLETED, types_1.ProspectLifecycleStatus.FOLLOW_UP, types_1.ProspectLifecycleStatus.NO_RESPONSE, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.DISCOVERY_COMPLETED]: [types_1.ProspectLifecycleStatus.FOLLOW_UP, types_1.ProspectLifecycleStatus.PROPOSAL_PENDING, types_1.ProspectLifecycleStatus.CUSTOMER, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.FOLLOW_UP]: [types_1.ProspectLifecycleStatus.PROPOSAL_PENDING, types_1.ProspectLifecycleStatus.CUSTOMER, types_1.ProspectLifecycleStatus.NO_RESPONSE, types_1.ProspectLifecycleStatus.NURTURE, types_1.ProspectLifecycleStatus.DISQUALIFIED],
            [types_1.ProspectLifecycleStatus.PROPOSAL_PENDING]: [types_1.ProspectLifecycleStatus.NEGOTIATION, types_1.ProspectLifecycleStatus.CUSTOMER, types_1.ProspectLifecycleStatus.DISQUALIFIED, types_1.ProspectLifecycleStatus.FOLLOW_UP],
            [types_1.ProspectLifecycleStatus.NEGOTIATION]: [types_1.ProspectLifecycleStatus.CUSTOMER, types_1.ProspectLifecycleStatus.DISQUALIFIED, types_1.ProspectLifecycleStatus.FOLLOW_UP],
            [types_1.ProspectLifecycleStatus.CUSTOMER]: [], // Final
            [types_1.ProspectLifecycleStatus.DISQUALIFIED]: [], // Final, requires admin override to move
            [types_1.ProspectLifecycleStatus.NO_RESPONSE]: [types_1.ProspectLifecycleStatus.NURTURE, types_1.ProspectLifecycleStatus.ARCHIVED, types_1.ProspectLifecycleStatus.CONTACTED, types_1.ProspectLifecycleStatus.QUALIFIED],
            [types_1.ProspectLifecycleStatus.NURTURE]: [types_1.ProspectLifecycleStatus.CONTACT_PENDING, types_1.ProspectLifecycleStatus.CONTACTED, types_1.ProspectLifecycleStatus.ARCHIVED],
            [types_1.ProspectLifecycleStatus.ARCHIVED]: [types_1.ProspectLifecycleStatus.CONTACTED, types_1.ProspectLifecycleStatus.QUALIFIED, types_1.ProspectLifecycleStatus.NURTURE],
        };
        return allowedTransitions[from]?.includes(to) || false;
    }
}
exports.ProspectLifecycleEngine = ProspectLifecycleEngine;
//# sourceMappingURL=ProspectLifecycleEngine.js.map