import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import {
  installAuthorizedJitBootstrapV1,
  type AuthorizedJitBootstrapTargetV1,
} from "./modules/discovery/security/authorizedJitBootstrapV1";
import type {
  DirectEphemeralDiscoveryCapabilitySourceV1,
} from "./modules/discovery/security/directEphemeralDiscoveryCapabilityInjectionV1";
import "./index.css";

registerSW({
  immediate: true,
});

const root = createRoot(document.getElementById("root")!);

function mountApplication(
  directEphemeralCapabilitySource?:
    DirectEphemeralDiscoveryCapabilitySourceV1,
): void {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App
          directEphemeralCapabilitySource={directEphemeralCapabilitySource}
        />
      </BrowserRouter>
    </StrictMode>,
  );
}

function mountWaitingForAuthorizedClaim(): void {
  root.render(
    <StrictMode>
      <main
        aria-busy="true"
        aria-live="polite"
        data-bootstrap-state="waiting-for-authorized-claim"
        role="status"
        style={{
          alignItems: "center",
          backgroundColor: "#020617",
          color: "#e2e8f0",
          display: "flex",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <section aria-labelledby="preview-authorization-title">
          <h1 id="preview-authorization-title">
            Preview authorization pending
          </h1>
          <p>
            This controlled Preview is waiting for an authorized session. No
            application data has been loaded.
          </p>
        </section>
      </main>
    </StrictMode>,
  );
}

const authorizedJitBootstrap = installAuthorizedJitBootstrapV1({
  environment: import.meta.env.VITE_AURA_RUNTIME_ENVIRONMENT,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  controlProofDigest:
    import.meta.env.VITE_AI_UX_02D2E4_CONTROL_PROOF_DIGEST_V1,
  target: window as AuthorizedJitBootstrapTargetV1,
  mountFrontend: mountApplication,
});

if (authorizedJitBootstrap.status === "UNAVAILABLE") {
  mountApplication();
} else {
  mountWaitingForAuthorizedClaim();
}
