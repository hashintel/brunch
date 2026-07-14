import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeControlLine, isTuiDriverKey, type TuiDriverKey } from './keys.js';

/**
 * Session store for the tui-driver PTY harness. One directory per named
 * session under the gitignored dev-loop scratch root, holding the control
 * fifo, the raw PTY log, liveness markers, and the session metadata that the
 * screen renderer needs (cols/rows).
 */

export interface TuiDriverSessionMeta {
  readonly name: string;
  readonly command: readonly string[];
  readonly cols: number;
  readonly rows: number;
  readonly startedAt: string;
  readonly driverPid: number;
}

export interface TuiDriverSessionStatus extends TuiDriverSessionMeta {
  readonly alive: boolean;
  readonly dir: string;
  readonly logPath: string;
}

const DEFAULT_ROOT = '.fixtures/scratch/tui-driver';
const HEARTBEAT_FRESH_MS = 3_000;
const SESSION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Root override for tests; the default keeps sessions in the sanctioned dev-loop scratch tree. */
export function tuiDriverRoot(): string {
  return resolve(process.env['BRUNCH_TUI_DRIVER_ROOT'] ?? DEFAULT_ROOT);
}

export function sessionDir(name: string): string {
  if (!SESSION_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid session name "${name}" (expected ${SESSION_NAME_PATTERN})`);
  }
  return join(tuiDriverRoot(), name);
}

function metaPath(dir: string): string {
  return join(dir, 'meta.json');
}

function readMeta(dir: string): TuiDriverSessionMeta | undefined {
  try {
    return JSON.parse(readFileSync(metaPath(dir), 'utf8')) as TuiDriverSessionMeta;
  } catch {
    return undefined;
  }
}

/**
 * Liveness = fresh heartbeat and no exited marker. The pump touches the
 * heartbeat every ~1s; mtime is sandbox-proof where signal probes and `ps`
 * are not.
 */
export function isSessionAlive(dir: string): boolean {
  if (existsSync(join(dir, 'exited'))) return false;
  try {
    return Date.now() - statSync(join(dir, 'heartbeat')).mtimeMs < HEARTBEAT_FRESH_MS;
  } catch {
    return false;
  }
}

export function sessionStatus(name: string): TuiDriverSessionStatus | undefined {
  const dir = sessionDir(name);
  const meta = readMeta(dir);
  if (!meta) return undefined;
  return { ...meta, alive: isSessionAlive(dir), dir, logPath: join(dir, 'output.log') };
}

export function listSessions(): TuiDriverSessionStatus[] {
  const root = tuiDriverRoot();
  let names: string[];
  try {
    names = readdirSync(root);
  } catch {
    return [];
  }
  return names
    .map((name) => sessionStatus(name))
    .filter((status): status is TuiDriverSessionStatus => status !== undefined);
}

export interface StartSessionOptions {
  readonly name: string;
  readonly command: readonly string[];
  readonly cols?: number;
  readonly rows?: number;
  /** Working directory for the spawned command; defaults to the caller's cwd. */
  readonly cwd?: string;
}

export async function startSession(options: StartSessionOptions): Promise<TuiDriverSessionStatus> {
  if (options.command.length === 0) throw new Error('start requires a command after --');
  const dir = sessionDir(options.name);
  if (isSessionAlive(dir)) {
    throw new Error(`Session "${options.name}" is already running; stop it or pick another name.`);
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const fifoPath = join(dir, 'control.fifo');
  const mkfifo = spawnSync('mkfifo', [fifoPath]);
  if (mkfifo.status !== 0) {
    throw new Error(`mkfifo failed: ${mkfifo.stderr?.toString() ?? 'unknown error'}`);
  }

  const cols = options.cols ?? 120;
  const rows = options.rows ?? 40;
  const driverScript = fileURLToPath(new URL('./driver.exp', import.meta.url));
  const errFd = openSync(join(dir, 'driver.err'), 'a');
  let child;
  try {
    child = spawn('expect', [driverScript, dir, String(cols), String(rows), ...options.command], {
      detached: true,
      stdio: ['ignore', errFd, errFd],
      ...(options.cwd ? { cwd: options.cwd } : {}),
    });
    child.unref();
  } finally {
    closeSync(errFd);
  }

  const meta: TuiDriverSessionMeta = {
    name: options.name,
    command: options.command,
    cols,
    rows,
    startedAt: new Date().toISOString(),
    driverPid: child.pid ?? -1,
  };
  writeFileSync(metaPath(dir), `${JSON.stringify(meta, null, 2)}\n`);

  const started = await waitFor(() => existsSync(join(dir, 'heartbeat')), 5_000, 100);
  if (!started) {
    const err = safeRead(join(dir, 'driver.err'));
    throw new Error(`Driver did not start within 5s.${err ? `\ndriver.err:\n${err}` : ''}`);
  }
  return sessionStatus(options.name)!;
}

/**
 * Guarded control write: O_NONBLOCK open fails with ENXIO when no pump is
 * reading the fifo, turning the ad-hoc harness's silent forever-block into an
 * immediate, named error.
 */
export function sendControlLines(name: string, lines: readonly string[]): void {
  const dir = sessionDir(name);
  let fd: number;
  try {
    fd = openSync(join(dir, 'control.fifo'), fsConstants.O_WRONLY | fsConstants.O_NONBLOCK);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENXIO' || code === 'ENOENT') {
      throw new Error(`Session "${name}" has no running driver (${code}); is it stopped?`);
    }
    throw error;
  }
  try {
    writeSync(fd, `${lines.join('\n')}\n`);
  } finally {
    closeSync(fd);
  }
}

export function sendKeys(name: string, keys: readonly string[]): void {
  const lines = keys.map((key) => {
    if (!isTuiDriverKey(key)) throw new Error(`Unknown key "${key}"`);
    return encodeControlLine({ type: 'key', key: key as TuiDriverKey });
  });
  sendControlLines(name, lines);
}

export function sendText(name: string, text: string): void {
  sendControlLines(name, [encodeControlLine({ type: 'text', text })]);
}

/** Ask the pump to close the PTY and exit; resolves once the exited marker lands (or the driver is already gone). */
export async function stopSession(name: string, timeoutMs = 5_000): Promise<boolean> {
  const dir = sessionDir(name);
  try {
    sendControlLines(name, ['quit']);
  } catch {
    return !isSessionAlive(dir);
  }
  return waitFor(() => existsSync(join(dir, 'exited')), timeoutMs, 100);
}

/** Delete a session directory. Refuses a live session unless forced. */
export function removeSession(name: string, options: { force?: boolean } = {}): void {
  const dir = sessionDir(name);
  if (!options.force && isSessionAlive(dir)) {
    throw new Error(`Session "${name}" is still running; stop it first or pass --force.`);
  }
  rmSync(dir, { recursive: true, force: true });
}

async function waitFor(check: () => boolean, timeoutMs: number, pollMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (check()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}
