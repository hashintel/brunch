import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  TUI_DRIVER_KEYS,
  isTuiDriverKey,
  listSessions,
  removeSession,
  renderScreenFromLog,
  sendKeys,
  sendText,
  sessionStatus,
  startSession,
  stopSession,
  waitForScreenText,
} from '../tui-driver.js';
import { encodeControlLine } from '../tui-driver/keys.js';

describe('tui-driver control protocol', () => {
  it('encodes key and text control lines', () => {
    expect(encodeControlLine({ type: 'key', key: 'Enter' })).toBe('key:Enter');
    expect(encodeControlLine({ type: 'text', text: 'hello world' })).toBe('type:hello world');
  });

  it('rejects newline-bearing text (the fifo protocol is line-delimited)', () => {
    expect(() => encodeControlLine({ type: 'text', text: 'a\nb' })).toThrow(/newline/);
  });

  it('validates key names against the driver.exp table', () => {
    for (const key of TUI_DRIVER_KEYS) expect(isTuiDriverKey(key)).toBe(true);
    expect(isTuiDriverKey('Meta-x')).toBe(false);
  });
});

describe('tui-driver screen rendering', () => {
  it('renders cursor-addressed output as screen state, not stream order', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tui-screen-'));
    const logPath = join(dir, 'output.log');
    // Write "SECOND" on row 2, then jump back to row 1 and write "FIRST":
    // a stream tail would show FIRST last; the screen shows both in place.
    writeFileSync(logPath, '\x1b[2;1HSECOND\x1b[1;1HFIRST');

    const screen = await renderScreenFromLog(logPath, 40, 10);

    expect(screen[0]).toBe('FIRST');
    expect(screen[1]).toBe('SECOND');
  });

  it('waitForScreenText reports the last screen on timeout', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tui-screen-'));
    const logPath = join(dir, 'output.log');
    writeFileSync(logPath, 'something else');

    const result = await waitForScreenText(logPath, 40, 10, 'never-appears', {
      timeoutMs: 300,
      pollMs: 50,
    });

    expect(result.matched).toBe(false);
    expect(result.screen[0]).toContain('something else');
  });
});

const hasExpect = spawnSync('which', ['expect']).status === 0;
const hasMkfifo = spawnSync('which', ['mkfifo']).status === 0;

describe.skipIf(!hasExpect || !hasMkfifo)(
  'tui-driver PTY session (integration)',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'tui-driver-root-'));
    process.env['BRUNCH_TUI_DRIVER_ROOT'] = root;
    const name = 'itest';

    afterEach(async () => {
      await stopSession(name).catch(() => {});
      try {
        removeSession(name, { force: true });
      } catch {
        // session dir may not exist when a test failed before start
      }
    });

    it('starts a PTY session, echoes typed input, and stops on request', async () => {
      const status = await startSession({
        name,
        command: ['zsh', '-c', 'printf "READY\\n"; cat'],
        cols: 60,
        rows: 12,
      });
      expect(status.alive).toBe(true);

      const ready = await waitForScreenText(status.logPath, status.cols, status.rows, 'READY', {
        timeoutMs: 10_000,
      });
      expect(ready.matched).toBe(true);

      sendText(name, 'hello-pty');
      sendKeys(name, ['Enter']);
      const echoed = await waitForScreenText(status.logPath, status.cols, status.rows, 'hello-pty', {
        timeoutMs: 10_000,
      });
      expect(echoed.matched).toBe(true);

      const stopped = await stopSession(name);
      expect(stopped).toBe(true);
      expect(sessionStatus(name)?.alive).toBe(false);
      expect(listSessions().map((session) => session.name)).toContain(name);
    });

    it('send fails fast with a named error when no driver is running', async () => {
      const status = await startSession({
        name,
        command: ['zsh', '-c', 'printf "UP\\n"; cat'],
        cols: 60,
        rows: 12,
      });
      await waitForScreenText(status.logPath, status.cols, status.rows, 'UP', { timeoutMs: 10_000 });
      await stopSession(name);

      expect(() => sendText(name, 'into the void')).toThrow(/no running driver/);
    });
  },
  30_000,
);
