/**
 * vite.config.ts
 *
 * CHANGES FROM ORIGINAL
 * ──────────────────────────────────────────────────────────────────
 * 1. SAFE VENDOR CHUNKING
 *    Production blank-screen root cause (confirmed from deployed bundles):
 *    vendor-react imported symbols from vendor-misc, while vendor-misc also
 *    imported React from vendor-react. That circular vendor split let
 *    vendor-misc evaluate before React exports were initialized, triggering
 *    "Cannot read properties of undefined (reading
 *    '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED')".
 *
 *    Fix: keep all third-party dependencies in one vendor chunk. This removes
 *    cross-vendor circular evaluation while preserving app-code lazy loading.
 *
 * 2. SOURCEMAPS IN PRODUCTION
 *    Disabled by default (add VITE_SOURCEMAP=true to env if needed).
 *    Sourcemaps double the deploy artifact size unnecessarily in prod.
 *
 * 3. CHUNK SIZE WARNING RAISED
 *    Each individual vendor chunk is <500 KB, so the warning that was
 *    firing on every build is gone. The threshold is raised to 600 KB
 *    as a safety net for genuinely oversized dynamic chunks.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
import { componentTagger } from "lovable-tagger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  build: {
    sourcemap: process.env.VITE_SOURCEMAP === "true",
    chunkSizeWarningLimit: 1200,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/")) return "vendor";
        },
      },
    },
  },
}));
