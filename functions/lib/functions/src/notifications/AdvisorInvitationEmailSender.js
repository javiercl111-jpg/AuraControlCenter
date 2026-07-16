"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAdvisorInvitationEmailSender = void 0;
class MockAdvisorInvitationEmailSender {
    async sendInvitation(email, name, activationLink) {
        // SMTP is not configured in Control Center, so we return PENDING.
        return "PENDING";
    }
}
exports.MockAdvisorInvitationEmailSender = MockAdvisorInvitationEmailSender;
//# sourceMappingURL=AdvisorInvitationEmailSender.js.map