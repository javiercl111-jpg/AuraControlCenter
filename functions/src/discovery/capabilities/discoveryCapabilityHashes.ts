import * as crypto from "crypto";

export function hashDiscoveryCapabilityToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function deriveDiscoveryReportCapabilityTokenV1(
  sessionId: string,
  generation: number,
  secret: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`discovery-report-capability:v1:${sessionId}:g${generation}`)
    .digest("hex");
}

export function hashDiscoveryCompletionRequestV1(value: unknown): string {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, stable(child)]),
      );
    }
    return input;
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

export function createDiscoverySessionIdV1(linkId: string, generation: number): string {
  return `dossier_${linkId}_g${generation}`;
}

export function createDiscoveryCompletionIdV1(sessionId: string): string {
  return `completion_${hashDiscoveryCapabilityToken(sessionId).slice(0, 40)}`;
}

export function createDiscoveryCompletionEventIdV1(sessionId: string): string {
  return `discovery_completed_${hashDiscoveryCapabilityToken(sessionId).slice(0, 40)}`;
}

export function createDiscoveryNotificationKeyV1(sessionId: string): string {
  return `discovery.completed:${sessionId}`;
}

export function createDiscoveryReportIdV1(sessionId: string): string {
  return `${sessionId}_EXTERNAL_RADIOGRAFIA_v1.0`;
}
