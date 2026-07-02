/**
 * main.tsx — App bootstrap
 *
 * ROOT CAUSE OF "blank screen on published site, works in Lovable preview"
 * ──────────────────────────────────────────────────────────────────────
 * The old version used a STATIC import:
 *
 *     import App from "./App.tsx";
 *     createRoot(...).render(<App />);
 *
 * A static import executes the ENTIRE module graph (App.tsx → AuthContext.tsx
 * → integrations/supabase/client.ts → createClient(...)) BEFORE any of main.tsx's
 * own code runs — including before React exists in memory.
 *
 * If VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing or malformed
 * in the PUBLISHED build's environment (a very common mismatch: Lovable's live
 * preview iframe can have different env injection than the published static
 * deploy), createClient() throws a synchronous TypeError during module
 * evaluation — before React mounts, before any ErrorBoundary exists to catch it.
 * Result: <div id="root"> stays permanently empty. No console-visible React
 * error in most setups, just a blank white/dark screen.
 *
 * THE FIX
 * ──────────────────────────────────────────────────────────────────────
 * 1. Use a DYNAMIC import() wrapped in try/catch. Any error anywhere in the
 *    App import chain — env vars, a bad module, anything — is now caught
 *    and rendered as a clear, styled error message using plain DOM APIs
 *    (not React, not Tailwind classes) so it works even if React itself
 *    failed to initialize.
 * 2. Service worker registration now passes `updateViaCache: "none"` so
 *    browsers/CDNs can never HTTP-cache the service-worker.js file itself.
 *    Without this, a republish with a fixed service worker can still not
 *    reach users if their browser has the OLD service-worker.js script
 *    cached and never even checks for the new one.
 */

import { createRoot } from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root");

// ── Fatal error UI — plain DOM, no React/Tailwind dependency ──────
// This must work even if React itself failed to load, so it uses
// inline styles only.
function renderFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const isEnvIssue = /supabase|url|VITE_/i.test(message);

  if (!rootEl) {
    // Even #root is missing — write directly to body as a last resort.
    document.body.innerHTML = `<pre style="color:red;padding:24px;font-family:monospace">${message}</pre>`;
    return;
  }

  rootEl.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #0a0e1a;
      color: #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <div style="max-width: 480px; width: 100%; text-align: center;">
        <div style="
          width: 56px; height: 56px; border-radius: 16px;
          background: rgba(239,68,68,0.12);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 8px;">App failed to start</h1>
        <p style="font-size: 14px; color: #9ca3af; margin: 0 0 20px; line-height: 1.5;">
          ${isEnvIssue
            ? "This usually means required configuration (Supabase URL / API key) is missing from this deployment's environment."
            : "The app hit an error before it could load. Reloading usually fixes temporary issues."}
        </p>
        <div style="display:flex; gap:12px; justify-content:center; margin-bottom: 20px;">
          <button onclick="location.reload()" style="
            padding: 10px 20px; border-radius: 10px; border: none;
            background: #22d3ee; color: #0a0e1a; font-weight: 600; font-size: 14px;
            cursor: pointer;
          ">Reload page</button>
        </div>
        <pre style="
          text-align: left; font-size: 11px; color: #ef4444;
          background: rgba(239,68,68,0.08); border-radius: 10px;
          padding: 12px; overflow: auto; white-space: pre-wrap; word-break: break-word;
        ">${message}</pre>
      </div>
    </div>
  `;
}

// ── Bootstrap: dynamic import catches ANY error in the App module graph ──
async function bootstrap() {
  if (!rootEl) throw new Error("Root element #root not found in index.html");

  try {
    const { default: App } = await import("./App.tsx");
    createRoot(rootEl).render(<App />);
  } catch (error) {
    console.error("[main.tsx] Fatal error while starting the app:", error);
    renderFatalError(error);
  }
}

void bootstrap();

// ── Service worker registration ────────────────────────────────────
// updateViaCache: "none" is critical — without it, browsers/CDNs are
// allowed to HTTP-cache service-worker.js itself, which can prevent
// a fixed service worker from ever reaching users after you republish.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        // Proactively check for a newer service worker on every load.
        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
