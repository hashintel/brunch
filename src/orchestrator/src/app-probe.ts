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

import type { ProbeResult, ProbeSpec } from './types.js';

const READY_TIMEOUT_MS = 10_000;
const READY_POLL_MS = 150;
const TEARDOWN_GRACE_MS = 2_000;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Boot the app, wait until it accepts connections, probe the feature endpoint,
 * classify the outcome, and always tear the boot process down. The feature is
 * `reachable` when it answers < 400 (wired into the running app), `not-reachable`
 * when the app is up but the endpoint is absent/erroring (the orphan), and
 * `infra` when the app never came up or the probe request itself failed.
 */
export async function runProbe(spec: ProbeSpec, sandboxDir: string): Promise<ProbeResult> {
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
  child.on('error', (err) => (bootError = String(err)));
  const output = (): string => [bootError, chunks.join('')].filter(Boolean).join('\n');

  try {
    const ready = await waitForReady(spec.readyUrl, () => hasExited(child) || bootError !== '');
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
      status = (await fetch(spec.featureUrl)).status;
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
    await teardown(child);
  }
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

/** Poll until the app answers any HTTP response, boot gives up, or we time out. */
async function waitForReady(url: string, bootGaveUp: () => boolean): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (bootGaveUp()) return false;
    try {
      // Any HTTP response (even 404) means the server is accepting connections.
      await fetch(url);
      return true;
    } catch {
      await delay(READY_POLL_MS);
    }
  }
  return false;
}

/** SIGTERM, then SIGKILL if it doesn't exit — never leave an orphaned boot. */
async function teardown(child: ChildProcess): Promise<void> {
  if (hasExited(child)) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  const died = await Promise.race([exited.then(() => true), delay(TEARDOWN_GRACE_MS).then(() => false)]);
  if (!died) child.kill('SIGKILL');
}
