import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { projectWorkspaceState } from '../projections/workspace/workspace-state.js';
import { renderWorkspaceState } from '../renderers/workspace/workspace-state.js';
import { createRpcHandlers, runJsonRpcLineServer } from '../rpc/handlers.js';
import { createProductUpdatePublisher } from '../rpc/product-updates.js';
import { startWebHost } from '../rpc/web-host.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from '../session/workspace-session-coordinator.js';
import { isBrunchDevEnabled } from './brunch-dev.js';
import { runBrunchTui } from './brunch-tui.js';

export interface WebHostRunnerOptions {
  cwd: string;
  coordinator: WorkspaceSessionCoordinator;
}

export interface BrunchCliOptions {
  argv?: string[];
  cwd?: string;
  coordinator?: WorkspaceSessionCoordinator;
  stdin?: Readable;
  stdout?: Writable | ((chunk: string) => void);
  webHostRunner?: (options: WebHostRunnerOptions) => Promise<void>;
  launchTui?: typeof runBrunchTui;
}

export async function runBrunchCli(options: BrunchCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const cwd = parseCwd(argv) ?? options.cwd ?? process.cwd();
  const mode = parseMode(argv);
  const coordinator = options.coordinator ?? createWorkspaceSessionCoordinator({ cwd });

  if (mode === 'print') {
    const state = await coordinator.openDefaultWorkspace();
    const workspaceState = projectWorkspaceState(state);
    writeStdout(options.stdout, renderWorkspaceState(workspaceState));
    return 0;
  }

  if (mode === 'rpc') {
    const productUpdates = createProductUpdatePublisher();
    await runJsonRpcLineServer({
      input: options.stdin ?? process.stdin,
      output: stdoutStream(options.stdout),
      handlers: createRpcHandlers({
        coordinator,
        cwd,
        productUpdates,
        devRpc: isBrunchDevEnabled(),
      }),
      productUpdates,
    });
    return 0;
  }

  if (mode === 'web') {
    await (options.webHostRunner ?? runDefaultWebHost)({ cwd, coordinator });
    return 0;
  }

  if (mode === 'tui') {
    await (options.launchTui ?? runBrunchTui)({
      cwd,
      coordinator,
      autoOpen: parseAutoOpen(argv),
    });
    return 0;
  }

  throw new Error(`Unsupported Brunch mode: ${mode}`);
}

async function runDefaultWebHost(options: WebHostRunnerOptions): Promise<void> {
  const host = await startWebHost({
    cwd: options.cwd,
    coordinator: options.coordinator,
  });
  process.stdout.write(`Brunch web listening on ${host.url}\n`);
  await new Promise<void>(() => {});
}

function writeStdout(stdout: Writable | ((chunk: string) => void) | undefined, chunk: string): void {
  if (!stdout) {
    process.stdout.write(chunk);
  } else if (typeof stdout === 'function') {
    stdout(chunk);
  } else {
    stdout.write(chunk);
  }
}

function stdoutStream(stdout: Writable | ((chunk: string) => void) | undefined): Writable {
  if (!stdout) {
    return process.stdout;
  }
  if (typeof stdout !== 'function') {
    return stdout;
  }
  return {
    write(chunk: string | Uint8Array) {
      stdout(String(chunk));
      return true;
    },
  } as Writable;
}

function parseCwd(argv: string[]): string | undefined {
  const flagIndex = argv.indexOf('--cwd');
  if (flagIndex >= 0) {
    const value = argv[flagIndex + 1];
    if (!value) throw new Error('--cwd requires a value');
    return resolveCliCwd(value);
  }

  const cwdEquals = argv.find((arg) => arg.startsWith('--cwd='));
  if (!cwdEquals) return undefined;
  const value = cwdEquals.slice('--cwd='.length);
  if (!value) throw new Error('--cwd requires a value');
  return resolveCliCwd(value);
}

function resolveCliCwd(value: string): string {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function parseMode(argv: string[]): string {
  const modeFlagIndex = argv.indexOf('--mode');
  if (modeFlagIndex >= 0) {
    return argv[modeFlagIndex + 1] ?? 'tui';
  }

  const modeEquals = argv.find((arg) => arg.startsWith('--mode='));
  if (modeEquals) {
    return modeEquals.slice('--mode='.length);
  }

  return 'tui';
}

function parseAutoOpen(argv: string[]): boolean {
  const autoOpenEquals = argv.find((arg) => arg.startsWith('--auto-open='));
  if (!autoOpenEquals) {
    return true;
  }
  return autoOpenEquals.slice('--auto-open='.length) !== 'false';
}

async function main(): Promise<void> {
  process.exitCode = await runBrunchCli();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
