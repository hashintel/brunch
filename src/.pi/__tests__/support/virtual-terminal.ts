import type { Terminal as PiTerminal } from '@earendil-works/pi-tui';
import { Terminal as XtermTerminal } from '@xterm/headless';

/**
 * A headless xterm-backed Terminal for vitest. Lets tests drive a real pi-tui
 * TUI end-to-end and assert on the rendered viewport.
 *
 * The harness deliberately does not try to simulate kitty protocol, cursor
 * position, or progress OSC semantics; it records writes and exposes the
 * visible buffer so tests can assert on semantic text substrings.
 */
export class VirtualTerminal implements PiTerminal {
  readonly #term: XtermTerminal;
  #onInput?: (data: string) => void;
  #stopped = false;
  #pendingWrites = 0;
  #writeActivityVersion = 0;
  #writes: string[] = [];

  constructor(cols = 100, rows = 32) {
    this.#term = new XtermTerminal({ cols, rows, allowProposedApi: true });
  }

  get columns(): number {
    return this.#term.cols;
  }

  get rows(): number {
    return this.#term.rows;
  }

  get kittyProtocolActive(): boolean {
    return false;
  }

  get writes(): readonly string[] {
    return this.#writes;
  }

  start(onInput: (data: string) => void, _onResize: () => void): void {
    this.#onInput = onInput;
  }

  stop(): void {
    if (this.#stopped) return;
    this.#stopped = true;
    this.#onInput = undefined;
    this.#term.dispose();
  }

  drainInput(): Promise<void> {
    return Promise.resolve();
  }

  write(data: string): void {
    if (this.#stopped) return;
    this.#writes.push(data);
    this.#pendingWrites += 1;
    this.#writeActivityVersion += 1;
    this.#term.write(data, () => {
      this.#pendingWrites -= 1;
      this.#writeActivityVersion += 1;
    });
  }

  moveBy(lines: number): void {
    if (lines > 0) {
      this.write(`\x1b[${lines}B`);
    } else if (lines < 0) {
      this.write(`\x1b[${-lines}A`);
    }
  }

  hideCursor(): void {
    this.write('\x1b[?25l');
  }

  showCursor(): void {
    this.write('\x1b[?25h');
  }

  clearLine(): void {
    this.write('\x1b[K');
  }

  clearFromCursor(): void {
    this.write('\x1b[J');
  }

  clearScreen(): void {
    this.write('\x1b[2J\x1b[H');
  }

  setTitle(_title: string): void {
    // OSC window title: not material to viewport assertions.
  }

  setProgress(_active: boolean): void {
    // OSC 9;4 progress: not material to viewport assertions.
  }

  /** Send input to the TUI's input handler. */
  sendInput(data: string): void {
    this.#onInput?.(data);
  }

  /**
   * Wait for scheduled TUI renders to enqueue writes, then resolve only after
   * xterm has reported no write activity for a full idle window.
   */
  async waitForRender(timeoutMs = 3000): Promise<void> {
    const idleWindowMs = 50;
    const deadline = Date.now() + timeoutMs;
    let idleSince = Date.now();

    while (Date.now() < deadline) {
      if (this.#pendingWrites > 0) {
        await this.#sleepUntil(deadline, 5);
        idleSince = Date.now();
        continue;
      }

      const idleForMs = Date.now() - idleSince;
      if (idleForMs >= idleWindowMs) return;

      const versionBeforeIdleWait = this.#writeActivityVersion;
      await this.#sleepUntil(deadline, idleWindowMs - idleForMs);
      if (this.#writeActivityVersion !== versionBeforeIdleWait) {
        idleSince = Date.now();
      }
    }

    throw new Error(`waitForRender timed out after ${timeoutMs}ms`);
  }

  #sleepUntil(deadline: number, requestedMs: number): Promise<void> {
    const remainingMs = deadline - Date.now();
    return new Promise((resolve) => setTimeout(resolve, Math.min(requestedMs, Math.max(0, remainingMs))));
  }

  /** Return the visible viewport lines, stripped of trailing whitespace. */
  // ceiling: near-duplicate of TuiScreen.viewport()
  // (src/dev/tui-driver/screen.ts) — extract a shared headless-xterm
  // viewport reader when a third consumer appears.
  getViewport(): string[] {
    const lines: string[] = [];
    const buffer = this.#term.buffer.active;
    const start = buffer.viewportY;
    for (let y = start; y < start + this.#term.rows; y += 1) {
      const line = buffer.getLine(y);
      lines.push(line?.translateToString(true) ?? '');
    }
    return lines;
  }
}
