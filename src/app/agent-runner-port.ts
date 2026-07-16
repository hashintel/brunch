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
            'AgentRunnerPort has no subagent deps injected in this launch, so the sealed worker cannot run. Compose execute-mode subagents.',
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
  const renderedBrief = renderWorkerBrief(request);
  return [
    `Run id: ${args.runId}`,
    `Epic id: ${args.epicId}`,
    `Slice id: ${args.sliceId}`,
    `Request path: ${args.requestPath}`,
    `Result path: ${args.resultPath}`,
    '',
    renderedBrief,
  ].join('\n');
}

interface ExecutionRequestCriterion {
  readonly kind?: string;
  readonly target?: string;
}

interface ExecutionRequestContextItem {
  readonly itemId?: string;
  readonly content?: string;
}

interface ExecutionRequest {
  readonly scopeId?: string;
  readonly definition?: string;
  readonly instruction?: string;
  readonly criteria?: readonly ExecutionRequestCriterion[];
  readonly derivedFrom?: readonly string[];
  readonly designContext?: readonly ExecutionRequestContextItem[];
  readonly verificationContext?: readonly ExecutionRequestContextItem[];
}

function renderWorkerBrief(request: string): string {
  const parsedRequest = parseExecutionRequest(request);
  if (!parsedRequest) {
    return ['Execution request:', request].join('\n');
  }

  const lines = [
    ...(parsedRequest.scopeId ? [`Scope id: ${parsedRequest.scopeId}`] : []),
    ...(parsedRequest.definition ? ['Slice goal:', parsedRequest.definition] : []),
    ...(parsedRequest.instruction ? ['Instruction:', parsedRequest.instruction] : []),
    ...renderCriterionLines(parsedRequest.criteria),
    ...renderListSection('Derived from requirements', parsedRequest.derivedFrom),
    ...renderContextSection('Design context', parsedRequest.designContext),
    ...renderContextSection('Verification context', parsedRequest.verificationContext),
  ];

  return lines.length > 0 ? lines.join('\n') : ['Execution request:', request].join('\n');
}

function parseExecutionRequest(request: string): ExecutionRequest | undefined {
  try {
    return JSON.parse(request) as ExecutionRequest;
  } catch {
    return undefined;
  }
}

function renderCriterionLines(criteria: ExecutionRequest['criteria']): string[] {
  const renderedCriteria =
    criteria?.flatMap((criterion) =>
      typeof criterion?.kind === 'string' && typeof criterion?.target === 'string'
        ? [`- ${criterion.kind}: ${criterion.target}`]
        : [],
    ) ?? [];

  return renderedCriteria.length > 0 ? ['Done criteria:', ...renderedCriteria] : [];
}

function renderListSection(title: string, values: readonly string[] | undefined): string[] {
  const renderedValues = values?.filter((value): value is string => typeof value === 'string') ?? [];
  return renderedValues.length > 0 ? [title + ':', ...renderedValues.map((value) => `- ${value}`)] : [];
}

function renderContextSection(
  title: string,
  items: readonly ExecutionRequestContextItem[] | undefined,
): string[] {
  const renderedItems =
    items?.flatMap((item) =>
      typeof item?.itemId === 'string' && typeof item?.content === 'string'
        ? [`- [${item.itemId}] ${item.content}`]
        : [],
    ) ?? [];

  return renderedItems.length > 0 ? [title + ':', ...renderedItems] : [];
}
