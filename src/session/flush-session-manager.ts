/**
 * The single Brunch-side reliance on pi's private `SessionManager._rewriteFile`.
 *
 * Pi's SessionManager autosaves appended *messages*, but custom entries and
 * fixture-minted messages need an explicit rewrite to reach the JSONL file.
 * `_rewriteFile` is underscore-private (not in pi's public exports), so the
 * contract lives here — named once, cast once — instead of as scattered
 * `as unknown as` pokes (see docs/praxis/pi-types.md).
 *
 * Owns: the flush-to-file contract over pi session managers.
 * Used by: RPC session methods, the workspace session coordinator, the tier-2
 * dev harness, and probe fixture minting.
 */

import type { SessionManager } from '@earendil-works/pi-coding-agent';

interface FlushableSessionManager extends Pick<SessionManager, 'getSessionFile' | 'setSessionFile'> {
  _rewriteFile(): void;
}

/**
 * Rewrite the manager's entries to its JSONL file, then re-point the manager
 * at that file. `sessionFile` defaults to the manager's own current file; a
 * manager with no file is flush-skipped on the re-point only.
 */
export function flushSessionManagerToFile(manager: unknown, sessionFile?: string): void {
  const flushable = manager as FlushableSessionManager;
  const file = sessionFile ?? flushable.getSessionFile();
  flushable._rewriteFile();
  if (file) flushable.setSessionFile(file);
}
