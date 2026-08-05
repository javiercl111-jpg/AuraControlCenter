import type {
  DiscoveryRuntimeFeatureGatesV1,
} from "./previewDiscoveryRuntimeContractV1";

export interface DiscoveryCompletionOptionalPortsV1 {
  readonly generatePdf: () => Promise<void>;
  readonly writeStorage: () => Promise<void>;
  readonly signUrl: () => Promise<void>;
  readonly emitNotification: () => Promise<void>;
  readonly enqueueCloudTask: () => Promise<void>;
}

export async function runDiscoveryCompletionOptionalEffectsV1(
  features: DiscoveryRuntimeFeatureGatesV1,
  ports: DiscoveryCompletionOptionalPortsV1,
): Promise<void> {
  if (features.pdfGenerationEnabled) await ports.generatePdf();
  if (features.storageEnabled) await ports.writeStorage();
  if (features.signedUrlsEnabled) await ports.signUrl();
  if (features.notificationsEnabled) await ports.emitNotification();
  if (features.cloudTasksEnabled) await ports.enqueueCloudTask();
}
