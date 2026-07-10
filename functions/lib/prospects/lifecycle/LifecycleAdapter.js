"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifecycleAdapter = void 0;
const types_1 = require("../types");
const ProspectLifecycleEngine_1 = require("./ProspectLifecycleEngine");
class LifecycleAdapter {
    /**
     * Translates database representations into the Engine's required input format
     * and invokes the Engine.
     */
    static evaluate(prospect, currentDate, contactAttempts, newContactAttempt, newActivityEvent, manualStatusOverride, commercialDecisionStatus) {
        // Convert Firestore Timestamp / string dates to JS Dates
        const lastContactAt = this.toDate(prospect.lastContactAt);
        const input = {
            prospectId: prospect.id || "unknown_id",
            currentStatus: prospect.lifecycleStatus || types_1.ProspectLifecycleStatus.NEW,
            lastContactAt: lastContactAt,
            contactAttemptsCount: prospect.contactAttemptsCount || 0,
            contactAttempts: contactAttempts,
            currentDate,
            newContactAttempt,
            newActivityEvent,
            manualStatusOverride,
            commercialDecisionStatus
        };
        return ProspectLifecycleEngine_1.ProspectLifecycleEngine.evaluate(input);
    }
    /**
     * Safely parse various date formats that might come from Firestore or JSON
     */
    static toDate(val) {
        if (!val)
            return null;
        if (val instanceof Date)
            return val;
        if (typeof val.toDate === "function")
            return val.toDate(); // Firestore Timestamp
        if (typeof val === "string")
            return new Date(val);
        if (typeof val === "number")
            return new Date(val);
        return null;
    }
}
exports.LifecycleAdapter = LifecycleAdapter;
//# sourceMappingURL=LifecycleAdapter.js.map