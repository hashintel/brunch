import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { projectWorkspaceState } from '../projections/workspace/workspace-state.js';
import { createRpcHandlers, runJsonRpcLineServer } from '../rpc/handlers.js';
import { createProductUpdatePublisher } from '../rpc/product-updates.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from '../session/workspace-session-coordinator.js';
import { formatBrunchLoginUsage, runBrunchLogin } from './brunch-login.js';
import { runBrunchTui } from './brunch-tui.js';
import { renderWorkspaceState } from './print-workspace-state.js';

export interface BrunchCliOptions {
  argv?: string[];
  cwd?: string;
  coordinator?: WorkspaceSessionCoordinator;
  stdin?: Readable;
  stdout?: Writable | ((chunk: string) => void);
  stderr?: Writable | ((chunk: string) => void);
  developerTools?: boolean;
  debugMirror?: boolean;
  launchTui?: typeof runBrunchTui;
}

export async function runBrunchCli(options: BrunchCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const {
    command,
    help,
    cwd: cwdFlag,
    mode,
    openWeb,
    developerTools: developerToolsFlag,
  } = parseCliArgs(argv);

  if (command === 'login') {
    if (help) {
      writeStdout(options.stdout, formatBrunchLoginUsage());
      return 0;
    }
    return runBrunchLogin({ stdin: options.stdin, stdout: options.stdout, stderr: options.stderr });
  }
  if (command) throw new Error(`Unknown Brunch command: ${command}`);

  const cwd = cwdFlag ?? options.cwd ?? process.cwd();
  const developerTools = developerToolsFlag ?? options.developerTools ?? false;
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
      openWeb,
      developerTools,
      ...(options.debugMirror === undefined ? {} : { debugMirror: options.debugMirror }),
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

function parseCliArgs(argv: string[]): {
  command: string | undefined;
  help: boolean;
  cwd: string | undefined;
  mode: string;
  openWeb: boolean;
  developerTools: boolean | undefined;
} {
  // node:util parseArgs accepts both `--flag value` and `--flag=value` forms and
  // fails loud on unknown or malformed flags. --open-web is a plain boolean whose
  // default is false, so there is no `=false` form to model: omit it to opt out.
  // --dev-tools is optional so programmatic callers can supply the fallback.
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      cwd: { type: 'string' },
      mode: { type: 'string', default: 'tui' },
      'open-web': { type: 'boolean', default: false },
      'dev-tools': { type: 'boolean' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  return {
    command: positionals[0],
    help: values.help,
    cwd: resolveCwdFlag(values.cwd),
    mode: values.mode,
    openWeb: values['open-web'],
    developerTools: values['dev-tools'],
  };
}

function resolveCwdFlag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === '') throw new Error('--cwd requires a value');
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
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
