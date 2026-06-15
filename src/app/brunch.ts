import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { projectWorkspaceState } from '../projections/workspace/workspace-state.js';
import { renderWorkspaceState } from '../renderers/workspace/workspace-state.js';
import { createRpcHandlers, runJsonRpcLineServer } from '../rpc/handlers.js';
import { createProductUpdatePublisher } from '../rpc/product-updates.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from '../session/workspace-session-coordinator.js';
import { isBrunchDevEnabled } from './brunch-dev.js';
import { runBrunchTui } from './brunch-tui.js';

export interface BrunchCliOptions {
  argv?: string[];
  cwd?: string;
  coordinator?: WorkspaceSessionCoordinator;
  stdin?: Readable;
  stdout?: Writable | ((chunk: string) => void);
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
    // Standalone web mode is deferred: the web UI is useless without the TUI
    // driving it, so the browser client is served only as the TUI sidecar
    // (see runBrunchTui). A dedicated headless web host is a future feature.
    throw new Error(
      'Brunch web mode is not available yet. The web UI is served as a sidecar when you launch the TUI — run `brunch` (or `brunch --mode tui`) instead.',
    );
  }

  if (mode === 'tui') {
    await (options.launchTui ?? runBrunchTui)({
      cwd,
      coordinator,
      openWeb: parseOpenWeb(argv),
    });
    return 0;
  }

  throw new Error(`Unsupported Brunch mode: ${mode}`);
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

function parseOpenWeb(argv: string[]): boolean {
  if (argv.includes('--open-web')) return true;
  const openWebEquals = argv.find((arg) => arg.startsWith('--open-web='));
  if (!openWebEquals) return false;
  return openWebEquals.slice('--open-web='.length) !== 'false';
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
