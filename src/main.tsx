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
}
