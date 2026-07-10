"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataConfidenceLevel = exports.AcquisitionSource = exports.ProspectOrigin = exports.MatchClassification = exports.PROSPECT_RESOLUTION_VERSION = void 0;
exports.PROSPECT_RESOLUTION_VERSION = "1.0";
var MatchClassification;
(function (MatchClassification) {
    MatchClassification["EXACT_MATCH"] = "EXACT_MATCH";
    MatchClassification["HIGH_CONFIDENCE"] = "HIGH_CONFIDENCE";
    MatchClassification["POSSIBLE_DUPLICATE"] = "POSSIBLE_DUPLICATE";
    MatchClassification["NEW_COMPANY"] = "NEW_COMPANY";
})(MatchClassification || (exports.MatchClassification = MatchClassification = {}));
var ProspectOrigin;
(function (ProspectOrigin) {
    ProspectOrigin["CONTROL_CENTER"] = "CONTROL_CENTER";
    ProspectOrigin["ADVISOR_SHARE"] = "ADVISOR_SHARE";
    ProspectOrigin["WEBSITE"] = "WEBSITE";
    ProspectOrigin["QR"] = "QR";
    ProspectOrigin["EMAIL"] = "EMAIL";
    ProspectOrigin["LINKEDIN"] = "LINKEDIN";
    ProspectOrigin["REFERRAL"] = "REFERRAL";
    ProspectOrigin["CAMPAIGN"] = "CAMPAIGN";
    ProspectOrigin["EVENT"] = "EVENT";
    ProspectOrigin["API"] = "API";
    ProspectOrigin["UNKNOWN"] = "UNKNOWN";
})(ProspectOrigin || (exports.ProspectOrigin = ProspectOrigin = {}));
var AcquisitionSource;
(function (AcquisitionSource) {
    AcquisitionSource["GOOGLE"] = "GOOGLE";
    AcquisitionSource["LINKEDIN"] = "LINKEDIN";
    AcquisitionSource["WHATSAPP"] = "WHATSAPP";
    AcquisitionSource["EMAIL"] = "EMAIL";
    AcquisitionSource["QR"] = "QR";
    AcquisitionSource["EVENT"] = "EVENT";
    AcquisitionSource["REFERRAL"] = "REFERRAL";
    AcquisitionSource["DIRECT"] = "DIRECT";
    AcquisitionSource["OTHER"] = "OTHER";
    AcquisitionSource["UNKNOWN"] = "UNKNOWN";
})(AcquisitionSource || (exports.AcquisitionSource = AcquisitionSource = {}));
var DataConfidenceLevel;
(function (DataConfidenceLevel) {
    DataConfidenceLevel[DataConfidenceLevel["DISCOVERY_CONFIRMED"] = 100] = "DISCOVERY_CONFIRMED";
    DataConfidenceLevel[DataConfidenceLevel["ADVISOR_VALIDATED"] = 90] = "ADVISOR_VALIDATED";
    DataConfidenceLevel[DataConfidenceLevel["CRM"] = 80] = "CRM";
    DataConfidenceLevel[DataConfidenceLevel["DENUE"] = 70] = "DENUE";
    DataConfidenceLevel[DataConfidenceLevel["INFERENCE"] = 60] = "INFERENCE";
    DataConfidenceLevel[DataConfidenceLevel["LEGACY_IMPORT"] = 50] = "LEGACY_IMPORT";
})(DataConfidenceLevel || (exports.DataConfidenceLevel = DataConfidenceLevel = {}));
//# sourceMappingURL=types.js.map