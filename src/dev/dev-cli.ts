import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  cancel as clackCancel,
  confirm as clackConfirm,
  intro as clackIntro,
  isCancel,
  outro as clackOutro,
  select as clackSelect,
} from '@clack/prompts';

import { runBrunchCli, type BrunchCliOptions } from '../app/brunch.js';
import { exportSeedFixtureFromWorkspace, formatSeedFixture } from '../graph/export-fixtures.js';
import {
  listTrackedSeedRefs,
  parseSeedRef,
  runSeedFixturesCli,
  workbenchPathForSeed,
} from '../graph/seed-fixtures.js';
import { createRpcHandlers } from '../rpc/handlers.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { applyDevGraphMutation, parseDevMutateGraphParams } from './graph-curation.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKBENCHES_ROOT = resolve(REPO_ROOT, '.fixtures', 'workbenches');

type TopLevelCommand = 'launch' | 'rpc' | 'mutate' | 'export' | 'help';
type GraphVisibility = 'all' | 'active';

interface WorkbenchChoice {
  readonly label: string;
  readonly workspace: string;
  readonly seedRefs: readonly string[];
}

interface LaunchPromptPlan {
  readonly workspace: string;
  readonly seed?: string;
  readonly openWeb: boolean;
}

export interface DevCliPrompts {
  intro(title: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  chooseWorkbench(options: readonly WorkbenchChoice[]): Promise<string | symbol>;
  chooseSeed(options: readonly string[], workspaceLabel: string): Promise<string | symbol>;
  confirmSeedReset(seed: string, workspaceLabel: string): Promise<boolean | symbol>;
  confirmOpenWeb(workspaceLabel: string): Promise<boolean | symbol>;
}

export interface DevCliOptions {
  readonly argv?: readonly string[];
  readonly cwd?: string;
  readonly stdin?: Readable;
  readonly stdout?: Writable | ((chunk: string) => void);
  readonly stderr?: Writable | ((chunk: string) => void);
  readonly prompts?: DevCliPrompts;
  readonly launchBrunch?: (options: BrunchCliOptions) => Promise<number>;
  readonly seedWorkspace?: typeof runSeedFixturesCli;
}

interface LaunchFlags {
  readonly workspace: string | undefined;
  readonly seed: string | undefined;
  readonly reset: boolean;
  readonly mode: string;
  readonly openWeb: boolean;
  readonly developerTools: boolean;
  readonly help: boolean;
}

interface RpcFlags {
  readonly workspace: string | undefined;
  readonly fullResponse: boolean;
  readonly help: boolean;
  readonly method: string | undefined;
  readonly paramsText: string | undefined;
}

interface MutateFlags {
  readonly workspace: string | undefined;
  readonly help: boolean;
  readonly paramsText: string | undefined;
  readonly paramsFile: string | undefined;
}

interface ExportFlags {
  readonly workspace: string | undefined;
  readonly specId: number | undefined;
  readonly out: string | undefined;
  readonly show: GraphVisibility | undefined;
  readonly help: boolean;
}

class DevCliUsageError extends Error {}

const defaultPrompts: DevCliPrompts = {
  intro: (title) => {
    clackIntro(title);
  },
  outro: (message) => {
    clackOutro(message);
  },
  cancel: (message) => {
    clackCancel(message);
  },
  chooseWorkbench: async (options) =>
    clackSelect({
      message: 'Which seed-derived workbench should Brunch use?',
      options: options.map((option) => ({ value: option.workspace, label: option.label })),
      maxItems: 8,
    }),
  chooseSeed: async (options, workspaceLabel) =>
    clackSelect({
      message: `How should ${workspaceLabel} start?`,
      options: [
        { value: '__current__', label: 'Use the current workbench state' },
        ...options.map((seed) => ({ value: seed, label: `Reset and seed ${seed}` })),
      ],
      maxItems: 10,
    }),
  confirmSeedReset: async (seed, workspaceLabel) =>
    clackConfirm({
      message:
        `Reset ${workspaceLabel}/.brunch/{data.db,data.db-wal,data.db-shm,sessions,debug,workspace.json} ` +
        `and seed ${seed}?`,
      initialValue: true,
    }),
  confirmOpenWeb: async (workspaceLabel) =>
    clackConfirm({
      message: `Open the web observer sidecar too for ${workspaceLabel}?`,
      initialValue: false,
    }),
};

export async function runDevCli(options: DevCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const cwd = options.cwd ?? process.cwd();
  const [command, commandArgs] = splitCommand(argv);
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  try {
    switch (command) {
      case 'help':
        writeStdout(stdout, devCliUsage());
        return 0;
      case 'launch':
        return await runLaunchCommand(commandArgs, { ...options, cwd });
      case 'rpc':
        return await runRpcCommand(commandArgs, { ...options, cwd });
      case 'mutate':
        return await runMutateCommand(commandArgs, { ...options, cwd });
      case 'export':
        return await runExportCommand(commandArgs, { ...options, cwd });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStderr(stderr, `${message}\n\n${devCliUsage()}`);
    return 1;
  }
}

function splitCommand(argv: readonly string[]): readonly [TopLevelCommand, readonly string[]] {
  const [first, ...rest] = argv;
  if (first === undefined) return ['launch', argv];
  if (first === '--help' || first === '-h' || first === 'help') return ['help', rest];
  if (first === 'launch' || first === 'rpc' || first === 'mutate' || first === 'export') {
    return [first, rest];
  }
  return ['launch', argv];
}

async function runLaunchCommand(args: readonly string[], options: DevCliOptions & { readonly cwd: string }) {
  const flags = parseLaunchFlags(args, options.cwd);
  if (flags.help) {
    writeStdout(options.stdout ?? process.stdout, `${devCliUsage()}\n${launchUsage()}`);
    return 0;
  }

  const seedRef = flags.seed ? parseSeedRef(flags.seed) : null;
  if (flags.seed && !seedRef) {
    throw new DevCliUsageError('--seed must be a tracked seed ref in the form <name>/<variant>.');
  }

  const currentWorkbench = currentWorkbenchForCwd(options.cwd);
  const prompts = options.prompts ?? defaultPrompts;
  let workspace = flags.workspace ?? (seedRef ? workbenchPathForSeed(seedRef) : currentWorkbench);
  let seed = flags.seed;
  let openWeb = flags.openWeb;

  if (!workspace) {
    if (flags.mode !== 'tui') {
      throw new DevCliUsageError('A workbench is required for non-interactive launch modes.');
    }
    if (!isInteractiveTerminal(options.stdin, options.stdout)) {
      throw new DevCliUsageError('No workbench was provided and no interactive terminal is available.');
    }
    const plan = await promptForLaunchPlan(prompts);
    if (!plan) return 0;
    workspace = plan.workspace;
    seed = plan.seed;
    openWeb = plan.openWeb;
  }

  if (seed && !flags.reset) {
    throw new DevCliUsageError('Launch-time seeding requires --reset so the workspace state stays explicit.');
  }
  if (!seed && flags.reset) {
    throw new DevCliUsageError('--reset only applies when paired with --seed.');
  }

  if (seed) {
    const code = await (options.seedWorkspace ?? runSeedFixturesCli)({
      argv: ['--workspace', workspace, '--seed', seed, '--reset'],
      cwd: options.cwd,
      stdout: (chunk) => writeStdout(options.stdout ?? process.stdout, chunk),
      stderr: (chunk) => writeStderr(options.stderr ?? process.stderr, chunk),
    });
    if (code !== 0) return code;
  }

  await mkdir(workspace, { recursive: true });

  return await (options.launchBrunch ?? runBrunchCli)({
    argv: [
      '--mode',
      flags.mode,
      ...(openWeb ? ['--open-web'] : []),
      ...(flags.developerTools ? ['--dev-tools'] : []),
    ],
    cwd: workspace,
    ...(options.stdin ? { stdin: options.stdin } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    developerTools: flags.developerTools,
  });
}

async function promptForLaunchPlan(prompts: DevCliPrompts): Promise<LaunchPromptPlan | null> {
  const workbenches = await listTrackedWorkbenches();
  if (workbenches.length === 0) {
    throw new DevCliUsageError('No tracked seeds are available to derive workbenches from.');
  }

  prompts.intro('Brunch dev launcher');
  const workspace =
    workbenches.length === 1 ? workbenches[0]!.workspace : await prompts.chooseWorkbench(workbenches);
  if (isCancel(workspace)) {
    prompts.cancel('Launch cancelled.');
    return null;
  }

  const workspaceLabel = labelForWorkspace(workspace);
  const selectedWorkbench = workbenches.find((choice) => choice.workspace === workspace);
  if (!selectedWorkbench) {
    throw new DevCliUsageError(`Unknown tracked workbench selected: ${workspaceLabel}`);
  }

  const seedChoice = await prompts.chooseSeed(selectedWorkbench.seedRefs, workspaceLabel);
  if (isCancel(seedChoice)) {
    prompts.cancel('Launch cancelled.');
    return null;
  }

  let seed: string | undefined;
  if (seedChoice !== '__current__') {
    const confirmed = await prompts.confirmSeedReset(seedChoice, workspaceLabel);
    if (isCancel(confirmed) || confirmed !== true) {
      prompts.cancel('Launch cancelled.');
      return null;
    }
    seed = seedChoice;
  }

  const openWeb = await prompts.confirmOpenWeb(workspaceLabel);
  if (isCancel(openWeb)) {
    prompts.cancel('Launch cancelled.');
    return null;
  }

  prompts.outro(`Launching ${workspaceLabel}${seed ? ` from ${seed}` : ''}.`);
  return { workspace, ...(seed ? { seed } : {}), openWeb };
}

async function runRpcCommand(args: readonly string[], options: DevCliOptions & { readonly cwd: string }) {
  const flags = parseRpcFlags(args, options.cwd);
  if (flags.help) {
    writeStdout(options.stdout ?? process.stdout, `${devCliUsage()}\n${rpcUsage()}`);
    return 0;
  }
  if (!flags.method) {
    throw new DevCliUsageError('The rpc command requires a method name.');
  }

  const handlers = createRpcHandlers({
    coordinator: createWorkspaceSessionCoordinator({ cwd: flags.workspace ?? options.cwd }),
    cwd: flags.workspace ?? options.cwd,
  });
  const request = {
    jsonrpc: '2.0' as const,
    id: 1,
    method: flags.method,
    ...(flags.paramsText === undefined ? {} : { params: parseJson(flags.paramsText, '--params') }),
  };
  const response = await handlers.handle(request);
  if ('error' in response && response.error != null) {
    printJson(options.stdout ?? process.stdout, flags.fullResponse ? response : response.error);
    return 1;
  }
  printJson(
    options.stdout ?? process.stdout,
    flags.fullResponse ? response : 'result' in response ? response.result : undefined,
  );
  return 0;
}

async function runMutateCommand(args: readonly string[], options: DevCliOptions & { readonly cwd: string }) {
  const flags = parseMutateFlags(args, options.cwd);
  if (flags.help) {
    writeStdout(options.stdout ?? process.stdout, `${devCliUsage()}\n${mutateUsage()}`);
    return 0;
  }

  const paramsText =
    flags.paramsText ??
    (flags.paramsFile
      ? await readFile(resolve(options.cwd, flags.paramsFile), 'utf8')
      : await readOptionalStdin(options.stdin));
  if (!paramsText) {
    throw new DevCliUsageError('The mutate command requires --params, --params-file, or JSON on stdin.');
  }

  const parsedParams = parseDevMutateGraphParams(parseJson(paramsText, 'mutate params'));
  if (!parsedParams) {
    throw new DevCliUsageError(
      'The mutate params payload does not match the supported graph-curation schema.',
    );
  }

  const result = await applyDevGraphMutation(flags.workspace ?? options.cwd, parsedParams);
  printJson(options.stdout ?? process.stdout, result);
  return result.status === 'success' ? 0 : 1;
}

async function runExportCommand(args: readonly string[], options: DevCliOptions & { readonly cwd: string }) {
  const flags = parseExportFlags(args, options.cwd);
  if (flags.help) {
    writeStdout(options.stdout ?? process.stdout, `${devCliUsage()}\n${exportUsage()}`);
    return 0;
  }
  if (!flags.specId) {
    throw new DevCliUsageError('The export command requires --spec-id.');
  }

  const workspace = flags.workspace ?? options.cwd;
  const fixture = exportSeedFixtureFromWorkspace(workspace, {
    specId: flags.specId,
    ...(flags.show ? { show: flags.show } : {}),
  });
  const rendered = formatSeedFixture(fixture);

  if (flags.out) {
    const outPath = resolve(options.cwd, flags.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, rendered, 'utf8');
    writeStdout(options.stdout ?? process.stdout, `wrote ${outPath}\n`);
    return 0;
  }

  writeStdout(options.stdout ?? process.stdout, rendered);
  return 0;
}

function parseLaunchFlags(args: readonly string[], cwd: string): LaunchFlags {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      workspace: { type: 'string', short: 'w' },
      cwd: { type: 'string' },
      seed: { type: 'string' },
      reset: { type: 'boolean', default: false },
      mode: { type: 'string', default: 'tui' },
      'open-web': { type: 'boolean', default: false },
      'dev-tools': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (positionals.length > 0) {
    throw new DevCliUsageError(`Unexpected launch argument: ${positionals[0]}`);
  }
  return {
    workspace: resolveWorkspaceOption(values.workspace, values.cwd, cwd),
    seed: values.seed,
    reset: values.reset,
    mode: values.mode,
    openWeb: values['open-web'],
    developerTools: values['dev-tools'],
    help: values.help,
  };
}

function parseRpcFlags(args: readonly string[], cwd: string): RpcFlags {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      workspace: { type: 'string', short: 'w' },
      cwd: { type: 'string' },
      'full-response': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (positionals.length > 2) {
    throw new DevCliUsageError('The rpc command accepts at most one params JSON argument.');
  }
  return {
    workspace: resolveWorkspaceOption(values.workspace, values.cwd, cwd),
    fullResponse: values['full-response'],
    help: values.help,
    method: positionals[0],
    paramsText: positionals[1],
  };
}

function parseMutateFlags(args: readonly string[], cwd: string): MutateFlags {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      workspace: { type: 'string', short: 'w' },
      cwd: { type: 'string' },
      params: { type: 'string' },
      'params-file': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (positionals.length > 0) {
    throw new DevCliUsageError(`Unexpected mutate argument: ${positionals[0]}`);
  }
  if (values.params && values['params-file']) {
    throw new DevCliUsageError('Use only one of --params or --params-file.');
  }
  return {
    workspace: resolveWorkspaceOption(values.workspace, values.cwd, cwd),
    help: values.help,
    paramsText: values.params,
    paramsFile: values['params-file'],
  };
}

function parseExportFlags(args: readonly string[], cwd: string): ExportFlags {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      workspace: { type: 'string', short: 'w' },
      cwd: { type: 'string' },
      'spec-id': { type: 'string' },
      out: { type: 'string', short: 'o' },
      show: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (positionals.length > 0) {
    throw new DevCliUsageError(`Unexpected export argument: ${positionals[0]}`);
  }
  const show = values.show;
  if (show !== undefined && show !== 'all' && show !== 'active') {
    throw new DevCliUsageError('--show must be all or active.');
  }
  return {
    workspace: resolveWorkspaceOption(values.workspace, values.cwd, cwd),
    specId: values['spec-id'] ? parsePositiveInteger(values['spec-id'], '--spec-id') : undefined,
    out: values.out,
    show,
    help: values.help,
  };
}

function resolveWorkspaceOption(
  workspace: string | undefined,
  cwdFlag: string | undefined,
  cwd: string,
): string | undefined {
  if (workspace && cwdFlag) {
    throw new DevCliUsageError('Use only one of --workspace or --cwd.');
  }
  const value = workspace ?? cwdFlag;
  if (!value) return undefined;
  return isAbsolute(value) ? value : resolve(cwd, value);
}

function parsePositiveInteger(value: string, flag: string): number {
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new DevCliUsageError(`${flag} must be a positive integer.`);
  }
  return Number(value);
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new DevCliUsageError(
      `${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function currentWorkbenchForCwd(cwd: string): string | undefined {
  const resolvedCwd = resolve(cwd);
  const relativePath = relative(WORKBENCHES_ROOT, resolvedCwd);
  if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) return undefined;
  const [workbenchName] = relativePath.split(sep);
  return workbenchName ? resolve(WORKBENCHES_ROOT, workbenchName) : undefined;
}

async function listTrackedWorkbenches(): Promise<readonly WorkbenchChoice[]> {
  const grouped = new Map<string, string[]>();
  for (const seed of await listTrackedSeedRefs()) {
    const workspace = workbenchPathForSeed(seed);
    const seedRefs = grouped.get(workspace) ?? [];
    seedRefs.push(seed.ref);
    grouped.set(workspace, seedRefs);
  }

  return [...grouped.entries()]
    .map(([workspace, seedRefs]) => ({
      workspace,
      label: labelForWorkspace(workspace),
      seedRefs: seedRefs.sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function labelForWorkspace(workspace: string): string {
  const relativePath = relative(REPO_ROOT, workspace);
  return relativePath.startsWith('..') ? workspace : relativePath;
}

function isInteractiveTerminal(
  stdin: Readable | undefined,
  stdout: Writable | ((chunk: string) => void) | undefined,
): boolean {
  const input = stdin ?? process.stdin;
  const output = stdout && typeof stdout !== 'function' ? stdout : process.stdout;
  return (
    readIsTty(input as { readonly isTTY?: boolean }) && readIsTty(output as { readonly isTTY?: boolean })
  );
}

function readIsTty(stream: { readonly isTTY?: boolean }): boolean {
  return stream.isTTY === true;
}

async function readOptionalStdin(stdin: Readable | undefined): Promise<string | undefined> {
  const input = stdin ?? process.stdin;
  if ('isTTY' in input && input.isTTY === true) {
    return undefined;
  }

  let buffer = '';
  for await (const chunk of input) {
    buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  }
  return buffer.trim() || undefined;
}

function writeStdout(stdout: Writable | ((chunk: string) => void), chunk: string): void {
  if (typeof stdout === 'function') {
    stdout(chunk);
    return;
  }
  stdout.write(chunk);
}

function writeStderr(stderr: Writable | ((chunk: string) => void), chunk: string): void {
  if (typeof stderr === 'function') {
    stderr(chunk);
    return;
  }
  stderr.write(chunk);
}

function printJson(stdout: Writable | ((chunk: string) => void), value: unknown): void {
  writeStdout(stdout, `${JSON.stringify(value, null, 2)}\n`);
}

function devCliUsage(): string {
  return [
    'Usage:',
    '  npm run dev',
    '  npm run dev -- --seed <name>/<variant> --reset [--open-web] [--dev-tools]',
    '  npm run dev -- --workspace <dir> [--mode tui|print|rpc] [--open-web] [--dev-tools]',
    '  npm run dev -- --workspace <dir> --seed <name/variant> --reset [--open-web] [--dev-tools]',
    '  npm run dev -- rpc <method> [params-json] --workspace <dir>',
    '  npm run dev -- mutate --workspace <dir> (--params <json> | --params-file <file>)',
    '  npm run dev -- export --workspace <dir> --spec-id <id> [--out <file>] [--show all|active]',
    '',
    'Notes:',
    '  - Launch-time seeding never happens implicitly; pair --seed with --reset.',
    '  - With --seed and no --workspace, the launcher derives .fixtures/workbenches/<name>/.',
    '  - Source/dev builds mirror debug artifacts automatically into <workspace>/.brunch/debug/.',
    '  - --dev-tools opt into query tools and subagents; it is separate from debug mirroring.',
    '  - For direct raw app access, use npm run dev:raw -- ...',
  ].join('\n');
}

function launchUsage(): string {
  return [
    '',
    'Launch examples:',
    '  npm run dev',
    '  npm run dev -- --seed workspace-alpha-grounding/base --reset --open-web',
    '  npm run dev -- --workspace .fixtures/workbenches/workspace-alpha-grounding --open-web',
  ].join('\n');
}

function rpcUsage(): string {
  return [
    '',
    'RPC examples:',
    '  npm run dev -- rpc workspace.selectionState --workspace .fixtures/workbenches/workspace-alpha-grounding',
    `  npm run dev -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding`,
  ].join('\n');
}

function mutateUsage(): string {
  return [
    '',
    'Mutate examples:',
    '  npm run dev -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json',
    '  cat /tmp/mutate.json | npm run dev -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding',
    '',
    'The mutate payload is the shared local graph-curation params object:',
    '  {"specId":1,"createBasis":"explicit","ops":[...]}',
  ].join('\n');
}

function exportUsage(): string {
  return [
    '',
    'Export examples:',
    '  npm run dev -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1',
    '  npm run dev -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json',
  ].join('\n');
}
