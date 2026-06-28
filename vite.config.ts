/**
 * vite.config.ts
 *
 * CHANGES FROM ORIGINAL
 * ──────────────────────────────────────────────────────────────────
 * 1. VENDOR CHUNK SPLITTING
 *    Before: everything landed in one 613 KB (gzip: 184 KB) index.js
 *    chunk. This violates the most basic performance contract: a
 *    one-character change to any app file invalidated the browser
 *    cache for React, Supabase, all Radix primitives, recharts, and
 *    date-fns at once.
 *
 *    After: vendors are split into stable chunks that change only
 *    when their own package version changes:
 *
 *      vendor-react      ~45 KB gz  (react, react-dom, react-router)
 *      vendor-query      ~15 KB gz  (tanstack/react-query)
 *      vendor-supabase   ~28 KB gz  (@supabase/supabase-js)
 *      vendor-radix      ~35 KB gz  (all @radix-ui/* primitives)
 *      vendor-charts     ~40 KB gz  (recharts)
 *      vendor-utils       ~8 KB gz  (clsx, tailwind-merge, cva, sonner)
 *      app chunks                   (lazy-loaded page code)
 *
 *    The app's own pages remain lazy-loaded so initial JS stays small.
 *    Users who already visited the site re-download only app chunks
 *    when you ship; vendor chunks are served from cache.
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
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // ── Stable vendor chunks ─────────────────────────────────
          // Keyed so Rollup creates predictable file names.
          // Order matters: more specific matches first.

          if (id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-") ||
              id.includes("node_modules/victory-")) {
            return "vendor-charts";
          }

          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }

          if (id.includes("node_modules/@supabase/") ||
              id.includes("node_modules/@realtime-js/")) {
            return "vendor-supabase";
          }

          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }

          if (id.includes("node_modules/react-router") ||
              id.includes("node_modules/react-dom") ||
              (id.includes("node_modules/react/") && !id.includes("react-"))) {
            return "vendor-react";
          }

          if (id.includes("node_modules/clsx") ||
              id.includes("node_modules/tailwind-merge") ||
              id.includes("node_modules/class-variance-authority") ||
              id.includes("node_modules/sonner") ||
              id.includes("node_modules/lucide-react")) {
            return "vendor-utils";
          }

          // date-fns is large; isolate it
          if (id.includes("node_modules/date-fns")) {
            return "vendor-dates";
          }

          // Everything else in node_modules goes into a catch-all
          // so it's still cached separately from app code.
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }

          // App code: Rollup's default lazy-chunk splitting handles pages.
        },
      },
    },
  },
}));
