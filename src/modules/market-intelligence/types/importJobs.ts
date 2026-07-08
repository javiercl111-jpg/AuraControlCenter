export type ImportJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface BackendImportJob {
  id: string;
  status: ImportJobStatus;
  filename: string;
  storagePath: string;
  fileSizeBytes: number;
  totalEstimatedRows: number;
  processedRows: number;
  added: number;
  overwritten: number;
  omitted: number;
  failed: number;
  createdTime: string;
  updatedTime: string;
  error?: string;
  startedBy: string; // User email
  stateCodes: string[]; // State regions processed
}

export interface BackendImportAuditEntry {
  id: string;
  jobId: string;
  timestamp: string;
  filename: string;
  totalProcessed: number;
  added: number;
  updated: number;
  omitted: number;
  failed: number;
  timeMs: number;
  user: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
}

const ImportJobs = {};
export default ImportJobs;
