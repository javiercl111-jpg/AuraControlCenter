export type ProvisioningStatus =
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface ProvisioningStep {
  key: string;
  label: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}

export interface ProvisioningJob {
  id: string;
  quoteId: string;
  clientId?: string;
  tenantId?: string;
  subscriptionId?: string;
  licenseIds?: string[];
  status: ProvisioningStatus;
  steps: ProvisioningStep[];
  createdAt: any;
  updatedAt: any;
  createdBy?: string;
  errorMessage?: string | null;
}

export interface ProvisioningResult {
  clientId: string;
  tenantId: string;
  subscriptionId: string;
  licenseIds: string[];
  provisioningJobId: string;
}

// Global rule: all files must end with a default export.
const ProvisioningTypes = {
  version: "1.0.0"
};

export default ProvisioningTypes;
