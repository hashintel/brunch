import process from 'node:process';

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

function parseArgs(args: readonly string[]): {
  readonly workspaceDir: string;
  readonly specId: number;
} {
  let workspaceDir: string | undefined;
  let specId: number | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--workspace') {
      workspaceDir = args[++index];
    } else if (arg === '--spec-id') {
      const value = Number(args[++index]);
      if (Number.isSafeInteger(value) && value > 0) specId = value;
    } else {
      throw new Error(`Unknown execution-comparison Brunch option: ${String(arg)}`);
    }
  }
  if (!workspaceDir || specId === undefined) {
    throw new Error('Usage: execution-comparison-brunch --workspace <path> --spec-id <positive integer>');
  }
  return { workspaceDir, specId };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await runPinnedBrunchExecutionTui({
    ...args,
    provider: 'anthropic',
    model: 'claude-opus-4-8',
  });
}

if (process.argv[1]?.endsWith('execution-comparison-brunch.ts')) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
