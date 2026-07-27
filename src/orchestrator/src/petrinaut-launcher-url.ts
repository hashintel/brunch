// ---------------------------------------------------------------------------
// Pure helpers for the Petrinaut launcher URL surface.
//
// `resolvePetrinautUrl` implements the multi-tier Petrinaut-URL policy: CLI
// flag wins over env var, env var wins over nothing, and "nothing" is a hard
// failure with one fixed message. No baked-in localhost default — a wrong
// default silently opens the wrong tab. The resolved value is the full
// Petrinaut route, path included (e.g. `https://…stage.hash.ai/brunch`).
//
// `composeLauncherUrl` produces the URL brunch hands to Petrinaut for a live
// run: `{petrinautUrl}?runId=…&sse=…`. Uses the WHATWG `URL` API +
// `searchParams.set` so any existing path/query on `petrinautUrl` survives and
// the SSE endpoint (itself a URL) is encoded correctly. `mode` is intentionally
// not emitted — the shipped Petrinaut consumer reads `sse` + optional `runId`
// and ignores `mode`.
// ---------------------------------------------------------------------------

export type ResolvePetrinautUrlInput = {
  /** Value of the `--petrinaut-url=…` CLI flag, or `undefined` / `''` if unset. */
  cliFlag: string | undefined;
  /** Subset of `process.env` carrying `PETRINAUT_URL`. Caller decides what to expose. */
  env: { PETRINAUT_URL?: string };
};

export type ResolvePetrinautUrlResult = { url: string } | { error: string };

/** Locked error message — tests assert exact wording. */
export const PETRINAUT_URL_MISSING_MESSAGE =
  'Petrinaut URL required: set PETRINAUT_URL in .env or pass --petrinaut-url=<url>';
export const PETRINAUT_URL_INVALID_MESSAGE =
  'Petrinaut URL must be an absolute http(s) URL: set PETRINAUT_URL or pass --petrinaut-url=<url>';

export function resolvePetrinautUrl(input: ResolvePetrinautUrlInput): ResolvePetrinautUrlResult {
  const fromCli = input.cliFlag?.trim();
  if (fromCli) return resolveAbsoluteHttpUrl(fromCli);

  const fromEnv = input.env.PETRINAUT_URL?.trim();
  if (fromEnv) return resolveAbsoluteHttpUrl(fromEnv);

  return { error: PETRINAUT_URL_MISSING_MESSAGE };
}

function resolveAbsoluteHttpUrl(value: string): ResolvePetrinautUrlResult {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { url: value };
    }
  } catch {
    // Fall through to the locked invalid-url message.
  }
  return { error: PETRINAUT_URL_INVALID_MESSAGE };
}

export type ComposeLauncherUrlInput = {
  /** Resolved Petrinaut route (may carry path / query already). */
  petrinautUrl: string;
  /** Cook run id — passed through verbatim as the `runId` query param. */
  runId: string;
  /** SSE endpoint the cook-hosted server is listening on; encoded into `sse=`. */
  streamUrl: string;
};

export function composeLauncherUrl(input: ComposeLauncherUrlInput): string {
  const url = new URL(input.petrinautUrl);
  url.searchParams.set('runId', input.runId);
  url.searchParams.set('sse', input.streamUrl);
  return url.toString();
}
