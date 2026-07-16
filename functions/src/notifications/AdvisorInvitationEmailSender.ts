export interface AdvisorInvitationEmailSender {
  sendInvitation(email: string, name: string, activationLink: string): Promise<"SENT" | "FAILED" | "PENDING">;
}

export class MockAdvisorInvitationEmailSender implements AdvisorInvitationEmailSender {
  async sendInvitation(email: string, name: string, activationLink: string): Promise<"SENT" | "FAILED" | "PENDING"> {
    // SMTP is not configured in Control Center, so we return PENDING.
    return "PENDING";
  }
}
