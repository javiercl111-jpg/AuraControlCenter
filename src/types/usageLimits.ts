export type UsageLimitStatus = "OK" | "WARNING" | "LIMIT_REACHED" | "EXCEEDED";

export interface UsageLimitEvaluation {
  current: number;
  limit: number;
  warningThreshold: number;
  percentage: number;
  status: UsageLimitStatus;
  message: string;
}