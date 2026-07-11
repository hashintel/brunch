export interface ResolvePetrinautUrlInput {
  readonly env: { readonly PETRINAUT_URL?: string };
}

export type ResolvePetrinautUrlResult = { readonly url: string } | { readonly error: string };

export const PETRINAUT_URL_MISSING_MESSAGE = 'Petrinaut URL required: set PETRINAUT_URL';
export const PETRINAUT_URL_INVALID_MESSAGE = 'Petrinaut URL must be an absolute http(s) URL';

export function resolvePetrinautUrl(input: ResolvePetrinautUrlInput): ResolvePetrinautUrlResult {
  const fromEnv = input.env.PETRINAUT_URL?.trim();
  if (fromEnv) return resolveAbsoluteHttpUrl(fromEnv);

  return { error: PETRINAUT_URL_MISSING_MESSAGE };
}

export interface ComposePetrinautLauncherUrlInput {
  readonly petrinautUrl: string;
  readonly runId: string;
  readonly streamUrl: string;
}

export function composePetrinautLauncherUrl(input: ComposePetrinautLauncherUrlInput): string {
  const url = new URL(input.petrinautUrl);
  url.searchParams.set('runId', input.runId);
  url.searchParams.set('sse', input.streamUrl);
  return url.toString();
}

function resolveAbsoluteHttpUrl(value: string): ResolvePetrinautUrlResult {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return { url: value };
  } catch {
    // Fall through to the stable invalid-url message.
  }
  return { error: PETRINAUT_URL_INVALID_MESSAGE };
}
