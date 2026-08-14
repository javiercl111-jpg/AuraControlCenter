import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const CONTROL_PROOF_DIGEST_V1 = /^[a-f0-9]{64}$/u;
const CONTROL_PROOF_DIGEST_VARIABLE_V1 =
  "VITE_AI_UX_02D2E4_CONTROL_PROOF_DIGEST_V1";
const LEGACY_CONTROL_PROOF_VARIABLE =
  "VITE_AI_UX_02D2E4_CONTROL_PROOF_SHA256";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const isPreviewCertification =
    mode === "preview-certification" ||
    environment.VITE_AURA_RUNTIME_ENVIRONMENT === "PREVIEW";
  const controlProofDigest = environment[CONTROL_PROOF_DIGEST_VARIABLE_V1];

  if (environment[LEGACY_CONTROL_PROOF_VARIABLE] !== undefined) {
    throw new Error("BROWSER_PROOF_LEGACY_BUILD_INPUT_REJECTED");
  }
  if (isPreviewCertification &&
      !CONTROL_PROOF_DIGEST_V1.test(controlProofDigest ?? "")) {
    throw new Error("BROWSER_PROOF_CERTIFIED_DIGEST_REQUIRED");
  }
  if (!isPreviewCertification && controlProofDigest !== undefined) {
    throw new Error("BROWSER_PROOF_DIGEST_OUTSIDE_PREVIEW_REJECTED");
  }

  return {
    plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "aura-control-center-favicon.png",
        "aura-control-center-logo.png",
      ],

      manifest: {
        name: "Aura Control Center",
        short_name: "Aura Control",
        description:
          "Aura Control Center - SaaS Administration Platform",

        start_url: "/",
        scope: "/",

        display: "standalone",
        orientation: "portrait",

        background_color: "#071426",
        theme_color: "#071426",

        icons: [
          {
            src: "/aura-control-center-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/aura-control-center-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      devOptions: {
        enabled: true,
        type: "module"
      },
      workbox: {
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 4194304, // 4 MiB

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webmanifest}",
        ],

        globIgnores: [
          "**/favicon.png",
          "**/Logo.png",
          "**/publicicon-192-maskable.png",
          "**/publicicon-512-maskable.png",
        ],

        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === "document" ||
              request.destination === "script" ||
              request.destination === "style" ||
              request.destination === "image",

            handler: "NetworkFirst",

            options: {
              cacheName: "aura-control-center-shell",

              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
    ],
  };
});
