import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info("[Aura Control Center] Nueva versión disponible.");
    (window as any).__auraSWNeedRefresh = true;
    (window as any).__auraSWUpdateFn = () => {
      console.log("[Aura SW] skipWaiting and updating service worker...");
      updateSW(true);
    };
    window.dispatchEvent(new CustomEvent("aura-sw-update-available"));
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