// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callableMock = vi.hoisted(() => vi.fn());
const httpsCallableMock = vi.hoisted(() => vi.fn(() => callableMock));

vi.mock("firebase/functions", () => ({ httpsCallable: httpsCallableMock }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock("../config/firebase", () => ({
  appCheck: {},
  clientRuntimeEnvironment: "PREVIEW",
  db: {},
  functions: {},
}));

import type { PreviewDiscoverySubmitDiagnosticEventV1 } from "../modules/discovery/observability/previewDiscoverySubmitObservabilityV1";
import DiscoverPage from "./DiscoverPage";

const DIAGNOSTIC_LABEL = "AURA_PREVIEW_DISCOVERY_SUBMIT_DIAGNOSTIC";

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function diagnosticEvents(
  spy: ReturnType<typeof vi.spyOn>,
): PreviewDiscoverySubmitDiagnosticEventV1[] {
  const calls = spy.mock.calls as unknown[][];
  return calls
    .filter((call: unknown[]) => call[0] === DIAGNOSTIC_LABEL)
    .map((call: unknown[]) => call[1] as PreviewDiscoverySubmitDiagnosticEventV1);
}

async function renderPreform(): Promise<{
  container: HTMLDivElement;
  form: HTMLFormElement;
  root: Root;
}> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/discover"]}>
        <DiscoverPage />
      </MemoryRouter>,
    );
  });

  const form = container.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("DISCOVERY_PREFORM_NOT_RENDERED");
  return { container, form, root };
}

async function fillValidRequiredFields(form: HTMLFormElement): Promise<void> {
  const inputs = Array.from(form.querySelectorAll("input"));
  const textInputs = inputs.filter((input) => input.type !== "checkbox");
  const checkbox = inputs.find((input) => input.type === "checkbox");
  if (!checkbox) throw new Error("DISCOVERY_CONSENT_NOT_RENDERED");

  await act(async () => {
    setInputValue(textInputs[0], "Synthetic Company");
    setInputValue(textInputs[1], "Synthetic Contact");
    setInputValue(textInputs[2], "synthetic@example.invalid");
    checkbox.click();
  });
}

describe("DiscoverPage Preview submit observability", () => {
  const mountedRoots: Array<{ container: HTMLDivElement; root: Root }> = [];

  beforeEach(() => {
    callableMock.mockReset();
    httpsCallableMock.mockClear();
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    for (const { container, root } of mountedRoots.splice(0)) {
      await act(async () => root.unmount());
      container.remove();
    }
    vi.restoreAllMocks();
  });

  it("observes exactly one click, native submit, React handler, service dispatch, and callable", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
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
    const mounted = await renderPreform();
    mountedRoots.push(mounted);
    await fillValidRequiredFields(mounted.form);

    await act(async () => {
      (mounted.form.querySelector("button[type='submit']") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    const events = diagnosticEvents(consoleInfo);
    expect(events.filter((event) => event.stage === "DISCOVERY_SUBMIT_CLICK_OBSERVED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_NATIVE_SUBMIT_OBSERVED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_REACT_HANDLER_ENTERED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_VALIDATION_ACCEPTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_APP_CHECK_READY"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_CLIENT_PRECONDITION_ACCEPTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_SERVICE_DISPATCH_STARTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_NETWORK_DISPATCH_OBSERVED"))
      .toHaveLength(1);
    expect(httpsCallableMock).toHaveBeenCalledTimes(1);
    expect(callableMock).toHaveBeenCalledTimes(1);
  });

  it("observes native validation rejection with zero service and callable dispatch", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const mounted = await renderPreform();
    mountedRoots.push(mounted);

    await act(async () => {
      (mounted.form.querySelector("button[type='submit']") as HTMLButtonElement).click();
    });

    const events = diagnosticEvents(consoleInfo);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "DISCOVERY_SUBMIT_CLICK_OBSERVED" }),
      expect.objectContaining({
        stage: "DISCOVERY_VALIDATION_REJECTED",
        safeErrorCode: "DISCOVERY_NATIVE_CONSTRAINT_INVALID",
      }),
    ]));
    expect(events.filter((event) => event.stage === "DISCOVERY_SERVICE_DISPATCH_STARTED"))
      .toHaveLength(0);
    expect(httpsCallableMock).not.toHaveBeenCalled();
    expect(callableMock).not.toHaveBeenCalled();
  });

  it("surfaces App Check precondition failure with zero network observation", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    callableMock.mockRejectedValue({ code: "appCheck/recaptcha-error" });
    const mounted = await renderPreform();
    mountedRoots.push(mounted);
    await fillValidRequiredFields(mounted.form);

    await act(async () => {
      (mounted.form.querySelector("button[type='submit']") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    const events = diagnosticEvents(consoleInfo);
    expect(events.filter((event) => event.stage === "DISCOVERY_SERVICE_DISPATCH_STARTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_APP_CHECK_REJECTED"))
      .toHaveLength(1);
    expect(events.filter((event) => event.stage === "DISCOVERY_NETWORK_DISPATCH_OBSERVED"))
      .toHaveLength(0);
    expect(callableMock).toHaveBeenCalledTimes(1);
  });
});
