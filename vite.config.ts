import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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

      workbox: {
        navigateFallback: "/index.html",

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
});