/**
 * Shared PTY choreography for the production session-runtime-contract
 * witnesses.
 *
 * `src/dev/tui-driver` remains the sole PTY surface in this repo: every spawn
 * below goes through its `startSession`, and no witness adds a second
 * spawn/expect path. Both `session-runtime-contract-tracer.slow.test.ts` and
 * `session-runtime-contract-companion.slow.test.ts` boot the *same* child entry
 * through here rather than forking a launcher variant, so the "no
 * `launchInteractive` override" claim holds for every journey.
 *
 * Owns: child argv, screen wait/require/absence primitives, the bounded Ctrl-D
 * quit, and the writer-lock postcondition read.
 * Input: a caller-owned scratch `cwd`, Pi agent dir, and report path.
 * Output: rendered screens and durable postconditions; never session truth —
 * that stays with the production canonical-session reader.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import {
  isSessionAlive,
  renderScreenFromLog,
  sendKeys,
  sendText,
  sessionStatus,
  startSession,
  waitForScreenText,
} from '../../dev/tui-driver.js';
import type { SessionTarget } from '../../session/live-session-host.js';
import { sessionWriterLockPath } from '../../session/session-writer-guard.js';

export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
export const CHILD_ENTRY = 'src/app/__tests__/session-runtime-contract-tracer-child.ts';
export const CHILD_PATH = join(REPO_ROOT, CHILD_ENTRY);

export const BOOT_TIMEOUT_MS = 90_000;
export const TURN_TIMEOUT_MS = 60_000;
export const QUIT_TIMEOUT_MS = 30_000;

/** Specify mode's how-to-work chooser, which holds the keyboard until dismissed. */
export const MODE_CHOOSER = 'Choose how Specify mode should work';

/**
 * Boot the production TUI child under a PTY. `PI_OFFLINE` and the scratch agent
 * dir keep the real product away from the developer's machine state; the child
 * itself supplies no launcher override.
 */
export async function startProductionTui(options: {
  readonly name: string;
  readonly cwd: string;
  readonly agentDir: string;
  readonly reportPath: string;
}): Promise<void> {
  await startSession({
    name: options.name,
    cols: 120,
    rows: 40,
    cwd: REPO_ROOT,
    command: [
      '/usr/bin/env',
      'PI_OFFLINE=1',
      'PI_SKIP_VERSION_CHECK=1',
      `PI_CODING_AGENT_DIR=${options.agentDir}`,
      process.execPath,
      '--import',
      'tsx',
      CHILD_ENTRY,
      options.cwd,
      options.reportPath,
    ],
  });
}

export async function waitForScreen(
  name: string,
  text: string | RegExp,
  timeoutMs: number,
): Promise<{ readonly matched: boolean; readonly screen: string[] }> {
  const status = sessionStatus(name);
  if (!status) throw new Error(`tui-driver session ${name} disappeared`);
  return waitForScreenText(status.logPath, status.cols, status.rows, text, { timeoutMs });
}

export async function requireScreen(
  name: string,
  text: string | RegExp,
  timeoutMs: number,
): Promise<string[]> {
  const result = await waitForScreen(name, text, timeoutMs);
  if (!result.matched) {
    throw new Error(
      `production TUI never rendered ${String(text)}\n${result.screen.map((line) => `│${line}`).join('\n')}`,
    );
  }
  return result.screen;
}

/**
 * The absence half of wait-for-text. A modal that is still capturing keys
 * swallows typed text silently, so a journey has to see it gone rather than
 * assume a keypress has landed.
 */
export async function requireScreenWithout(name: string, text: string, timeoutMs: number): Promise<void> {
  const status = sessionStatus(name);
  if (!status) throw new Error(`tui-driver session ${name} disappeared`);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const screen = await renderScreenFromLog(status.logPath, status.cols, status.rows);
    if (!screen.join('\n').includes(text)) return;
    if (Date.now() >= deadline) {
      throw new Error(`production TUI still showed ${text}\n${screen.map((line) => `│${line}`).join('\n')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** Esc is the ordinary "give another instruction" gesture, not a test hook. */
export async function dismissModeChooser(name: string): Promise<void> {
  await requireScreen(name, MODE_CHOOSER, BOOT_TIMEOUT_MS);
  sendKeys(name, ['Esc']);
  await requireScreenWithout(name, MODE_CHOOSER, QUIT_TIMEOUT_MS);
}

/**
 * The other half of the orientation juncture: commit the highlighted style
 * rather than dismissing the menu. Same component whether the menu was raised
 * at boot or by `/brunch:consult`, so one helper serves both.
 */
export async function commitModeChoice(name: string): Promise<void> {
  await requireScreen(name, MODE_CHOOSER, BOOT_TIMEOUT_MS);
  sendKeys(name, ['Enter']);
  await requireScreenWithout(name, MODE_CHOOSER, QUIT_TIMEOUT_MS);
}

/**
 * Type one instruction into the real Pi editor and submit it only once the
 * editor has echoed it back. Submitting blind would let a modal that is still
 * capturing keys swallow the text and turn a missing turn into a timeout
 * somewhere later.
 */
export async function typeAndSubmit(name: string, text: string, timeoutMs: number): Promise<void> {
  sendText(name, text);
  if (!(await waitForScreen(name, text, timeoutMs)).matched) {
    throw new Error(`production Pi editor never echoed ${text}`);
  }
  sendKeys(name, ['Enter']);
}

/** Normal Ctrl-D quit, bounded. Resolves to whether the PTY was still alive. */
export async function quitAndAwaitExit(name: string, timeoutMs = QUIT_TIMEOUT_MS): Promise<boolean> {
  sendKeys(name, ['C-d']);
  const status = sessionStatus(name);
  if (!status) throw new Error(`tui-driver session ${name} disappeared`);
  const deadline = Date.now() + timeoutMs;
  while (isSessionAlive(status.dir) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return isSessionAlive(status.dir);
}

/**
 * The per-target writer lock is a directory holding `owner.json` (I64-L). The
 * raw record is returned rather than a parsed shape, so a contention witness can
 * compare it byte-for-byte and prove the incumbent's lock was neither stolen nor
 * re-acquired.
 */
export async function readSessionWriterOwnerRecord(
  cwd: string,
  target: SessionTarget,
): Promise<string | undefined> {
  try {
    return await readFile(join(sessionWriterLockPath(cwd, target), 'owner.json'), 'utf8');
  } catch {
    return undefined;
  }
}

export async function sessionWriterLockExists(cwd: string, target: SessionTarget): Promise<boolean> {
  return (await readSessionWriterOwnerRecord(cwd, target)) !== undefined;
}
