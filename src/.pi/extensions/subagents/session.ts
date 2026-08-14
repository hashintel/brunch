/**
 * Sealed SDK child sessions for subagents (D44-L / D91-L / I29-L).
 *
 * Each subagent runs as an in-process SDK `AgentSession` — NOT a `pi`
 * subprocess and NOT ambient `~/.pi` discovery. The child is constructed from
 * explicit, sealed services so it inherits nothing implicit:
 *
 *   - sealed in-memory `SettingsManager` (injected from the app layer)
 *   - sealed `DefaultResourceLoader` options (no extensions/skills/prompts/
 *     themes/context files) with an assembled background prompt
 *   - the parent's `ModelRuntime` (carries resolved auth + registered
 *     providers) so the child needs no ambient auth or model bootstrap
 *   - an in-memory `SessionManager` so nothing is persisted to disk
 *   - an explicit tool allowlist built from Brunch-owned tool definitions
 *
 * The child has no ambient conversation context, no `CommandExecutor`, and no
 * Brunch RPC. Any parent world is injected explicitly by the app root: a fixed
 * snapshot in the prompt plus selected-spec read tools such as `read_graph`.
 * Its last assistant message is returned to the caller as tool-result content.
 */

import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';

import {
  createAgentSessionFromServices,
  createAgentSessionServices,
  defineTool,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  SessionManager,
  type AgentSessionEvent,
  type CreateAgentSessionFromServicesOptions,
  type CreateAgentSessionServicesOptions,
  type ExtensionContext,
  type ModelRuntime,
  type SettingsManager,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { Type, type Static, type TSchema } from 'typebox';

import { createReadGraphTool, type GraphReaders } from '../brunch-data/graph/index.js';
import { defineBrunchTool } from '../shared/define-brunch-tool.js';
import { toolParameters } from '../shared/tool-schema.js';
import { createWebFetchTool } from '../web-tools/web/web-fetch.js';
import { createWebSearchTool } from '../web-tools/web/web-search.js';
import type { SubagentDefinition } from './agents.js';
import { composeBackgroundSubagentPrompt, type BackgroundWorldSnapshot } from './prompt-assembly.js';

const WriteWorktreeFileParams = Type.Object({
  path: Type.String({ minLength: 1, description: 'Relative path inside the worker worktree.' }),
  content: Type.String({ description: 'Complete file content to write.' }),
});

type WriteWorktreeFileParams = Static<typeof WriteWorktreeFileParams>;

type ChildModel = NonNullable<CreateAgentSessionFromServicesOptions['model']>;
type ChildModelRegistry = ExtensionContext['modelRegistry'];

/** The subset of the tool execution context a subagent run needs. */
export interface SubagentRunContext {
  readonly cwd: string;
  readonly modelRegistry: ChildModelRegistry;
  readonly model: ExtensionContext['model'];
  readonly signal?: AbortSignal | undefined;
}

/**
 * Sealed runtime primitives injected from the app composition root so this
 * `.pi` module never imports `src/app`.
 */
export interface SubagentSealedDeps {
  readonly agentDir: string;
  /** Parent-owned canonical auth/model runtime; avoids ambient child bootstrap. */
  readonly modelRuntime: ModelRuntime;
  /** Builds a fresh sealed in-memory settings manager per child session. */
  readonly createSettingsManager: () => SettingsManager;
  /** Sealed resource-loader options (no ambient discovery), sans system prompt. */
  readonly resourceLoaderOptions: CreateAgentSessionServicesOptions['resourceLoaderOptions'];
  /** Explicit parent-world handles injected by the app root; no ambient discovery. */
  readonly injectedWorld?: SubagentInjectedWorld;
}

export interface SubagentInjectedWorld {
  readonly snapshot: BackgroundWorldSnapshot;
  readonly graph?: {
    readonly specId: number;
    readonly reads: GraphReaders;
  };
}

export interface RunSubagentInput {
  readonly definition: SubagentDefinition;
  readonly task: string;
  readonly ctx: SubagentRunContext;
  readonly deps: SubagentSealedDeps;
  readonly onUpdate?: (update: SubagentStreamUpdate) => void;
  readonly outputContract?: SubagentOutputContract;
  /** Injectable SDK builders (defaults to the real ones) for testing. */
  readonly createServices?: typeof createAgentSessionServices;
  readonly createSession?: typeof createAgentSessionFromServices;
}

declare const subagentOutputContractBrand: unique symbol;

export interface SubagentOutputContract {
  readonly name: string;
  readonly [subagentOutputContractBrand]: true;
}

interface SubagentOutputContractInternals {
  readonly tool: ToolDefinition;
  readonly read: () => readonly unknown[];
}

const outputContractInternals = new WeakMap<SubagentOutputContract, SubagentOutputContractInternals>();

export function createSubagentOutputContract(args: {
  readonly name: string;
  readonly description: string;
  readonly parameters: TSchema;
}): SubagentOutputContract {
  const outputs: unknown[] = [];
  const tool = defineTool({
    name: args.name,
    label: args.name,
    description: args.description,
    parameters: toolParameters(args.parameters),
    async execute(_toolCallId, params) {
      outputs.push(params);
      return {
        content: [{ type: 'text' as const, text: 'Structured output submitted.' }],
        details: {},
        terminate: true,
      };
    },
  });
  const contract = Object.freeze({ name: args.name }) as SubagentOutputContract;
  outputContractInternals.set(contract, { tool, read: () => outputs });
  return contract;
}

export type SubagentStreamUpdate =
  | { readonly kind: 'status'; readonly message: string }
  | { readonly kind: 'message'; readonly message: string }
  | { readonly kind: 'tool'; readonly message: string };

export interface SubagentResult {
  readonly agent: string;
  readonly status: 'ok' | 'error';
  readonly text: string;
  readonly output?: unknown;
}

export type ModelResolution =
  | { readonly status: 'resolved'; readonly model: ChildModel }
  | { readonly status: 'unresolved'; readonly reason: string };

/**
 * Resolve a child model from the agent's `model` field. `default` inherits the
 * parent's current model (falling back to the first available registered
 * model); `provider/model-id` is looked up in the parent's registry.
 */
export function resolveSubagentModel(
  definition: SubagentDefinition,
  ctx: Pick<SubagentRunContext, 'model' | 'modelRegistry'>,
): ModelResolution {
  if (definition.model === 'default') {
    const model = ctx.model ?? ctx.modelRegistry.getAvailable()[0];
    if (!model) return { status: 'unresolved', reason: 'no model is available for "default"' };
    return { status: 'resolved', model };
  }

  const separator = definition.model.indexOf('/');
  if (separator <= 0 || separator === definition.model.length - 1) {
    return {
      status: 'unresolved',
      reason: `model "${definition.model}" must be "default" or "provider/model-id"`,
    };
  }
  const provider = definition.model.slice(0, separator);
  const modelId = definition.model.slice(separator + 1);
  const model = ctx.modelRegistry.find(provider, modelId);
  if (!model) {
    return { status: 'unresolved', reason: `model "${definition.model}" is not registered or available` };
  }
  return { status: 'resolved', model };
}

export interface SubagentToolPlan {
  readonly tools?: string[];
  readonly customTools?: ToolDefinition[];
  readonly noTools?: 'all';
}

/**
 * Brunch-owned tool definitions a subagent may be granted. This is the shared
 * catalog source for manifest-authored background grants: read-only filesystem
 * tools come from the SDK (cwd-bound; they override the built-ins of the same
 * name); web tools come from Brunch's own factories; `read_graph` is present
 * only when parent graph readers are injected. Write/shell built-ins
 * (`bash`/`edit`/`write`) are intentionally absent.
 */
export function createSubagentToolCatalog(
  cwd: string,
  injectedWorld?: SubagentInjectedWorld,
): Map<string, ToolDefinition> {
  const pool = new Map<string, ToolDefinition>();
  for (const rawDefinition of [
    createReadToolDefinition(cwd),
    createGrepToolDefinition(cwd),
    createFindToolDefinition(cwd),
    createLsToolDefinition(cwd),
  ]) {
    const definition = rawDefinition as ToolDefinition;
    const execute = definition.execute.bind(definition);
    const boundedDefinition = {
      ...definition,
      execute: async (...args: Parameters<ToolDefinition['execute']>) => {
        const params = args[1] as { readonly path?: string };
        await assertBoundedExistingPath(cwd, params.path ?? '.');
        return await execute(...args);
      },
    } as ToolDefinition;
    pool.set(boundedDefinition.name, boundedDefinition);
  }
  for (const tool of [createWebSearchTool(), createWebFetchTool()]) {
    pool.set(tool.name, tool as unknown as ToolDefinition);
  }
  pool.set('write_worktree_file', createWriteWorktreeFileTool(cwd) as ToolDefinition);
  if (injectedWorld?.graph) {
    pool.set(
      'read_graph',
      createReadGraphTool({
        specId: injectedWorld.graph.specId,
        reads: injectedWorld.graph.reads,
      }) as ToolDefinition,
    );
  }
  return pool;
}

function createWriteWorktreeFileTool(cwd: string) {
  return defineBrunchTool({
    name: 'write_worktree_file',
    label: 'write_worktree_file',
    description:
      'Write a complete file under this worker worktree. Path must be relative and stay inside cwd.',
    parameters: toolParameters(WriteWorktreeFileParams),
    async execute(_toolCallId, params) {
      const target = boundedWorktreePath(cwd, params.path);
      await assertBoundedExistingAncestor(cwd, target);
      await mkdir(dirname(target), { recursive: true });
      await assertBoundedExistingPath(cwd, dirname(target));
      await assertBoundedExistingTargetIfPresent(cwd, target);
      await writeFile(target, params.content, 'utf8');
      return {
        content: [{ type: 'text' as const, text: `wrote ${params.path}` }],
        details: { sideEffects: [{ kind: 'write_file', path: target, ifExists: 'overwrite' }] },
      };
    },
  });
}

function boundedWorktreePath(cwd: string, rawPath: string): string {
  if (isAbsolute(rawPath)) throw new Error('write_worktree_file path must be relative');
  const root = resolve(cwd);
  const target = resolve(root, rawPath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error('write_worktree_file path escapes the worktree');
  }
  return target;
}

async function assertBoundedExistingPath(cwd: string, rawPath: string): Promise<void> {
  const root = resolve(cwd);
  const target = resolve(root, rawPath);
  assertContainedPath(root, target);
  const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
  assertContainedPath(realRoot, realTarget);
}

async function assertBoundedExistingAncestor(cwd: string, target: string): Promise<void> {
  let ancestor = dirname(target);
  while (true) {
    try {
      await assertBoundedExistingPath(cwd, ancestor);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
}

async function assertBoundedExistingTargetIfPresent(cwd: string, target: string): Promise<void> {
  try {
    await assertBoundedExistingPath(cwd, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function assertContainedPath(root: string, target: string): void {
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error('subagent filesystem path escapes the worktree');
  }
}

/**
 * Translate an agent's declared tool allowlist into SDK session options.
 * Throws on an unknown tool name (a Brunch authoring bug — fail loud).
 */
export function planSubagentTools(
  definition: SubagentDefinition,
  ctx: Pick<SubagentRunContext, 'cwd'>,
  injectedWorld?: SubagentInjectedWorld,
): SubagentToolPlan {
  if (definition.tools.length === 0) return { noTools: 'all' };

  const pool = createSubagentToolCatalog(ctx.cwd, injectedWorld);
  const customTools: ToolDefinition[] = [];
  const unknown: string[] = [];
  for (const name of definition.tools) {
    const tool = pool.get(name);
    if (tool) customTools.push(tool);
    else unknown.push(name);
  }
  if (unknown.length > 0) {
    throw new Error(
      `subagent "${definition.name}" requests unknown tool(s): ${unknown.join(', ')}. ` +
        `Available: ${[...pool.keys()].join(', ')}.`,
    );
  }
  return { tools: [...definition.tools], customTools };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Run one subagent to completion in a sealed child session and return its last
 * assistant message. Never throws: failures are returned as an error result so
 * the foreground tool call always gets usable content.
 */
export async function runSubagent(input: RunSubagentInput): Promise<SubagentResult> {
  const { definition, task, ctx, deps } = input;
  const createServices = input.createServices ?? createAgentSessionServices;
  const createSession = input.createSession ?? createAgentSessionFromServices;

  const abortedResult = (): SubagentResult => ({
    agent: definition.name,
    status: 'error',
    text: `Subagent "${definition.name}" was aborted.`,
  });

  if (ctx.signal?.aborted) return abortedResult();

  const resolution = resolveSubagentModel(definition, ctx);
  if (resolution.status === 'unresolved') {
    return {
      agent: definition.name,
      status: 'error',
      text: `Subagent "${definition.name}" could not start: ${resolution.reason}`,
    };
  }

  let toolPlan: SubagentToolPlan;
  let outputContract: SubagentOutputContractInternals | undefined;
  try {
    toolPlan = planSubagentTools(definition, ctx, deps.injectedWorld);
    if (input.outputContract) {
      outputContract = outputContractInternals.get(input.outputContract);
      if (!outputContract) {
        throw new Error('subagent output contracts must be created by createSubagentOutputContract');
      }
      const outputTool = outputContract.tool;
      if (toolPlan.customTools?.some((tool) => tool.name === outputTool.name)) {
        throw new Error(`subagent output tool collides with granted tool: ${outputTool.name}`);
      }
      toolPlan = {
        tools: [...(toolPlan.tools ?? []), outputTool.name],
        customTools: [...(toolPlan.customTools ?? []), outputTool],
      };
    }
  } catch (error) {
    return { agent: definition.name, status: 'error', text: errorText(error) };
  }

  let dispose: (() => void) | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const services = await createServices({
      cwd: ctx.cwd,
      agentDir: deps.agentDir,
      modelRuntime: deps.modelRuntime,
      settingsManager: deps.createSettingsManager(),
      resourceLoaderOptions: {
        ...deps.resourceLoaderOptions,
        systemPrompt: composeBackgroundSubagentPrompt({
          definition,
          ...(deps.injectedWorld ? { world: deps.injectedWorld.snapshot } : {}),
        }).prompt,
      },
    });
    if (ctx.signal?.aborted) return abortedResult();

    const { session } = await createSession({
      services,
      sessionManager: SessionManager.inMemory(ctx.cwd),
      model: resolution.model,
      thinkingLevel: definition.thinking,
      ...(toolPlan.noTools ? { noTools: toolPlan.noTools } : {}),
      ...(toolPlan.tools ? { tools: toolPlan.tools } : {}),
      ...(toolPlan.customTools ? { customTools: toolPlan.customTools } : {}),
    });
    dispose = () => session.dispose();
    const unsubscribeStream = subscribeToSessionStream(session, input.onUpdate);
    dispose = () => {
      unsubscribeStream?.();
      session.dispose();
    };

    if (ctx.signal) {
      onAbort = () => void session.abort();
      ctx.signal.addEventListener('abort', onAbort, { once: true });
    }
    if (ctx.signal?.aborted) {
      void session.abort();
      return abortedResult();
    }

    input.onUpdate?.({ kind: 'status', message: `subagent ${definition.name} prompt started` });
    await session.prompt(task, { expandPromptTemplates: false, source: 'rpc' });
    const text = session.getLastAssistantText()?.trim() ?? '';
    if (outputContract) {
      const outputs = outputContract.read();
      if (outputs.length !== 1) {
        return {
          agent: definition.name,
          status: 'error',
          text:
            outputs.length === 0
              ? `Subagent "${definition.name}" did not call ${outputContract.tool.name}.`
              : `Subagent "${definition.name}" must call ${outputContract.tool.name} exactly once; received ${outputs.length} submissions.`,
        };
      }
      input.onUpdate?.({ kind: 'status', message: `subagent ${definition.name} output submitted` });
      return { agent: definition.name, status: 'ok', text, output: outputs[0] };
    }
    if (text.length === 0) {
      return {
        agent: definition.name,
        status: 'error',
        text: `Subagent "${definition.name}" returned no output.`,
      };
    }
    input.onUpdate?.({ kind: 'status', message: `subagent ${definition.name} prompt completed` });
    return { agent: definition.name, status: 'ok', text };
  } catch (error) {
    return {
      agent: definition.name,
      status: 'error',
      text: `Subagent "${definition.name}" failed: ${errorText(error)}`,
    };
  } finally {
    if (ctx.signal && onAbort) ctx.signal.removeEventListener('abort', onAbort);
    dispose?.();
  }
}

function subscribeToSessionStream(
  session: unknown,
  onUpdate: RunSubagentInput['onUpdate'],
): (() => void) | undefined {
  if (!onUpdate || !hasSubscribe(session)) return undefined;
  return session.subscribe((event) => {
    const update = streamUpdateFromSessionEvent(event);
    if (update) onUpdate(update);
  });
}

function hasSubscribe(
  value: unknown,
): value is { subscribe: (listener: (event: AgentSessionEvent) => void) => () => void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'subscribe' in value &&
    typeof (value as { subscribe?: unknown }).subscribe === 'function'
  );
}

function streamUpdateFromSessionEvent(event: AgentSessionEvent): SubagentStreamUpdate | undefined {
  if (event.type === 'tool_execution_start' && typeof event.toolName === 'string') {
    return { kind: 'tool', message: `tool ${event.toolName} started` };
  }
  if (event.type === 'tool_execution_end' && typeof event.toolName === 'string') {
    return { kind: 'tool', message: `tool ${event.toolName} completed` };
  }
  if (event.type !== 'message_update') return undefined;

  const update = event.assistantMessageEvent;
  if (update?.type !== 'text_delta' || typeof update.delta !== 'string') return undefined;
  const text = update.delta.trim();
  return text.length === 0 ? undefined : { kind: 'message', message: previewText(text, 800) };
}

function previewText(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
}
