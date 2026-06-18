import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info("[Aura Control Center] Nueva versión disponible.");
  },
  onOfflineReady() {
    console.info("[Aura Control Center] Shell PWA disponible offline.");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);