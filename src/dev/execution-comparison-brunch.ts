import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

import type { Api, Model } from '@earendil-works/pi-ai';
import { getBuiltinModel } from '@earendil-works/pi-ai/providers/all';
import { createAgentSessionRuntime, getAgentDir, InteractiveMode } from '@earendil-works/pi-coding-agent';

import {
  createBrunchAgentSessionRuntimeFactory,
  runBrunchTui,
  runWithScopedBrunchOfflineDefault,
  type BrunchTuiLaunchContext,
} from '../app/brunch-tui.js';

export async function runPinnedBrunchExecutionTui(input: {
  readonly workspaceDir: string;
  readonly specId: number;
  readonly provider: 'anthropic';
  readonly model: 'claude-opus-4-8';
}): Promise<void> {
  const model = getBuiltinModel(input.provider, input.model);

  await runBrunchTui({
    cwd: input.workspaceDir,
    openWeb: false,
    webSidecarRunner: async () => null,
    runWorkspaceDialogPreflight: async () => ({
      action: 'newSession',
      specId: input.specId,
      establish: { origin: 'greenfield' },
    }),
    launchInteractive: async (context) => {
      await launchPinnedInteractive(context, model);
    },
  });
}

async function launchPinnedInteractive(context: BrunchTuiLaunchContext, model: Model<Api>): Promise<void> {
  const agentDir = getAgentDir();
  const createRuntime = createBrunchAgentSessionRuntimeFactory({
    ...context,
    agentServices: { model },
  });
  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: context.workspace.cwd,
    agentDir,
    sessionManager: context.workspace.session.manager,
  });
  await runWithScopedBrunchOfflineDefault({
    run: async () => {
      await new InteractiveMode(runtime).run();
    },
  });
}

export function parseExecutionComparisonArgs(args: readonly string[]): {
  readonly workspaceDir: string;
  readonly specId: number;
} {
  const { values } = parseNodeArgs({
    args: [...args],
    allowPositionals: false,
    strict: true,
    options: {
      workspace: { type: 'string' },
      'spec-id': { type: 'string' },
    },
  });
  const workspaceDir = values.workspace;
  const specId = Number(values['spec-id']);
  if (!workspaceDir || !Number.isSafeInteger(specId) || specId <= 0) {
    throw new Error('Usage: execution-comparison-brunch --workspace <path> --spec-id <positive integer>');
  }
  return { workspaceDir, specId };
}

async function main(): Promise<void> {
  const args = parseExecutionComparisonArgs(process.argv.slice(2));
  await runPinnedBrunchExecutionTui({
    ...args,
    provider: 'anthropic',
    model: 'claude-opus-4-8',
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
