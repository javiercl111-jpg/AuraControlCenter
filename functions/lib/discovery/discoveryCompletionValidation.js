"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateDiscoveryCompletionState = exports.calculateConversationMetrics = exports.DiscoveryRequiredField = exports.DiscoveryKnowledgeGap = exports.DiscoveryHardRequirement = exports.DISCOVERY_CONVERSATION_DEFINITION_VERSION = void 0;
exports.validateDiscoveryCompletion = validateDiscoveryCompletion;
const discoveryCompletionShared_1 = require("./discoveryCompletionShared");
Object.defineProperty(exports, "DISCOVERY_CONVERSATION_DEFINITION_VERSION", { enumerable: true, get: function () { return discoveryCompletionShared_1.DISCOVERY_CONVERSATION_DEFINITION_VERSION; } });
Object.defineProperty(exports, "DiscoveryHardRequirement", { enumerable: true, get: function () { return discoveryCompletionShared_1.DiscoveryHardRequirement; } });
Object.defineProperty(exports, "DiscoveryKnowledgeGap", { enumerable: true, get: function () { return discoveryCompletionShared_1.DiscoveryKnowledgeGap; } });
Object.defineProperty(exports, "DiscoveryRequiredField", { enumerable: true, get: function () { return discoveryCompletionShared_1.DiscoveryRequiredField; } });
Object.defineProperty(exports, "calculateConversationMetrics", { enumerable: true, get: function () { return discoveryCompletionShared_1.calculateConversationMetrics; } });
Object.defineProperty(exports, "evaluateDiscoveryCompletionState", { enumerable: true, get: function () { return discoveryCompletionShared_1.evaluateDiscoveryCompletionState; } });
function validateDiscoveryCompletion(input) {
    const dossierPayload = input.dossierPayload || {};
    const linkData = input.linkData || {};
    const state = (0, discoveryCompletionShared_1.evaluateDiscoveryCompletionState)({
        dossierPayload,
        linkData,
    });
    const questionsAskedCount = Array.isArray(dossierPayload.conversationHistory)
        ? new Set(dossierPayload.conversationHistory
            .filter((entry) => entry &&
            typeof entry === "object" &&
            entry.role === "aura" &&
            typeof entry.content === "string" &&
            (entry.content.includes("?") || entry.content.includes("¿")))
            .map((entry) => entry.content.trim())).size
        : 0;
    return {
        valid: state.canComplete,
        hardMissingFields: state.hardMissingFields,
        evidenceGaps: state.optionalEvidenceGaps,
        conversationMetrics: state.conversationMetrics,
        questionsAskedCount,
        completionReason: state.canComplete
            ? "REQUIRED_FIELDS_COMPLETE"
            : "BLOCKED_MISSING_REQUIRED_FIELDS",
        missingRequiredFields: state.hardMissingFields,
        conversationDefinitionVersion: discoveryCompletionShared_1.DISCOVERY_CONVERSATION_DEFINITION_VERSION,
    };
}
//# sourceMappingURL=discoveryCompletionValidation.js.map