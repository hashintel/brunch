/**
 * One-shot Brunch workspace RPC helper for local development.
 *
 * It hides the JSON-RPC stdio ceremony used by `src/app/brunch.ts --mode=rpc` and
 * prints only the response result, filtering product-update notifications.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface CliArgs {
  readonly workspace: string;
  readonly method: string;
  readonly params?: unknown;
  readonly fullResponse: boolean;
  readonly devRpc: boolean;
}

interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id?: number | string | null;
  readonly result?: unknown;
  readonly error?: unknown;
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  let workspace = process.cwd();
  let fullResponse = false;
  let devRpc = true;
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg == null) throw new Error(`missing argument at index ${index}`);
    if (arg === '--workspace' || arg === '-w') {
      workspace = requiredValue(argv, ++index, arg);
    } else if (arg === '--full-response') {
      fullResponse = true;
    } else if (arg === '--no-dev-rpc') {
      devRpc = false;
    } else if (arg === '--help' || arg === '-h') {
      throw new UsageRequested();
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  const [method, paramsText] = positional;
  if (!method) throw new Error('method is required');
  if (positional.length > 2) throw new Error('expected at most one params JSON argument');

  const base = { workspace, method, fullResponse, devRpc };
  return paramsText == null ? base : { ...base, params: parseParams(paramsText) };
}

function parseParams(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`params must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

class UsageRequested extends Error {}

function usage(): string {
  return [
    'Usage:',
    '  tsx src/dev/workspace-rpc.ts --workspace <dir> <method> [params-json]',
    '',
    'Examples:',
    '  tsx src/dev/workspace-rpc.ts -w .fixtures/workbenches/bilal-curation workspace.selectionState',
    '  tsx src/dev/workspace-rpc.ts -w .fixtures/workbenches/bilal-curation graph.overview \'{"specId":4}\'',
    '',
    'Options:',
    '  -w, --workspace <dir>   Brunch workspace directory (default: cwd)',
    '      --full-response     Print the full JSON-RPC response instead of result only',
    '      --no-dev-rpc        Do not set BRUNCH_DEV_RPC=1',
  ].join('\n');
}

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

function runRpc(args: CliArgs): JsonRpcResponse {
  const root = repoRoot();
  const request = {
    jsonrpc: '2.0' as const,
    id: 1,
    method: args.method,
    ...(args.params === undefined ? {} : { params: args.params }),
  };

  const child = spawnSync(
    resolve(root, 'node_modules/.bin/tsx'),
    [resolve(root, 'src/app/brunch.ts'), '--mode=rpc'],
    {
      cwd: resolve(args.workspace),
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...(args.devRpc ? { BRUNCH_DEV_RPC: '1' } : {}),
      },
    },
  );

  if (child.status !== 0) {
    if (child.stdout) process.stderr.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);
    throw new Error(`brunch RPC process exited with status ${child.status ?? 'unknown'}`);
  }

  const response = child.stdout
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as JsonRpcResponse)
    .find((message) => message.id === 1);

  if (!response) {
    if (child.stdout) process.stderr.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);
    throw new Error('RPC response with id 1 was not found');
  }

  return response;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(): void {
  const args = parseCliArgs(process.argv.slice(2));
  const response = runRpc(args);
  if (response.error != null) {
    printJson(args.fullResponse ? response : response.error);
    process.exit(1);
  }
  printJson(args.fullResponse ? response : response.result);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    if (error instanceof UsageRequested) {
      console.log(usage());
      process.exit(0);
    }
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${usage()}`);
    process.exit(1);
  }
}
