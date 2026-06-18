export type ExecutiveReportType =
  | "EXECUTIVE"
  | "COMMERCIAL"
  | "SAAS"
  | "FINANCIAL";

export interface ExecutiveReportMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface ExecutiveReport {
  type: ExecutiveReportType;
  title: string;
  subtitle: string;
  generatedAt: string;
  metrics: ExecutiveReportMetric[];
  alerts: string[];
}