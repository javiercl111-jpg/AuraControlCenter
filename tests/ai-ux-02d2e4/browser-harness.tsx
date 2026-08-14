import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
  AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
  DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
  hashAuthorizedJitControlProofV1,
  installAuthorizedJitBootstrapV1,
  type AuthorizedJitBootstrapTargetV1,
} from "../../src/modules/discovery/security/authorizedJitBootstrapV1";
import {
  DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1,
  type DirectEphemeralDiscoveryCapabilitySourceV1,
} from "../../src/modules/discovery/security/directEphemeralDiscoveryCapabilityInjectionV1";

const CONTROL_PROOF = "AIUX02D2E4.Local.Browser.Control.Proof.0001";

function MountedFrontendProbe({
  source,
}: Readonly<{ source: DirectEphemeralDiscoveryCapabilitySourceV1 }>) {
  const [status, setStatus] = useState("MOUNTED_WAITING_FOR_INJECTION");

  useEffect(() => {
    const boundary = new DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1(
      source.scope,
    );
    const disconnect = source.connect((injection) =>
      boundary.injectAndExecute(injection, async (request) => {
        if (
          request.linkId !== source.scope.linkId ||
          request.sessionId !== source.scope.sessionId ||
          request.turnId !== source.scope.turnId
        ) {
          throw new Error("HARNESS_SCOPE_MISMATCH");
        }
        setStatus("MOCK_EVALUATE_CONVERSATION_CONSUMED");
        return Object.freeze({ accepted: true });
      }));
    return () => {
      disconnect();
      boundary.clear();
    };
  }, [source]);

  return <p data-testid="frontend-status">{status}</p>;
}

function randomBearer(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0")).join("");
}

async function waitUntilReady(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("HARNESS_FRONTEND_NOT_READY");
}

async function run(): Promise<void> {
  const target = window as AuthorizedJitBootstrapTargetV1;
  const rootElement = document.getElementById("app");
  if (!rootElement) throw new Error("HARNESS_ROOT_MISSING");
  const root = createRoot(rootElement);
  installAuthorizedJitBootstrapV1({
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    controlProofSha256: await hashAuthorizedJitControlProofV1(CONTROL_PROOF),
    target,
    mountFrontend(source) {
      root.render(
        <StrictMode>
          <MountedFrontendProbe source={source} />
        </StrictMode>,
      );
    },
  });
  const descriptor = Object.getOwnPropertyDescriptor(
    target,
    AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1,
  );
  if (!descriptor || descriptor.enumerable) {
    throw new Error("HARNESS_CLAIM_EXPOSURE_INVALID");
  }
  const claimBoundary = target[AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1];
  if (!claimBoundary) throw new Error("HARNESS_CLAIM_MISSING");
  const handle = await claimBoundary.claim({
    version: AUTHORIZED_JIT_BOOTSTRAP_VERSION_V1,
    controlProof: CONTROL_PROOF,
  });
  if (Reflect.has(target, AUTHORIZED_JIT_BOOTSTRAP_CLAIM_PROPERTY_V1)) {
    throw new Error("HARNESS_CLAIM_NOT_REMOVED");
  }
  await waitUntilReady(() => handle.isFrontendReady());
  const bearer = randomBearer();
  await handle.deliverOnce({
    version: DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_VERSION_V1,
    bearer,
    expiresAt: Date.now() + 60_000,
  });
  if (
    handle.isFrontendReady() ||
    document.documentElement.outerHTML.includes(bearer) ||
    Object.values(sessionStorage).includes(bearer) ||
    Object.values(localStorage).includes(bearer)
  ) {
    throw new Error("HARNESS_SECRET_HYGIENE_FAILED");
  }
  document.body.dataset.result = "PASS";
}

void run().catch(() => {
  document.body.dataset.result = "FAIL";
});
