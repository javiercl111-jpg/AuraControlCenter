import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { PreviewContainmentActivationControlPlaneV1 } from "../../discovery/containment/controlPlane/PreviewContainmentActivationControlPlaneV1";
import type {
  PreviewContainmentActivationAuthorityVerifierV1,
  PreviewContainmentServerClockV1,
} from "../../discovery/containment/controlPlane/previewContainmentActivationTypesV1";
import {
  FirestorePreviewContainmentActivationAuthorityVerifierV1,
  type PreviewContainmentAuthorityInspectionV1,
} from "../../infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationAuthorityVerifierV1";
import { FirestorePreviewContainmentActivationStoreV1 } from "../../infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationStoreV1";

const PREVIEW_TENANT = /^tenant-[a-f0-9]{32,64}$/;

export interface PrivatePreviewContainmentActivationCompositionV1 {
  readonly authorityVerifier: PreviewContainmentActivationAuthorityVerifierV1;
  readonly controlPlane: PreviewContainmentActivationControlPlaneV1;
  inspectAuthority(): Promise<PreviewContainmentAuthorityInspectionV1>;
}

export function createPrivatePreviewContainmentActivationCompositionV1(
  expectedTenantId: string,
  firestore: Firestore = getFirestore(),
  clock: PreviewContainmentServerClockV1 = Object.freeze({
    nowEpochMilliseconds: () => Date.now(),
  }),
): PrivatePreviewContainmentActivationCompositionV1 {
  if (!PREVIEW_TENANT.test(expectedTenantId)) {
    throw new Error("PREVIEW_CONTAINMENT_COMPOSITION_TENANT_REJECTED");
  }
  const authority = new FirestorePreviewContainmentActivationAuthorityVerifierV1(
    firestore,
  );
  const controlPlane = new PreviewContainmentActivationControlPlaneV1(
    expectedTenantId,
    authority,
    new FirestorePreviewContainmentActivationStoreV1(firestore),
    clock,
  );
  const authorityInput = Object.freeze({
    actor: "CONTAINMENT_ACTIVATION_ACTOR",
    approver: "CONTAINMENT_ACTIVATION_APPROVER",
    reason: "AUTHORITY_COMPOSITION_CERTIFICATION",
    tenantId: expectedTenantId,
    projectId: "aura-intel-preview" as const,
  });
  return Object.freeze({
    authorityVerifier: authority,
    controlPlane,
    inspectAuthority: () => authority.inspect(authorityInput),
  });
}
