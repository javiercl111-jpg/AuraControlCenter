import type { UsageLimitEvaluation } from "../types/usageLimits";

export function evaluateUsageLimit(data: {
  current: number;
  limit: number;
  warningThreshold: number;
}): UsageLimitEvaluation {
  const current = Number.isFinite(data.current) ? data.current : 0;
  const limit = Number.isFinite(data.limit) && data.limit > 0 ? data.limit : 0;
  const warningThreshold =
    Number.isFinite(data.warningThreshold) && data.warningThreshold > 0
      ? data.warningThreshold
      : 80;

  const percentage = limit > 0 ? Number(((current / limit) * 100).toFixed(2)) : 0;

  if (limit <= 0) {
    return {
      current,
      limit,
      warningThreshold,
      percentage,
      status: "OK",
      message: "Sin límite configurado.",
    };
  }

  if (current > limit) {
    return {
      current,
      limit,
      warningThreshold,
      percentage,
      status: "EXCEEDED",
      message: "El tenant excedió el límite contratado.",
    };
  }

  if (current === limit) {
    return {
      current,
      limit,
      warningThreshold,
      percentage,
      status: "LIMIT_REACHED",
      message: "El tenant alcanzó el límite contratado.",
    };
  }

  if (percentage >= warningThreshold) {
    return {
      current,
      limit,
      warningThreshold,
      percentage,
      status: "WARNING",
      message: "El tenant está cerca del límite contratado.",
    };
  }

  return {
    current,
    limit,
    warningThreshold,
    percentage,
    status: "OK",
    message: "Uso dentro del límite contratado.",
  };
}