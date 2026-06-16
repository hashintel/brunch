// App runtime probe (FE-875): build/boot the host app from the cook worktree and
// exercise one feature endpoint over the wire, returning a structured, read-only
// verdict the cook agent cannot self-report. This is the *app-execution* analogue
// of `test-runner.ts`'s test execution — the reachability mechanism behind
// `integration-oracle`.
//
// Boundary (anti-overengineering): the value is the deterministic, unshortcuttable
// *check* of the result — not the boot action. The boot argv + URLs are inputs
// (`ProbeSpec`), so the boot mechanics may lean on the agent's `bash` rather than a
// bespoke per-stack boot engine. The same discipline keeps `evaluate-done`
// read-only (`pi-actions.ts`).

import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';

import type { ProbeResult, ProbeSpec, ProbeTarget } from './types.js';

const READY_TIMEOUT_MS = 10_000;
const READY_POLL_MS = 150;
const READY_ATTEMPT_MS = 2_000;
const REQUEST_TIMEOUT_MS = 5_000;
const TEARDOWN_GRACE_MS = 2_000;
const DEFAULT_HOST = '127.0.0.1';

/**
 * Per-call timeouts so the probe can never hang on a server that accepts a
 * connection but never responds. Overridable (tests use small values); each
 * defaults to the module constant.
 */
export type ProbeTimeouts = {
  /** Overall deadline for the app to become ready (default READY_TIMEOUT_MS). */
  readyTimeoutMs?: number;
  /** Timeout for a single readiness poll (default READY_ATTEMPT_MS). */
  readyAttemptMs?: number;
  /** Timeout for the feature-probe request (default REQUEST_TIMEOUT_MS). */
  requestTimeoutMs?: number;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolve a `ProbeTarget` (boot argv + paths) into a runnable `ProbeSpec` by
 * picking a port and assembling the ready/feature URLs. URL/env assembly is the
 * harness-owned piece: the boot argv + paths come from cook-time grounding, but
 * the port must not be hardcoded — under parallel cook each slice boots its own
 * app and a fixed port would collide. The allocated `PORT` is exposed to the
 * boot process via env (the near-universal convention); caller env is layered
 * first so `PORT` always wins. Always loopback — non-loopback bind-host
 * semantics aren't owned here and aren't needed for the reachability check.
 */
export async function buildProbeSpec(target: ProbeTarget): Promise<ProbeSpec> {
  const port = await allocatePort();
  const base = `http://${DEFAULT_HOST}:${port}`;
  return {
    boot: target.boot,
    readyUrl: `${base}${target.readyPath}`,
    featureUrl: `${base}${target.featurePath}`,
    env: { ...target.env, PORT: String(port) },
  };
}

/**
 * Best-effort free ephemeral port. Bind :0, read the assigned port, release it.
 * There is an inherent release-then-claim window (TOCTOU): another process could
 * grab the port before the boot child binds it. On loopback with OS-assigned
 * ephemeral ports this is rare and acceptable for this harness — if it ever
 * causes real flake, the booted app's actual bound port becomes the source of
 * truth (a later frontier), not a retry loop here.
 */
function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, DEFAULT_HOST, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Boot the app, wait until it accepts connections, probe the feature endpoint,
 * classify the outcome, and always tear the boot process down. The feature is
 * `reachable` when it answers < 400 (wired into the running app), `not-reachable`
 * when the app is up but the endpoint is absent/erroring (the orphan), and
 * `infra` when the app never came up or the probe request itself failed.
 */
export async function runProbe(
  spec: ProbeSpec,
  sandboxDir: string,
  timeouts: ProbeTimeouts = {},
): Promise<ProbeResult> {
  const readyTimeoutMs = timeouts.readyTimeoutMs ?? READY_TIMEOUT_MS;
  const readyAttemptMs = timeouts.readyAttemptMs ?? READY_ATTEMPT_MS;
  const requestTimeoutMs = timeouts.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const [command, ...args] = spec.boot;
  const child = spawn(command!, args, {
    cwd: sandboxDir,
    env: { ...process.env, ...spec.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const chunks: string[] = [];
  child.stdout?.on('data', (c: Buffer) => chunks.push(c.toString('utf8')));
  child.stderr?.on('data', (c: Buffer) => chunks.push(c.toString('utf8')));
  // A spawn error (ENOENT) means the binary never started — bail immediately
  // rather than polling for the full readiness timeout.
  let bootError = '';
  let spawnFailed = false;
  child.on('error', (err) => {
    spawnFailed = true;
    bootError = String(err);
  });
  const output = (): string => [bootError, chunks.join('')].filter(Boolean).join('\n');

  try {
    const ready = await waitForReady(
      spec.readyUrl,
      () => hasExited(child) || bootError !== '',
      readyTimeoutMs,
      readyAttemptMs,
    );
    if (!ready) {
      const why =
        bootError !== ''
          ? 'boot process failed to start'
          : hasExited(child)
            ? 'boot process exited before becoming ready'
            : 'boot did not become ready within timeout';
      return { kind: 'infra', reachable: false, output: `${why}\n${output()}` };
    }

    let status: number;
    try {
      status = (await fetch(spec.featureUrl, { signal: AbortSignal.timeout(requestTimeoutMs) })).status;
    } catch (err) {
      return {
        kind: 'infra',
        reachable: false,
        output: `feature probe request failed: ${String(err)}\n${output()}`,
      };
    }

    if (status < 400) return { kind: 'reachable', reachable: true, status, output: output() };
    // Booted but the endpoint is absent (404) or erroring — the feature is not
    // wired into the running app. `status` is carried so callers see the detail.
    return { kind: 'not-reachable', reachable: false, status, output: output() };
  } finally {
    await teardown(child, () => spawnFailed);
  }
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * Poll until the app answers any HTTP response, boot gives up, or we time out.
 * Each poll carries its own `attemptMs` timeout (`AbortSignal.timeout`) so a
 * connection that is accepted but never answered aborts the attempt instead of
 * blocking forever — otherwise the wall-clock `deadline` (only checked between
 * attempts) would never be reached.
 */
async function waitForReady(
  url: string,
  bootGaveUp: () => boolean,
  timeoutMs: number,
  attemptMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (bootGaveUp()) return false;
    const remainingMs = deadline - Date.now();
    try {
      // Any HTTP response (even 404) means the server is accepting connections.
      await fetch(url, { signal: AbortSignal.timeout(Math.min(attemptMs, remainingMs)) });
      return true;
    } catch {
      await delay(Math.min(READY_POLL_MS, Math.max(0, deadline - Date.now())));
    }
  }
  return false;
}

/** SIGTERM, then SIGKILL if it doesn't exit — never leave an orphaned boot. */
async function teardown(child: ChildProcess, spawnFailed: () => boolean): Promise<void> {
  if (spawnFailed() || hasExited(child)) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  const died = await Promise.race([exited.then(() => true), delay(TEARDOWN_GRACE_MS).then(() => false)]);
  if (!died) child.kill('SIGKILL');
}
