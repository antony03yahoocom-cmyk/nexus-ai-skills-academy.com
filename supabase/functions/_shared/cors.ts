/**
 * supabase/functions/_shared/cors.ts
 *
 * Single source of truth for CORS headers across all edge functions.
 *
 * PROBLEM FIXED
 * ──────────────────────────────────────────────────────────────────
 * Before: every edge function defined its own corsHeaders object.
 * Each one had a slightly different Access-Control-Allow-Headers
 * string (some missing x-client-info, some missing apikey, one
 * importing from an entirely different package).
 *
 * ai-proposal/index.ts imported from 'npm:@supabase/supabase-js@2/cors'
 * — a subpath that may not exist in all Deno runtimes and imports
 * a different version than the main package.
 *
 * Result: browser CORS failures on specific function calls depending
 * on which headers the client happened to send.
 *
 * After: one object, imported by every function.
 *
 * USAGE
 * ──────────────────────────────────────────────────────────────────
 *   import { corsHeaders, handleCors } from "../_shared/cors.ts";
 *
 *   Deno.serve(async (req) => {
 *     const preflight = handleCors(req);
 *     if (preflight) return preflight;
 *     // ... handler
 *     return new Response(JSON.stringify(data), {
 *       headers: { ...corsHeaders, "Content-Type": "application/json" },
 *     });
 *   });
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-whatsapp-internal-key",
  ].join(", "),
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
} as const;

/**
 * Returns a 204 preflight response if the request is OPTIONS,
 * otherwise returns null so the caller can continue.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

/**
 * Wraps a JSON payload in a Response with CORS headers.
 */
export function jsonResponse(
  body: unknown,
  status = 200,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extra,
    },
  });
}
