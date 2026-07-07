import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  runSubagent as defaultRunSubagent,
  type BrunchSubagentsDeps,
  type SubagentRunContext,
  type SubagentStreamUpdate,
} from '../.pi/extensions/subagents/index.js';
import type { AgentRunnerPort, AgentRunUpdate } from '../executor/execution-ports.js';

export interface AgentRunnerPortOptions {
  readonly subagents?: BrunchSubagentsDeps;
}

export function createAgentRunnerPort(options: AgentRunnerPortOptions = {}): AgentRunnerPort {
  return {
    async run(args) {
      const subagents = options.subagents;
      if (!subagents) {
        return {
          status: 'failed',
          message:
            'AgentRunnerPort has no subagent deps injected in this launch, so the sealed worker cannot run. Compose subagents (execute mode or --dev-tools).',
        };
      }
      const worker = subagents.definitions.get('worker');
      if (!worker) {
        return { status: 'failed', message: 'AgentRunnerPort worker definition is not loaded.' };
      }
      if (!args.runtime?.modelRegistry) {
        return {
          status: 'failed',
          message: 'AgentRunnerPort requires Pi model context to launch the worker.',
        };
      }

      const request = await readExecutionRequest(args.requestPath);
      if (!request) {
        return {
          status: 'failed',
          message: `AgentRunnerPort could not read execution request at ${args.requestPath}.`,
        };
      }
      const runSubagent = subagents.runSubagent ?? defaultRunSubagent;
      const pendingUpdates: Promise<void>[] = [];
      const emitUpdate = (update: AgentRunUpdate): void => {
        const result = args.onUpdate?.(update);
        if (result) pendingUpdates.push(Promise.resolve(result));
      };
      await args.onUpdate?.({ kind: 'status', message: `worker ${worker.name} starting` });
      const result = await runSubagent({
        definition: worker,
        task: renderWorkerTask(args, request),
        ctx: {
          cwd: args.worktreeDir,
          modelRegistry: args.runtime.modelRegistry,
          model: args.runtime.model,
          signal: args.runtime.signal,
        } as SubagentRunContext,
        deps: subagents,
        onUpdate: (update) => {
          emitUpdate(agentRunUpdateFromSubagent(update));
        },
      });
      await Promise.all(pendingUpdates);

      if (result.status === 'error') {
        await args.onUpdate?.({ kind: 'status', message: `worker ${worker.name} failed` });
        return { status: 'failed', message: result.text };
      }
      await mkdir(dirname(args.resultPath), { recursive: true });
      await writeFile(
        args.resultPath,
        `${JSON.stringify({ status: 'completed', summary: result.text })}\n`,
        'utf8',
      );
      await args.onUpdate?.({ kind: 'status', message: `worker ${worker.name} completed` });
      return {
        status: 'completed',
        summary: result.text,
      };
    },
  };
}

function agentRunUpdateFromSubagent(update: SubagentStreamUpdate): AgentRunUpdate {
  switch (update.kind) {
    case 'tool':
      return { kind: 'tool', message: update.message };
    case 'message':
      return { kind: 'message', message: update.message };
    case 'status':
      return { kind: 'status', message: update.message };
  }
}

async function readExecutionRequest(requestPath: string): Promise<string | undefined> {
  try {
    return await readFile(requestPath, 'utf8');
  } catch {
    return undefined;
  }
}

function renderWorkerTask(args: Parameters<AgentRunnerPort['run']>[0], request: string): string {
  return [
    `Run id: ${args.runId}`,
    `Epic id: ${args.epicId}`,
    `Slice id: ${args.sliceId}`,
    `Request path: ${args.requestPath}`,
    `Result path: ${args.resultPath}`,
    '',
    'Execution request:',
    request,
  ].join('\n');
}
