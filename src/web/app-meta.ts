// ── App identity ──────────────────────────────────────────────────────
//
// Static product chrome for the global header. `APP_VERSION` is injected at
// build time from package.json via the Vite `define` for `__BRUNCH_VERSION__`
// (see vite.config.ts); the guard keeps it safe if the define is ever absent.

declare const __BRUNCH_VERSION__: string | undefined;

export const APP_NAME = 'brunch';
export const APP_TAGLINE = 'AI-guided spec elicitation';
export const APP_VERSION = typeof __BRUNCH_VERSION__ === 'string' ? __BRUNCH_VERSION__ : '0.0.0';

/** Collapse a leading `/Users/<name>` or `/home/<name>` to `~` for display. */
export function abbreviateHomePath(path: string): string {
  return path.replace(/^\/(?:Users|home)\/[^/]+/u, '~');
}
