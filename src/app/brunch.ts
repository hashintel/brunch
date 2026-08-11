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
import { runBrunchTui } from './brunch-tui.js';
import { runBrunchWeb, type BrunchWebOptions } from './brunch-web.js';
import { renderWorkspaceState } from './print-workspace-state.js';

export interface BrunchCliOptions {
  argv?: string[];
  cwd?: string;
  coordinator?: WorkspaceSessionCoordinator;
  stdin?: Readable;
  stdout?: Writable | ((chunk: string) => void);
  stderr?: Writable | ((chunk: string) => void);
  debugMirror?: boolean;
  /** Programmatic dev/eval-only intervention; never parsed from product CLI argv. */
  evaluationDirectiveAblation?: 'warrant-before-commit';
  /** Production entrypoints await signal-driven standalone-web host cleanup. */
  awaitWebTermination?: boolean;
  launchTui?: typeof runBrunchTui;
  launchWeb?: (
    options: Omit<BrunchWebOptions, 'createRuntime'>,
  ) => Promise<Awaited<ReturnType<typeof runBrunchWeb>>>;
}

export async function runBrunchCli(options: BrunchCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const { command, help, cwd: cwdFlag, mode, openWeb, noWebui } = parseCliArgs(argv);

  if (command) throw new Error(`Unknown Brunch command: ${command}`);

  if (help) {
    writeStdout(options.stdout, formatBrunchUsage());
    return 0;
  }

  // TUI-only flags are accepted by the shared parser; warn instead of silently
  // ignoring them when the selected mode cannot honor them.
  if (mode !== 'tui') {
    if (noWebui) writeStderr(options.stderr, `--no-webui only applies to --mode tui; ignoring.`);
  }

  const cwd = cwdFlag ?? options.cwd ?? process.cwd();
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
    const host = await (options.launchWeb ?? runBrunchWeb)({ cwd, coordinator });
    writeStdout(options.stdout, `Brunch web running at ${host.url}\n`);
    if (options.awaitWebTermination) {
      const signal = await closeWebHostOnTermination(host);
      process.kill(process.pid, signal);
      return gracefulTerminationExitCode[signal];
    }
    return 0;
  }

  if (mode === 'tui') {
    await (options.launchTui ?? runBrunchTui)({
      cwd,
      coordinator,
      openWeb,
      ...(options.debugMirror === undefined ? {} : { debugMirror: options.debugMirror }),
      ...(options.evaluationDirectiveAblation
        ? { evaluationDirectiveAblation: options.evaluationDirectiveAblation }
        : {}),
    });
    return 0;
  }

  throw new Error(`Unsupported Brunch mode: ${mode}`);
}

export function formatBrunchUsage(): string {
  return [
    'Usage: brunch [command] [options]',
    '',
    'Options:',
    '  --cwd <path>         Workspace directory (default: current directory)',
    '  --mode <mode>        tui (default) | web | print | rpc',
    '  --no-webui           Do not open the web sidecar in a browser (tui mode only)',
    '  -h, --help           Show this usage',
    '',
  ].join('\n');
}

function writeStderr(stderr: Writable | ((chunk: string) => void) | undefined, line: string): void {
  const chunk = `${line}\n`;
  if (!stderr) {
    process.stderr.write(chunk);
  } else if (typeof stderr === 'function') {
    stderr(chunk);
  } else {
    stderr.write(chunk);
  }
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
  noWebui: boolean;
} {
  // node:util parseArgs accepts both `--flag value` and `--flag=value` forms and
  // fails loud on unknown or malformed flags. --no-webui is a plain boolean whose
  // default is false, so there is no `=false` form to model: omit it for the default.
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      cwd: { type: 'string' },
      mode: { type: 'string', default: 'tui' },
      'no-webui': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (positionals.length > 1) {
    throw new Error(`Unexpected Brunch argument: ${positionals[1]}`);
  }
  return {
    command: positionals[0],
    help: values.help,
    cwd: resolveCwdFlag(values.cwd),
    mode: values.mode,
    openWeb: !values['no-webui'],
    noWebui: values['no-webui'],
  };
}

function resolveCwdFlag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === '') throw new Error('--cwd requires a value');
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

async function main(): Promise<void> {
  process.exitCode = await runBrunchCli({ awaitWebTermination: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

type GracefulTerminationSignal = 'SIGINT' | 'SIGTERM';

const gracefulTerminationExitCode: Readonly<Record<GracefulTerminationSignal, number>> = {
  SIGINT: 130,
  SIGTERM: 143,
};

async function closeWebHostOnTermination(
  host: Awaited<ReturnType<typeof runBrunchWeb>>,
): Promise<GracefulTerminationSignal> {
  let closePromise: Promise<void> | undefined;
  let requestedSignal: GracefulTerminationSignal | undefined;
  let resolveTermination: ((signal: GracefulTerminationSignal) => void) | undefined;
  let rejectTermination: ((error: unknown) => void) | undefined;
  const termination = new Promise<GracefulTerminationSignal>((resolvePromise, rejectPromise) => {
    resolveTermination = resolvePromise;
    rejectTermination = rejectPromise;
  });
  const requestClose = (signal: GracefulTerminationSignal) => {
    requestedSignal ??= signal;
    closePromise ??= Promise.resolve().then(() => host.close());
    void closePromise.then(
      () => resolveTermination?.(requestedSignal ?? signal),
      (error: unknown) => rejectTermination?.(error),
    );
  };
  const onSigint = () => requestClose('SIGINT');
  const onSigterm = () => requestClose('SIGTERM');

  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);
  try {
    return await termination;
  } finally {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
  }
}
