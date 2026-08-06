import { createHash } from "node:crypto";
import type { PreviewContainmentPolicyProposalV1 } from
  "./previewContainmentActivationTypesV1";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

export function fingerprintPreviewContainmentPolicyV1(
  proposal: PreviewContainmentPolicyProposalV1,
): string {
  const semanticPolicy = {
    ...proposal,
    blockedAppIds: [...proposal.blockedAppIds].sort(),
    blockedCommercialCodeHashes: [...proposal.blockedCommercialCodeHashes].sort(),
  };
  return createHash("sha256")
    .update("aura:preview-containment-policy:v1\0", "utf8")
    .update(JSON.stringify(canonicalize(semanticPolicy)), "utf8")
    .digest("hex");
}

export function buildPreviewContainmentActivationAuditIdV1(input: Readonly<{
  tenantId: string;
  idempotencyKey: string;
}>): string {
  return `activation_${createHash("sha256")
    .update("aura:preview-containment-activation:v1\0", "utf8")
    .update(input.tenantId, "utf8").update("\0", "utf8")
    .update(input.idempotencyKey, "utf8").digest("hex").slice(0, 48)}`;
}
