// ---------------------------------------------------------------------------
// FE-764 Slice 4 — pure helpers for the Petrinaut launcher URL surface.
//
// `resolvePetrinautBaseUrl` implements the multi-tier base-URL policy locked
// in PLAN.md §petri-sync-server: CLI flag wins over env var, env var wins
// over nothing, and "nothing" is a hard failure with one fixed message. No
// baked-in localhost default — a wrong default silently opens the wrong tab.
//
// `composeLauncherUrl` produces the URL brunch hands to Petrinaut for a live
// run: `{baseUrl}?runId=…&mode=actual&sse=…`. Uses the WHATWG `URL` API +
// `searchParams.set` so any existing query params on `baseUrl` survive and
// the SSE endpoint (itself a URL) is encoded correctly.
// ---------------------------------------------------------------------------

export type ResolvePetrinautBaseUrlInput = {
  /** Value of the `--petrinaut-base-url=…` CLI flag, or `undefined` / `''` if unset. */
  cliFlag: string | undefined;
  /** Subset of `process.env` carrying `PETRINAUT_BASE_URL`. Caller decides what to expose. */
  env: { PETRINAUT_BASE_URL?: string };
};

export type ResolvePetrinautBaseUrlResult = { baseUrl: string } | { error: string };

/** Locked error message — exact wording cited in CARDS.md / PLAN.md. */
export const PETRINAUT_BASE_URL_MISSING_MESSAGE =
  'Petrinaut base URL required: set PETRINAUT_BASE_URL in .env or pass --petrinaut-base-url=<url>';

export function resolvePetrinautBaseUrl(input: ResolvePetrinautBaseUrlInput): ResolvePetrinautBaseUrlResult {
  const fromCli = input.cliFlag?.trim();
  if (fromCli) return { baseUrl: fromCli };

  const fromEnv = input.env.PETRINAUT_BASE_URL?.trim();
  if (fromEnv) return { baseUrl: fromEnv };

  return { error: PETRINAUT_BASE_URL_MISSING_MESSAGE };
}

export type ComposeLauncherUrlInput = {
  /** Resolved Petrinaut SPA base URL (may carry path / query already). */
  baseUrl: string;
  /** Cook run id — passed through verbatim as the `runId` query param. */
  runId: string;
  /** SSE endpoint the cook-hosted server is listening on; encoded into `sse=`. */
  streamUrl: string;
};

export function composeLauncherUrl(input: ComposeLauncherUrlInput): string {
  const url = new URL(input.baseUrl);
  url.searchParams.set('runId', input.runId);
  url.searchParams.set('mode', 'actual');
  url.searchParams.set('sse', input.streamUrl);
  return url.toString();
}
