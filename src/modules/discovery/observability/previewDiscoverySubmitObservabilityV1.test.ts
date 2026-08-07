import { describe, expect, it, vi } from "vitest";
import {
  PREVIEW_DISCOVERY_SUBMIT_OBSERVABILITY_SCHEMA_V1,
  PREVIEW_DISCOVERY_SUBMIT_STAGES_V1,
  createPreviewDiscoverySubmitObserverV1,
  didPreviewDiscoveryNetworkDispatchV1,
  isPreviewDiscoveryAppCheckFailureV1,
  previewDiscoverySafeErrorCodeV1,
  type PreviewDiscoverySubmitDiagnosticEventV1,
} from "./previewDiscoverySubmitObservabilityV1";

describe("Preview Discovery submit observability V1", () => {
  it("emits the bounded schema in Preview with a monotonic sequence", () => {
    const events: PreviewDiscoverySubmitDiagnosticEventV1[] = [];
    const observer = createPreviewDiscoverySubmitObserverV1({
      environment: "PREVIEW",
      sink: (event) => events.push(event),
      now: () => new Date("2026-08-07T12:00:00.000Z"),
    });

    PREVIEW_DISCOVERY_SUBMIT_STAGES_V1.forEach((stage) => {
      observer.record(stage, "OBSERVED", { durationMs: 1.9 });
    });

    expect(observer.enabled).toBe(true);
    expect(events).toHaveLength(PREVIEW_DISCOVERY_SUBMIT_STAGES_V1.length);
    expect(events.map((event) => event.sequence)).toEqual(
      PREVIEW_DISCOVERY_SUBMIT_STAGES_V1.map((_, index) => index + 1),
    );
    expect(events[0]).toEqual({
      schemaVersion: PREVIEW_DISCOVERY_SUBMIT_OBSERVABILITY_SCHEMA_V1,
      sequence: 1,
      stage: "DISCOVERY_SUBMIT_CLICK_OBSERVED",
      outcome: "OBSERVED",
      timestamp: "2026-08-07T12:00:00.000Z",
      durationMs: 1,
    });
  });

  it.each(["PRODUCTION", "STAGING", "", "preview", undefined])(
    "fails closed outside authoritative PREVIEW (%s)",
    (environment) => {
      const sink = vi.fn();
      const observer = createPreviewDiscoverySubmitObserverV1({ environment, sink });
      observer.record("DISCOVERY_SUBMIT_CLICK_OBSERVED", "OBSERVED");
      expect(observer.enabled).toBe(false);
      expect(sink).not.toHaveBeenCalled();
    },
  );

  it("allows only bounded safe diagnostic fields and sanitizes an unsafe code", () => {
    const events: PreviewDiscoverySubmitDiagnosticEventV1[] = [];
    const observer = createPreviewDiscoverySubmitObserverV1({
      environment: "PREVIEW",
      sink: (event) => events.push(event),
    });

    observer.record("DISCOVERY_SERVICE_DISPATCH_FAILED_PRE_NETWORK", "FAILED", {
      safeErrorCode: "unsafe diagnostic with delimiters",
      durationMs: 3,
    });

    expect(events[0].safeErrorCode).toBe("UNCLASSIFIED_CLIENT_FAILURE");
    expect(Object.keys(events[0]).sort()).toEqual([
      "durationMs",
      "outcome",
      "safeErrorCode",
      "schemaVersion",
      "sequence",
      "stage",
      "timestamp",
    ]);
  });

  it("drops payload, PII, tokens, and secrets even if an untyped caller supplies them", () => {
    const events: PreviewDiscoverySubmitDiagnosticEventV1[] = [];
    const observer = createPreviewDiscoverySubmitObserverV1({
      environment: "PREVIEW",
      sink: (event) => events.push(event),
    });
    const forbiddenMarkers = [
      "private-person-marker",
      "private-email-marker",
      "private-company-marker",
      "private-payload-marker",
      "private-token-marker",
      "private-secret-marker",
    ];

    observer.record(
      "DISCOVERY_SERVICE_DISPATCH_STARTED",
      "STARTED",
      {
        safeErrorCode: "SERVICE_DISPATCH_STARTED",
        name: forbiddenMarkers[0],
        email: forbiddenMarkers[1],
        company: forbiddenMarkers[2],
        payload: forbiddenMarkers[3],
        token: forbiddenMarkers[4],
        secret: forbiddenMarkers[5],
      } as never,
    );

    const serialized = JSON.stringify(events);
    forbiddenMarkers.forEach((marker) => expect(serialized).not.toContain(marker));
    expect(serialized).not.toContain("payload");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("secret");
  });

  it("classifies SDK boundaries without inspecting payloads", () => {
    expect(didPreviewDiscoveryNetworkDispatchV1({ code: "functions/unavailable" })).toBe(true);
    expect(didPreviewDiscoveryNetworkDispatchV1({ code: "appCheck/recaptcha-error" })).toBe(false);
    expect(isPreviewDiscoveryAppCheckFailureV1({ code: "appCheck/recaptcha-error" })).toBe(true);
    expect(previewDiscoverySafeErrorCodeV1({ code: "appCheck/recaptcha-error" }))
      .toBe("APP_CHECK_PRECONDITION_FAILED");
    expect(previewDiscoverySafeErrorCodeV1({ code: "functions/unavailable" }))
      .toBe("FUNCTIONS_UNAVAILABLE");
  });
});
