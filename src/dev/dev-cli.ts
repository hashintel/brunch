import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
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
  text as clackText,
} from '@clack/prompts';

import { runBrunchCli, type BrunchCliOptions } from '../app/brunch.js';
import { exportSeedFixtureFromWorkspace, formatSeedFixture } from '../graph/export-fixtures.js';
import { listTrackedSeedRefs, parseSeedRef, runSeedFixturesCli } from '../graph/seed-fixtures.js';
import { createRpcHandlers } from '../rpc/handlers.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { applyDevGraphMutation, parseDevMutateGraphParams } from './graph-curation.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKBENCHES_ROOT = resolve(REPO_ROOT, '.fixtures', 'workbenches');

type TopLevelCommand = 'launch' | 'rpc' | 'mutate' | 'export' | 'help';
type GraphVisibility = 'all' | 'active';

type LaunchSource = 'temporary' | 'new' | 'existing' | 'seed';

interface WorkbenchChoice {
  readonly label: string;
  readonly workspace: string;
}

interface LaunchPromptPlan {
  readonly workspace: string;
  readonly seed?: string;
  readonly reset: boolean;
  readonly openWeb: boolean;
}

export interface DevCliPrompts {
  intro(title: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  chooseLaunchSource(hasExistingWorkbenches: boolean): Promise<LaunchSource | symbol>;
  enterWorkbenchName(existingNames: readonly string[]): Promise<string | symbol>;
  chooseExistingWorkbench(options: readonly WorkbenchChoice[]): Promise<string | symbol>;
  chooseSeed(options: readonly string[]): Promise<string | symbol>;
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
  readonly workbenchesRoot?: string;
  readonly createTempWorkspace?: () => Promise<string>;
}

interface LaunchFlags {
  readonly workspace: string | undefined;
  readonly workbench: string | undefined;
  readonly temporary: boolean;
  readonly seed: string | undefined;
  readonly reset: boolean;
  readonly mode: string;
  readonly openWeb: boolean;
  readonly noWebui: boolean;
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
  chooseLaunchSource: async (hasExistingWorkbenches) =>
    clackSelect({
      message: 'How should this dev instance start?',
      options: [
        { value: 'temporary', label: 'Temporary bare instance' },
        { value: 'new', label: 'New named workbench' },
        ...(hasExistingWorkbenches
          ? [{ value: 'existing' as const, label: 'Existing workbench (no seeding)' }]
          : []),
        { value: 'seed', label: 'Create or reset a workbench from a seed fixture' },
      ],
    }),
  enterWorkbenchName: async (existingNames) =>
    clackText({
      message: 'New workbench name',
      placeholder: 'my-workbench',
      validate: (value) => {
        if (!value || !isSafeWorkbenchName(value)) {
          return 'Use one directory name (letters, numbers, ., _, or -).';
        }
        if (existingNames.includes(value)) return `Workbench ${value} already exists.`;
        return undefined;
      },
    }),
  chooseExistingWorkbench: async (options) =>
    clackSelect({
      message: 'Which existing workbench should Brunch use?',
      options: options.map((option) => ({ value: option.workspace, label: option.label })),
      maxItems: 10,
    }),
  chooseSeed: async (options) =>
    clackSelect({
      message: 'Which seed fixture should create or reset its workbench?',
      options: options.map((seed) => ({ value: seed, label: seed })),
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
      message: `Open the web observer in your browser for ${workspaceLabel}?`,
      initialValue: true,
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
  if (flags.reset && !flags.seed) {
    throw new DevCliUsageError('--reset only applies when paired with --seed.');
  }

  const workbenchesRoot = options.workbenchesRoot ?? WORKBENCHES_ROOT;
  if (flags.temporary && (flags.workspace || flags.workbench || flags.seed || flags.reset)) {
    throw new DevCliUsageError(
      '--temp cannot be combined with --workspace, --workbench, --seed, or --reset.',
    );
  }

  const currentWorkbench = currentWorkbenchForCwd(options.cwd, workbenchesRoot);
  const prompts = options.prompts ?? defaultPrompts;
  let workspace = flags.temporary
    ? await (options.createTempWorkspace ?? createTemporaryWorkspace)()
    : (flags.workspace ??
      (flags.workbench ? resolve(workbenchesRoot, flags.workbench) : undefined) ??
      (seedRef ? resolve(workbenchesRoot, seedRef.name) : currentWorkbench));
  let seed = flags.seed;
  let reset = flags.reset;
  let openWeb = flags.openWeb;

  if (!workspace) {
    if (flags.mode !== 'tui') {
      throw new DevCliUsageError('A workbench is required for non-interactive launch modes.');
    }
    if (!isInteractiveTerminal(options.stdin, options.stdout)) {
      throw new DevCliUsageError('No workbench was provided and no interactive terminal is available.');
    }
    const plan = await promptForLaunchPlan({
      prompts,
      workbenchesRoot,
      createTempWorkspace: options.createTempWorkspace ?? createTemporaryWorkspace,
      ...(flags.noWebui ? { openWebOverride: false } : {}),
    });
    if (!plan) return 0;
    workspace = plan.workspace;
    seed = plan.seed;
    reset = plan.reset;
    openWeb = plan.openWeb;
  }

  if (seed && !reset) {
    throw new DevCliUsageError('Launch-time seeding requires --reset so the workspace state stays explicit.');
  }
  if (!seed && reset) {
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
      ...(!openWeb ? ['--no-webui'] : []),
      ...(flags.developerTools ? ['--dev-tools'] : []),
    ],
    cwd: workspace,
    ...(options.stdin ? { stdin: options.stdin } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    developerTools: flags.developerTools,
  });
}

async function promptForLaunchPlan(options: {
  readonly prompts: DevCliPrompts;
  readonly workbenchesRoot: string;
  readonly createTempWorkspace: () => Promise<string>;
  readonly openWebOverride?: boolean;
}): Promise<LaunchPromptPlan | null> {
  const { prompts, workbenchesRoot } = options;
  const workbenches = await listExistingWorkbenches(workbenchesRoot);
  const seedRefs = (await listTrackedSeedRefs()).map((seed) => seed.ref);

  prompts.intro('Brunch dev launcher');
  const source = await prompts.chooseLaunchSource(workbenches.length > 0);
  if (isCancel(source)) return cancelLaunch(prompts);

  let workspace: string;
  let seed: string | undefined;

  if (source === 'temporary') {
    workspace = await options.createTempWorkspace();
  } else if (source === 'new') {
    const name = await prompts.enterWorkbenchName(workbenches.map((choice) => choice.label));
    if (isCancel(name)) return cancelLaunch(prompts);
    if (!isSafeWorkbenchName(name)) {
      throw new DevCliUsageError('A workbench name must be a single directory name.');
    }
    if (workbenches.some((choice) => choice.label === name)) {
      throw new DevCliUsageError(`Workbench ${name} already exists.`);
    }
    workspace = resolve(workbenchesRoot, name);
  } else if (source === 'existing') {
    if (workbenches.length === 0) throw new DevCliUsageError('No existing workbenches are available.');
    const selected = await prompts.chooseExistingWorkbench(workbenches);
    if (isCancel(selected)) return cancelLaunch(prompts);
    if (!workbenches.some((choice) => choice.workspace === selected)) {
      throw new DevCliUsageError(`Unknown workbench selected: ${selected}`);
    }
    workspace = selected;
  } else {
    if (seedRefs.length === 0) throw new DevCliUsageError('No tracked seed fixtures are available.');
    const selectedSeed = await prompts.chooseSeed(seedRefs);
    if (isCancel(selectedSeed)) return cancelLaunch(prompts);
    const parsedSeed = parseSeedRef(selectedSeed);
    if (!parsedSeed || !seedRefs.includes(selectedSeed)) {
      throw new DevCliUsageError(`Unknown seed fixture selected: ${selectedSeed}`);
    }
    workspace = resolve(workbenchesRoot, parsedSeed.name);
    seed = selectedSeed;
    const confirmed = await prompts.confirmSeedReset(
      selectedSeed,
      labelForWorkbench(workspace, workbenchesRoot),
    );
    if (isCancel(confirmed) || confirmed !== true) return cancelLaunch(prompts);
  }

  const workspaceLabel = labelForWorkbench(workspace, workbenchesRoot);
  const openWeb = options.openWebOverride ?? (await prompts.confirmOpenWeb(workspaceLabel));
  if (isCancel(openWeb)) return cancelLaunch(prompts);

  prompts.outro(`Launching ${workspaceLabel}${seed ? ` from ${seed}` : ''}.`);
  return { workspace, ...(seed ? { seed } : {}), reset: seed !== undefined, openWeb };
}

function cancelLaunch(prompts: DevCliPrompts): null {
  prompts.cancel('Launch cancelled.');
  return null;
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
      workbench: { type: 'string' },
      temp: { type: 'boolean', default: false },
      seed: { type: 'string' },
      reset: { type: 'boolean', default: false },
      mode: { type: 'string', default: 'tui' },
      'no-webui': { type: 'boolean', default: false },
      'dev-tools': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (positionals.length > 0) {
    throw new DevCliUsageError(`Unexpected launch argument: ${positionals[0]}`);
  }
  const workspace = resolveWorkspaceOption(values.workspace, values.cwd, cwd);
  if (values.workbench && workspace) {
    throw new DevCliUsageError('Use only one of --workbench, --workspace, or --cwd.');
  }
  if (values.workbench && !isSafeWorkbenchName(values.workbench)) {
    throw new DevCliUsageError('--workbench must be a single directory name (letters, numbers, ., _, or -).');
  }
  return {
    workspace,
    workbench: values.workbench,
    temporary: values.temp,
    seed: values.seed,
    reset: values.reset,
    mode: values.mode,
    openWeb: !values['no-webui'],
    noWebui: values['no-webui'],
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
  if (value.length === 0 || value[0] === '0') {
    throw new DevCliUsageError(`${flag} must be a positive integer.`);
  }

  let parsed = 0;
  for (const char of value) {
    const digit = char.charCodeAt(0) - 48;
    if (digit < 0 || digit > 9) {
      throw new DevCliUsageError(`${flag} must be a positive integer.`);
    }
    parsed = parsed * 10 + digit;
    if (!Number.isSafeInteger(parsed)) {
      throw new DevCliUsageError(`${flag} must be a positive integer.`);
    }
  }
  return parsed;
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

function currentWorkbenchForCwd(cwd: string, workbenchesRoot: string): string | undefined {
  const resolvedCwd = resolve(cwd);
  const relativePath = relative(workbenchesRoot, resolvedCwd);
  if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) return undefined;
  const [workbenchName] = relativePath.split(sep);
  return workbenchName ? resolve(workbenchesRoot, workbenchName) : undefined;
}

async function listExistingWorkbenches(workbenchesRoot: string): Promise<readonly WorkbenchChoice[]> {
  let entries;
  try {
    entries = await readdir(workbenchesRoot, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ label: entry.name, workspace: resolve(workbenchesRoot, entry.name) }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function isSafeWorkbenchName(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function createTemporaryWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'brunch-'));
}

function labelForWorkbench(workspace: string, workbenchesRoot: string): string {
  const relativePath = relative(workbenchesRoot, workspace);
  if (relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
    return join('.fixtures', 'workbenches', relativePath);
  }
  return labelForWorkspace(workspace);
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
    '  npm run dev-cli',
    '  npm run dev-cli -- --temp [--no-webui] [--dev-tools]',
    '  npm run dev-cli -- --workbench <name> [--mode tui|print|rpc] [--no-webui] [--dev-tools]',
    '  npm run dev-cli -- --workspace <dir> [--mode tui|print|rpc] [--no-webui] [--dev-tools]',
    '  npm run dev-cli -- --seed <name>/<variant> --reset [--no-webui] [--dev-tools]',
    '  npm run dev-cli -- --workbench <name> --seed <name>/<variant> --reset [--no-webui] [--dev-tools]',
    '  npm run dev-cli -- rpc <method> [params-json] --workspace <dir>',
    '  npm run dev-cli -- mutate --workspace <dir> (--params <json> | --params-file <file>)',
    '  npm run dev-cli -- export --workspace <dir> --spec-id <id> [--out <file>] [--show all|active]',
    '',
    'Notes:',
    '  - Launch-time seeding never happens implicitly; pair --seed with --reset.',
    '  - With --seed and no --workspace, the launcher derives .fixtures/workbenches/<name>/.',
    '  - Source/dev builds mirror debug artifacts automatically into <workspace>/.brunch/debug/.',
    '  - --dev-tools opts into dev query tools; product subagents are not dev-gated.',
    '  - For direct app access, use npm run dev -- ...',
  ].join('\n');
}

function launchUsage(): string {
  return [
    '',
    'Launch examples:',
    '  npm run dev-cli',
    '  npm run dev-cli -- --temp',
    '  npm run dev-cli -- --workbench my-instance',
    '  npm run dev-cli -- --seed workspace-alpha-grounding/base --reset',
    '  npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding --no-webui',
  ].join('\n');
}

function rpcUsage(): string {
  return [
    '',
    'RPC examples:',
    '  npm run dev-cli -- rpc workspace.selectionState --workspace .fixtures/workbenches/workspace-alpha-grounding',
    `  npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding`,
  ].join('\n');
}

function mutateUsage(): string {
  return [
    '',
    'Mutate examples:',
    '  npm run dev-cli -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json',
    '  cat /tmp/mutate.json | npm run dev-cli -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding',
    '',
    'The mutate payload is the shared local graph-curation params object:',
    '  {"specId":1,"createBasis":"explicit","ops":[...]}',
  ].join('\n');
}

function exportUsage(): string {
  return [
    '',
    'Export examples:',
    '  npm run dev-cli -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1',
    '  npm run dev-cli -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json',
  ].join('\n');
}
