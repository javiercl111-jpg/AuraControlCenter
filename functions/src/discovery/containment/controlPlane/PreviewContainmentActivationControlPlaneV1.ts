import {
  buildPreviewContainmentActivationAuditIdV1,
  fingerprintPreviewContainmentPolicyV1,
} from "./previewContainmentFingerprintV1";
import {
  materializePreviewContainmentPolicyV1,
  validatePreviewContainmentActivationRequestV1,
  validatePreviewContainmentPolicyProposalV1,
} from "./previewContainmentActivationValidationV1";
import {
  PreviewContainmentActivationErrorV1,
  type PreviewContainmentActivationAuthorityVerifierV1,
  type PreviewContainmentActivationStoreV1,
  type PreviewContainmentServerClockV1,
} from "./previewContainmentActivationTypesV1";

export class PreviewContainmentActivationControlPlaneV1 {
  constructor(
    private readonly expectedTenantId: string,
    private readonly authority: PreviewContainmentActivationAuthorityVerifierV1,
    private readonly store: PreviewContainmentActivationStoreV1,
    private readonly clock: PreviewContainmentServerClockV1,
  ) {}

  async execute(requestValue: unknown, proposalValue: unknown) {
    const request = validatePreviewContainmentActivationRequestV1(
      requestValue, this.expectedTenantId,
    );
    const proposal = validatePreviewContainmentPolicyProposalV1(proposalValue);
    if (proposal.tenantId !== request.tenantId ||
        proposal.policyVersion !== request.proposedVersion ||
        proposal.reason !== request.reason || proposal.ownerRole !== request.actor ||
        proposal.approvedByRole !== request.approver ||
        proposal.rollbackVersion !== request.expectedCurrentVersion) {
      throw new PreviewContainmentActivationErrorV1("ACTIVATION_POLICY_INVALID");
    }
    if (await this.authority.verify({
      actor: request.actor,
      approver: request.approver,
      reason: request.reason,
      tenantId: request.tenantId,
      projectId: request.projectId,
    }) !== "ALLOW") {
      throw new PreviewContainmentActivationErrorV1("ACTIVATION_AUTHORITY_REJECTED");
    }
    const serverTimestamp = this.clock.nowEpochMilliseconds();
    if (!Number.isSafeInteger(serverTimestamp) || serverTimestamp < 1) {
      throw new PreviewContainmentActivationErrorV1("ACTIVATION_STATE_CORRUPTED");
    }
    const fingerprint = fingerprintPreviewContainmentPolicyV1(proposal);
    return this.store.execute({
      request,
      proposal,
      policy: materializePreviewContainmentPolicyV1(proposal, serverTimestamp),
      fingerprint,
      auditId: buildPreviewContainmentActivationAuditIdV1(request),
      serverTimestamp,
    });
  }
}
