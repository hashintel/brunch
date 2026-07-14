import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

import type { Terminal as XtermTerminalType } from '@xterm/headless';
import xtermHeadless from '@xterm/headless';

// @xterm/headless ships CJS only: under node's real ESM loader (nub) the
// named `Terminal` export does not exist — only the default-imported
// module.exports object does. (vitest's transform papers over this, which is
// why test-only consumers like the VirtualTerminal support module can use the
// named form.)
const { Terminal: XtermTerminal } = xtermHeadless;

/**
 * Screen rendering over the driver's raw PTY log: feed the byte stream into a
 * headless xterm and read the visible viewport — a true screenshot, not a
 * strip-ANSI tail approximation (same substrate as the test-side
 * `VirtualTerminal` in `src/.pi/__tests__/support/virtual-terminal.ts`).
 */

/** Incremental log→terminal feeder so wait loops re-render only appended bytes. */
export class TuiScreen {
  readonly #term: XtermTerminalType;
  readonly #logPath: string;
  #offset = 0;

  constructor(logPath: string, cols: number, rows: number) {
    this.#logPath = logPath;
    this.#term = new XtermTerminal({ cols, rows, allowProposedApi: true });
  }

  /** Feed any bytes appended to the log since the last call; resolves after xterm has parsed them. */
  async ingest(): Promise<void> {
    let fd: number;
    try {
      fd = openSync(this.#logPath, 'r');
    } catch {
      return; // log not created yet — nothing to feed
    }
    try {
      const size = fstatSync(fd).size;
      if (size <= this.#offset) return;
      const chunk = Buffer.alloc(size - this.#offset);
      const read = readSync(fd, chunk, 0, chunk.length, this.#offset);
      this.#offset += read;
      const data = new Uint8Array(chunk.buffer, chunk.byteOffset, read);
      await new Promise<void>((resolve) => this.#term.write(data, resolve));
    } finally {
      closeSync(fd);
    }
  }

  /** Visible viewport lines, trailing whitespace stripped, trailing blank lines dropped. */
  // ceiling: near-duplicate of VirtualTerminal.getViewport()
  // (src/.pi/__tests__/support/virtual-terminal.ts) — extract a shared
  // headless-xterm viewport reader when a third consumer appears.
  viewport(): string[] {
    const buffer = this.#term.buffer.active;
    const lines: string[] = [];
    for (let y = buffer.viewportY; y < buffer.viewportY + this.#term.rows; y += 1) {
      lines.push(buffer.getLine(y)?.translateToString(true) ?? '');
    }
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
    return lines;
  }
}

/** One-shot render of the current screen from a session's full log. */
export async function renderScreenFromLog(logPath: string, cols: number, rows: number): Promise<string[]> {
  const screen = new TuiScreen(logPath, cols, rows);
  await screen.ingest();
  return screen.viewport();
}

export interface WaitForScreenTextOptions {
  readonly timeoutMs?: number;
  readonly pollMs?: number;
}

export interface WaitForScreenTextResult {
  readonly matched: boolean;
  readonly screen: string[];
}

/**
 * Poll the rendered screen until `pattern` appears in the viewport (substring
 * for strings, `test` for RegExp). Returns the matching screen, or — on
 * timeout — `matched: false` with the last rendered screen so callers can
 * show what the terminal actually displayed.
 */
export async function waitForScreenText(
  logPath: string,
  cols: number,
  rows: number,
  pattern: string | RegExp,
  options: WaitForScreenTextOptions = {},
): Promise<WaitForScreenTextResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollMs = options.pollMs ?? 300;
  const screen = new TuiScreen(logPath, cols, rows);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    await screen.ingest();
    const lines = screen.viewport();
    const haystack = lines.join('\n');
    const matched = typeof pattern === 'string' ? haystack.includes(pattern) : pattern.test(haystack);
    if (matched) return { matched: true, screen: lines };
    if (Date.now() >= deadline) return { matched: false, screen: lines };
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
