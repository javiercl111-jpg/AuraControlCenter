import { beforeEach, describe, expect, it, vi } from "vitest";

const callableMock = vi.hoisted(() => vi.fn());
const httpsCallableMock = vi.hoisted(() => vi.fn(() => callableMock));

vi.mock("firebase/functions", () => ({ httpsCallable: httpsCallableMock }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock("../../../config/firebase", () => ({ db: {}, functions: {} }));

import { createPreviewDiscoverySubmitObserverV1 } from "../observability/previewDiscoverySubmitObservabilityV1";
import type { PreviewDiscoverySubmitDiagnosticEventV1 } from "../observability/previewDiscoverySubmitObservabilityV1";
import { createDiscoveryLink, type CreateDiscoveryLeadRequest } from "./discoveryLinkService";

function request(idempotencyKey = "12345678-1234-4234-8234-123456789012"): CreateDiscoveryLeadRequest {
  return {
    companyName: "Synthetic Company",
    contactName: "Synthetic Contact",
    email: "synthetic@example.invalid",
    origin: "WEBSITE",
    acquisitionSource: "DIRECT",
    privacyConsent: true,
    diagnosticDeliveryConsent: true,
    followUpConsent: false,
    marketingConsent: false,
    policyVersion: "DISCOVERY_PRIVACY_V1",
    idempotencyKey,
  };
}

function harness() {
  const events: PreviewDiscoverySubmitDiagnosticEventV1[] = [];
  return {
    events,
    observer: createPreviewDiscoverySubmitObserverV1({
      environment: "PREVIEW",
      sink: (event) => events.push(event),
    }),
  };
}

describe("createDiscoveryLink Preview observability", () => {
  beforeEach(() => {
    callableMock.mockReset();
    httpsCallableMock.mockClear();
  });

  it("dispatches exactly once and observes exactly one network success", async () => {
    const { events, observer } = harness();
    callableMock.mockResolvedValue({
      data: {
        status: "CREATED",
        nextAction: "CONTINUE",
        linkId: "synthetic-link",
        oneTimeToken: "synthetic-one-time-value",
        organizationProfile: "UNCLASSIFIED",
        requiresManualReview: false,
      },
    });

    await expect(createDiscoveryLink(request(), undefined, observer)).resolves.toMatchObject({
      status: "CREATED",
    });

    expect(httpsCallableMock).toHaveBeenCalledTimes(1);
    expect(callableMock).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_SERVICE_DISPATCH_STARTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_NETWORK_DISPATCH_OBSERVED"))
      .toEqual([expect.objectContaining({ outcome: "SUCCEEDED" })]);
  });

  it("rejects an invalid client precondition with zero callable dispatch", async () => {
    const { events, observer } = harness();

    await expect(createDiscoveryLink(request("invalid"), undefined, observer))
      .rejects.toThrow("DISCOVERY_IDEMPOTENCY_KEY_INVALID");

    expect(httpsCallableMock).not.toHaveBeenCalled();
    expect(callableMock).not.toHaveBeenCalled();
    expect(events.map((event) => event.stage)).toEqual([
      "DISCOVERY_CLIENT_PRECONDITION_REJECTED",
      "DISCOVERY_SERVICE_DISPATCH_FAILED_PRE_NETWORK",
    ]);
  });

  it("records App Check rejection before network observation", async () => {
    const { events, observer } = harness();
    callableMock.mockRejectedValue({ code: "appCheck/recaptcha-error" });

    await expect(createDiscoveryLink(request(), undefined, observer)).rejects.toEqual({
      code: "appCheck/recaptcha-error",
    });

    expect(callableMock).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_SERVICE_DISPATCH_STARTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_APP_CHECK_REJECTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_NETWORK_DISPATCH_OBSERVED"))
      .toHaveLength(0);
    expect(events.at(-1)).toMatchObject({
      stage: "DISCOVERY_SERVICE_DISPATCH_FAILED_PRE_NETWORK",
      safeErrorCode: "APP_CHECK_PRECONDITION_FAILED",
    });
  });

  it("never dispatches the service or callable more than once per invocation", async () => {
    const { events, observer } = harness();
    callableMock.mockResolvedValue({
      data: {
        status: "CREATED",
        nextAction: "CONTINUE",
        linkId: "synthetic-link",
        oneTimeToken: "synthetic-one-time-value",
      },
    });

    await createDiscoveryLink(request(), undefined, observer);

    expect(events.filter((event) => event.stage === "DISCOVERY_SERVICE_DISPATCH_STARTED"))
      .toHaveLength(1);
    expect(httpsCallableMock).toHaveBeenCalledTimes(1);
    expect(callableMock).toHaveBeenCalledTimes(1);
  });
});
