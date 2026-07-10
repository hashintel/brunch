import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fauxAssistantMessage, fauxToolCall, type Context } from '@earendil-works/pi-ai';
import { registerFauxProvider } from '@earendil-works/pi-ai/compat';
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  type CreateAgentSessionServicesOptions,
  type ExtensionAPI,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';

import type { GraphSlice } from '../../../graph/queries.js';
import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
} from '../../../probes/faux-provider.js';
import type { GraphReaders } from '../brunch-data/graph/index.js';
import { assertProviderLegalToolSchema, hasToolParametersProvenance } from '../shared/tool-schema.js';
import {
  loadSubagentDefinitions,
  parseSubagentMarkdown,
  subagentAgentsDir,
  type SubagentDefinition,
} from '../subagents/agents.js';
import { parseSubagentConfig } from '../subagents/config.js';
import {
  BRUNCH_SUBAGENT_TOOL,
  createSemaphore,
  registerBrunchSubagents,
  type BrunchSubagentsDeps,
} from '../subagents/index.js';
import { composeBackgroundSubagentPrompt } from '../subagents/prompt-assembly.js';
import {
  createSubagentToolCatalog,
  planSubagentTools,
  resolveSubagentModel,
  runSubagent,
  type SubagentResult,
  type SubagentRunContext,
  type SubagentSealedDeps,
} from '../subagents/session.js';

// Manifest skill locations are absolute paths (see src/agents/skills/registry.ts); normalize the
// machine root before snapshotting so the committed golden carries no workstation-specific path.
const packageRoot = fileURLToPath(new URL('../../../..', import.meta.url)).replace(/\/$/u, '');

const EXPLORER_MD = `---
name: explorer
description: Read-only recon
tools: read, grep, find, ls
model: default
thinking: low
---

You are an explorer.
`;

const WORKER_MD = `---
name: worker
description: Execute one bounded code change in a sandbox worktree
tools: read, write_worktree_file
model: default
thinking: medium
---

You are a worker.
`;

function sealedResourceLoaderOptions(): CreateAgentSessionServicesOptions['resourceLoaderOptions'] {
  return {
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
    extensionFactories: [],
  };
}

describe('parseSubagentMarkdown', () => {
  it('parses frontmatter, a comma-separated tool list, and the body', () => {
    const def = parseSubagentMarkdown(EXPLORER_MD);
    expect(def.name).toBe('explorer');
    expect(def.description).toBe('Read-only recon');
    expect(def.tools).toEqual(['read', 'grep', 'find', 'ls']);
    expect(def.model).toBe('default');
    expect(def.thinking).toBe('low');
    expect(def.systemPrompt).toBe('You are an explorer.');
  });

  it('does not let background frontmatter author a delegatable set', () => {
    const def = parseSubagentMarkdown(
      '---\nname: worker\ndescription: Write-capable test worker\ntools: write\ncanDelegate: explorer\n---\nBody.',
    );

    expect(def.canDelegate).toEqual([]);
  });

  it('defaults tools to empty, model to default, and thinking to medium', () => {
    const def = parseSubagentMarkdown('---\nname: projector\ndescription: One variant\n---\nBody.');
    expect(def.tools).toEqual([]);
    expect(def.model).toBe('default');
    expect(def.thinking).toBe('medium');
  });

  it('throws on a missing frontmatter block', () => {
    expect(() => parseSubagentMarkdown('no frontmatter here')).toThrow(/frontmatter/);
  });

  it('throws on an invalid thinking level', () => {
    expect(() => parseSubagentMarkdown('---\nname: x\ndescription: y\nthinking: turbo\n---\nBody.')).toThrow(
      /Invalid subagent frontmatter/,
    );
  });

  it('throws on duplicate frontmatter keys and reports the repeated key', () => {
    expect(() =>
      parseSubagentMarkdown('---\nname: explorer\ndescription: one\nname: duplicate\n---\nBody.'),
    ).toThrow(/duplicate frontmatter key "name"/);
  });

  it('throws on an empty body', () => {
    expect(() => parseSubagentMarkdown('---\nname: x\ndescription: y\n---\n')).toThrow(
      /empty system-prompt body/,
    );
  });
});

describe('loadSubagentDefinitions (bundled agents)', () => {
  it('loads only the explicit registry ids and ignores planted unlisted SYSTEM.md files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-subagent-registry-'));
    await writeFile(join(dir, 'explorer.md'), EXPLORER_MD);
    await writeFile(
      join(dir, 'ghost.md'),
      '---\nname: ghost\ndescription: Should not load\ntools: bash\n---\nYou should not see me.',
    );

    const definitions = await loadSubagentDefinitions(dir, ['explorer']);

    expect([...definitions.keys()]).toEqual(['explorer']);
    expect(definitions.has('ghost')).toBe(false);
  });

  it('loads the bundled worker from the code-owned registry', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());

    expect(definitions.get('worker')).toMatchObject({
      name: 'worker',
      tools: ['read', 'write_worktree_file'],
      canDelegate: [],
    });
  });
});

describe('subagent config', () => {
  it('validates version and maxConcurrency and tolerates a $comment', () => {
    const config = parseSubagentConfig({ $comment: 'docs', version: 1, maxConcurrency: 4 });
    expect(config).toEqual({ version: 1, maxConcurrency: 4 });
  });

  it('rejects a non-positive maxConcurrency', () => {
    expect(() => parseSubagentConfig({ version: 1, maxConcurrency: 0 })).toThrow(/Invalid subagent config/);
  });
});

describe('resolveSubagentModel', () => {
  const fakeModel = { provider: 'p', id: 'm' } as unknown as NonNullable<SubagentRunContext['model']>;

  it('inherits the parent current model for "default"', () => {
    const registry = {
      getAvailable: () => [],
      find: () => undefined,
    } as unknown as SubagentRunContext['modelRegistry'];
    const def = { name: 'x', model: 'default' } as SubagentDefinition;
    expect(resolveSubagentModel(def, { model: fakeModel, modelRegistry: registry })).toEqual({
      status: 'resolved',
      model: fakeModel,
    });
  });

  it('falls back to the first available model when there is no current model', () => {
    const registry = {
      getAvailable: () => [fakeModel],
      find: () => undefined,
    } as unknown as SubagentRunContext['modelRegistry'];
    const def = { name: 'x', model: 'default' } as SubagentDefinition;
    expect(resolveSubagentModel(def, { model: undefined, modelRegistry: registry })).toEqual({
      status: 'resolved',
      model: fakeModel,
    });
  });

  it('reports unresolved when no model is available for "default"', () => {
    const registry = {
      getAvailable: () => [],
      find: () => undefined,
    } as unknown as SubagentRunContext['modelRegistry'];
    const def = { name: 'x', model: 'default' } as SubagentDefinition;
    expect(resolveSubagentModel(def, { model: undefined, modelRegistry: registry }).status).toBe(
      'unresolved',
    );
  });

  it('looks up an explicit provider/model-id', () => {
    const registry = {
      getAvailable: () => [],
      find: (provider: string, id: string) =>
        provider === 'anthropic' && id === 'opus' ? fakeModel : undefined,
    } as unknown as SubagentRunContext['modelRegistry'];
    const def = { name: 'x', model: 'anthropic/opus' } as SubagentDefinition;
    expect(resolveSubagentModel(def, { model: undefined, modelRegistry: registry })).toEqual({
      status: 'resolved',
      model: fakeModel,
    });
  });

  it('reports unresolved for a malformed model string', () => {
    const registry = {
      getAvailable: () => [],
      find: () => undefined,
    } as unknown as SubagentRunContext['modelRegistry'];
    const def = { name: 'x', model: 'bogus' } as unknown as SubagentDefinition;
    expect(resolveSubagentModel(def, { model: undefined, modelRegistry: registry }).status).toBe(
      'unresolved',
    );
  });
});

describe('planSubagentTools', () => {
  it('exposes one shared catalog source for background tool grants', () => {
    expect([...createSubagentToolCatalog('/tmp').keys()].sort()).toEqual([
      'find',
      'grep',
      'ls',
      'read',
      'web_fetch',
      'web_search',
      'write_worktree_file',
    ]);
    expect([...createSubagentToolCatalog('/tmp', injectedWorld()).keys()].sort()).toEqual([
      'find',
      'grep',
      'ls',
      'read',
      'read_graph',
      'web_fetch',
      'web_search',
      'write_worktree_file',
    ]);
  });

  it('maps the worker to bounded worktree tools without shell or nesting', () => {
    const def = parseSubagentMarkdown(WORKER_MD);
    const plan = planSubagentTools(def, { cwd: '/tmp/worktree' });

    expect(plan.tools).toEqual(['read', 'write_worktree_file']);
    expect((plan.customTools ?? []).map((tool: ToolDefinition) => tool.name).sort()).toEqual([
      'read',
      'write_worktree_file',
    ]);
    expect((plan.customTools ?? []).map((tool: ToolDefinition) => tool.name)).not.toContain('bash');
    expect((plan.customTools ?? []).map((tool: ToolDefinition) => tool.name)).not.toContain('subagent');
  });

  it('maps read-only filesystem tools to a cwd-bound custom-tool allowlist', () => {
    const def = { name: 'explorer', tools: ['read', 'grep', 'find', 'ls'] } as unknown as SubagentDefinition;
    const plan = planSubagentTools(def, { cwd: '/tmp' });
    expect(plan.tools).toEqual(['read', 'grep', 'find', 'ls']);
    expect((plan.customTools ?? []).map((tool: ToolDefinition) => tool.name).sort()).toEqual([
      'find',
      'grep',
      'ls',
      'read',
    ]);
    expect(plan.noTools).toBeUndefined();
  });

  it('maps web tools for the researcher', () => {
    const def = { name: 'researcher', tools: ['web_search', 'web_fetch'] } as unknown as SubagentDefinition;
    const plan = planSubagentTools(def, { cwd: '/tmp' });
    expect((plan.customTools ?? []).map((tool: ToolDefinition) => tool.name).sort()).toEqual([
      'web_fetch',
      'web_search',
    ]);
  });

  it('maps read_graph only when parent graph readers are injected', () => {
    const def = { name: 'explorer', tools: ['read_graph'] } as unknown as SubagentDefinition;
    expect(() => planSubagentTools(def, { cwd: '/tmp' })).toThrow(/unknown tool/);
    const plan = planSubagentTools(def, { cwd: '/tmp' }, injectedWorld());
    expect((plan.customTools ?? []).map((tool: ToolDefinition) => tool.name)).toEqual(['read_graph']);
  });

  it('resolves a sovereign child grant that is outside the parent base tool policy', () => {
    const def = { name: 'explorer', tools: ['read_graph'] } as unknown as SubagentDefinition;

    const plan = planSubagentTools(def, { cwd: '/tmp' }, injectedWorld());

    expect(plan.tools).toEqual(['read_graph']);
    expect((plan.customTools ?? []).map((tool: ToolDefinition) => tool.name)).toEqual(['read_graph']);
  });

  it('uses noTools for a tool-less agent', () => {
    const def = { name: 'projector', tools: [] } as unknown as SubagentDefinition;
    expect(planSubagentTools(def, { cwd: '/tmp' })).toEqual({ noTools: 'all' });
  });

  it('throws on an unknown tool name', () => {
    const def = { name: 'rogue', tools: ['bash'] } as unknown as SubagentDefinition;
    expect(() => planSubagentTools(def, { cwd: '/tmp' })).toThrow(/unknown tool/);
  });
});

describe('createSemaphore', () => {
  it('bounds concurrency to the configured limit', async () => {
    const limit = createSemaphore(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      limit(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      });
    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBe(2);
  });

  it('does not admit a new arrival ahead of a released waiter', async () => {
    const limit = createSemaphore(1);
    let active = 0;
    let peak = 0;
    let releaseFirst!: () => void;
    const first = limit(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      active -= 1;
    });

    let secondStarted!: () => void;
    const secondStartedPromise = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const second = limit(async () => {
      active += 1;
      peak = Math.max(peak, active);
      secondStarted();
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
    });

    releaseFirst();
    const third = limit(async () => {
      active += 1;
      peak = Math.max(peak, active);
      active -= 1;
    });

    await secondStartedPromise;
    await Promise.all([first, second, third]);
    expect(peak).toBe(1);
  });
});

describe('registerBrunchSubagents', () => {
  const theme = {
    fg: (_kind: string, value: string) => value,
    bg: (_kind: string, value: string) => value,
    bold: (value: string) => value,
  };

  interface Renderable {
    render(width: number): string[];
  }

  function render(component: Renderable): string {
    return component.render(120).join('\n');
  }

  function renderCall(tool: ToolDefinition, params: unknown): string {
    if (!tool.renderCall) throw new Error('subagent tool is missing renderCall');
    return render(tool.renderCall(params as never, theme as never, {} as never));
  }

  function renderResult(
    tool: ToolDefinition,
    result: { content: { type: string; text?: string }[]; details?: unknown },
    options: { expanded: boolean; isPartial: boolean },
    context: { isError?: boolean } = {},
  ): string {
    if (!tool.renderResult) throw new Error('subagent tool is missing renderResult');
    return render(tool.renderResult(result as never, options, theme as never, context as never));
  }

  function harness(options: { delegatableAgents?: readonly string[] } = {}): {
    pi: ExtensionAPI;
    getTool: () => ToolDefinition;
    calls: Array<{ agent: string; task: string }>;
  } {
    const registered: ToolDefinition[] = [];
    const pi = { registerTool: (tool: ToolDefinition) => registered.push(tool) } as unknown as ExtensionAPI;
    const calls: Array<{ agent: string; task: string }> = [];
    const deps: BrunchSubagentsDeps = {
      definitions: new Map<string, SubagentDefinition>([
        ['explorer', parseSubagentMarkdown(EXPLORER_MD)],
        ['projector', parseSubagentMarkdown('---\nname: projector\ndescription: One variant\n---\nBody.')],
      ]),
      delegatableAgents: options.delegatableAgents ?? ['explorer', 'projector'],
      maxConcurrency: 2,
      agentDir: '/agent',
      createSettingsManager: () => SettingsManager.inMemory({ quietStartup: true }),
      resourceLoaderOptions: sealedResourceLoaderOptions(),
      runSubagent: async ({ definition, task }): Promise<SubagentResult> => {
        calls.push({ agent: definition.name, task });
        return { agent: definition.name, status: 'ok', text: `ran ${definition.name}: ${task}` };
      },
    };
    registerBrunchSubagents(pi, deps);
    return { pi, getTool: () => registered[0]!, calls };
  }

  const ctx = { cwd: '/w', modelRegistry: {}, model: undefined } as never;

  it('registers a single "subagent" tool', () => {
    const { getTool } = harness();
    expect(getTool().name).toBe(BRUNCH_SUBAGENT_TOOL);
  });

  it('covers both Brunch-owned provider schemas across foreground and sealed-child catalogs', () => {
    const tools = [harness().getTool(), createSubagentToolCatalog('/tmp').get('write_worktree_file')!];

    expect(tools.map((tool) => tool.name)).toEqual(['subagent', 'write_worktree_file']);
    for (const tool of tools) {
      expect(hasToolParametersProvenance(tool.parameters), `${tool.name} adapter provenance`).toBe(true);
      assertProviderLegalToolSchema(tool.parameters);
    }
  });

  it('renders single, parallel, and invalid call shapes with bounded task previews', () => {
    const { getTool } = harness();
    const tool = getTool();
    const longTask =
      'read the graph and inspect every likely reconciliation point before summarizing '.repeat(4);

    const single = renderCall(tool, { agent: 'explorer', task: longTask });
    expect(single).toContain('subagent');
    expect(single).toContain('explorer');
    expect(single).not.toContain(longTask);

    const parallel = renderCall(tool, {
      tasks: [
        { agent: 'explorer', task: 'map the touched files' },
        { agent: 'projector', task: 'propose a variant' },
      ],
    });
    expect(parallel).toContain('parallel (2)');
    expect(parallel).toContain('explorer');
    expect(parallel).toContain('projector');

    expect(renderCall(tool, {})).toContain('invalid shape');
  });

  it('renders subagent result summaries without dumping returned text while collapsed', () => {
    const { getTool } = harness();
    const tool = getTool();
    const result = {
      content: [{ type: 'text', text: 'FULL MODEL CONTEXT CROSS-BACK' }],
      details: {
        results: [
          { agent: 'explorer', status: 'ok', text: 'Explorer returned detailed findings.' },
          { agent: 'projector', status: 'error', text: 'Projector failed with details.' },
        ],
      },
    };

    const collapsed = renderResult(tool, result, { expanded: false, isPartial: false });
    expect(collapsed).toContain('1 ok, 1 error');
    expect(collapsed).toContain('explorer ok');
    expect(collapsed).toContain('projector error');
    expect(collapsed).not.toContain('Explorer returned detailed findings.');

    const expanded = renderResult(tool, result, { expanded: true, isPartial: false });
    expect(expanded).toContain('Explorer returned detailed findings.');
    expect(expanded).toContain('Projector failed with details.');
  });

  it('renders single-result, partial, and error states', () => {
    const { getTool } = harness();
    const tool = getTool();
    const result = {
      content: [{ type: 'text', text: 'Explorer detailed text.' }],
      details: { results: [{ agent: 'explorer', status: 'ok', text: 'Explorer detailed text.' }] },
    };

    expect(renderResult(tool, result, { expanded: false, isPartial: false })).toContain('explorer ok');
    expect(renderResult(tool, result, { expanded: false, isPartial: true })).toContain('Subagents running');
    expect(
      renderResult(
        tool,
        { content: [{ type: 'text', text: 'Subagent crashed' }], details: { results: [] } },
        { expanded: false, isPartial: false },
        { isError: true },
      ),
    ).toContain('Subagent crashed');
  });

  it('runs a single { agent, task } call', async () => {
    const { getTool, calls } = harness();
    const result = await getTool().execute(
      'id',
      { agent: 'explorer', task: 'find X' },
      undefined,
      undefined,
      ctx,
    );
    expect(calls).toEqual([{ agent: 'explorer', task: 'find X' }]);
    expect(result.content[0]).toEqual({ type: 'text', text: 'ran explorer: find X' });
  });

  it('fans out a { tasks: [...] } call', async () => {
    const { getTool } = harness();
    const result = await getTool().execute(
      'id',
      {
        tasks: [
          { agent: 'explorer', task: 'a' },
          { agent: 'projector', task: 'b' },
        ],
      },
      undefined,
      undefined,
      ctx,
    );
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('## explorer');
    expect(text).toContain('## projector');
  });

  it('returns an error result for an unknown agent', async () => {
    const { getTool } = harness();
    const result = await getTool().execute('id', { agent: 'ghost', task: 'x' }, undefined, undefined, ctx);
    expect((result.content[0] as { text: string }).text).toContain(
      'Subagent "ghost" is not available in this operational mode',
    );
  });

  it('advertises only the injected delegatable set', () => {
    const { getTool } = harness({ delegatableAgents: ['explorer'] });
    const tool = getTool();
    const serializedSchema = JSON.stringify(tool.parameters);

    expect(tool.description).toContain('explorer — Read-only recon');
    expect(tool.description).not.toContain('projector — One variant');
    expect(serializedSchema).toContain('explorer');
    expect(serializedSchema).not.toContain('projector');
  });

  it('refuses to execute a loaded definition outside the injected delegatable set', async () => {
    const { getTool, calls } = harness({ delegatableAgents: ['explorer'] });

    const result = await getTool().execute(
      'id',
      { agent: 'projector', task: 'should be refused' },
      undefined,
      undefined,
      ctx,
    );

    expect(calls).toEqual([]);
    expect((result.content[0] as { text: string }).text).toContain(
      'Subagent "projector" is not available in this operational mode',
    );
  });

  it('refuses the write-capable worker when it is loaded but not delegated by Specify mode', async () => {
    const writeCapable = parseSubagentMarkdown(WORKER_MD);
    const registered: ToolDefinition[] = [];
    const pi = { registerTool: (tool: ToolDefinition) => registered.push(tool) } as unknown as ExtensionAPI;
    const runSubagent = vi.fn(async ({ definition }): Promise<SubagentResult> => {
      return { agent: definition.name, status: 'ok', text: 'should not run' };
    });

    registerBrunchSubagents(pi, {
      definitions: new Map<string, SubagentDefinition>([
        ['explorer', parseSubagentMarkdown(EXPLORER_MD)],
        ['worker', writeCapable],
      ]),
      delegatableAgents: ['explorer'],
      maxConcurrency: 2,
      agentDir: '/agent',
      createSettingsManager: () => SettingsManager.inMemory({ quietStartup: true }),
      resourceLoaderOptions: sealedResourceLoaderOptions(),
      runSubagent,
    });

    const tool = registered[0]!;
    expect(tool.description).not.toContain('worker — Write-capable test worker');

    const result = await tool.execute('id', { agent: 'worker', task: 'write' }, undefined, undefined, ctx);

    expect(runSubagent).not.toHaveBeenCalled();
    expect((result.content[0] as { text: string }).text).toContain(
      'Subagent "worker" is not available in this operational mode',
    );
  });

  it('explains usage when neither agent nor tasks is provided', async () => {
    const { getTool } = harness();
    const result = await getTool().execute('id', {}, undefined, undefined, ctx);
    expect((result.content[0] as { text: string }).text).toContain('subagent requires');
  });

  it('treats combined single and parallel invocation shapes as a usage error', async () => {
    const { getTool, calls } = harness();
    const result = await getTool().execute(
      'id',
      { agent: 'explorer', task: 'single', tasks: [{ agent: 'projector', task: 'parallel' }] },
      undefined,
      undefined,
      ctx,
    );
    expect(calls).toEqual([]);
    expect((result.content[0] as { text: string }).text).toContain(
      'subagent accepts either { agent, task } or { tasks: [...] }, not both',
    );
  });
});

describe('runSubagent (sealed SDK child session over a faux provider)', () => {
  interface FauxRig {
    readonly ctx: SubagentRunContext;
    readonly deps: SubagentSealedDeps;
    readonly captured: {
      systemPrompt?: string;
      toolNames: string[];
      messages: string;
      systemPrompts: string[];
      toolNamesByTurn: string[][];
      messagesByTurn: string[];
    };
    dispose(): void;
  }

  async function fauxRig(
    replies: string | Array<string | ((context: Context) => ReturnType<typeof fauxAssistantMessage>)>,
  ): Promise<FauxRig> {
    const model = defaultBrunchFauxModel();
    const provider = registerFauxProvider({
      provider: model.provider,
      api: `${model.api}-faux-source`,
      models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
    });
    const captured: FauxRig['captured'] = {
      toolNames: [],
      messages: '',
      systemPrompts: [],
      toolNamesByTurn: [],
      messagesByTurn: [],
    };
    const responseList = Array.isArray(replies) ? replies : [replies];
    provider.setResponses(
      responseList.map((reply) => (context: Context) => {
        captured.systemPrompt = context.systemPrompt ?? '';
        captured.toolNames = (context.tools ?? []).map((tool) => tool.name);
        captured.messages = JSON.stringify(context.messages);
        captured.systemPrompts.push(captured.systemPrompt);
        captured.toolNamesByTurn.push(captured.toolNames);
        captured.messagesByTurn.push(captured.messages);
        return typeof reply === 'function' ? reply(context) : fauxAssistantMessage(reply);
      }),
    );
    const authStorage = AuthStorage.inMemory({
      [model.provider]: { type: 'api_key', key: BRUNCH_FAUX_HARNESS_API_KEY },
    });
    const modelRegistry = ModelRegistry.inMemory(authStorage);
    modelRegistry.registerProvider(
      model.provider,
      brunchFauxProviderConfig(model, provider, BRUNCH_FAUX_HARNESS_API_KEY),
    );
    const registeredModel = modelRegistry.find(model.provider, model.modelId);
    if (!registeredModel) throw new Error('faux model not registered');
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-subagent-cwd-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-subagent-agent-'));

    return {
      ctx: { cwd, modelRegistry, model: registeredModel, signal: undefined },
      deps: {
        agentDir,
        createSettingsManager: () => SettingsManager.inMemory({ quietStartup: true }),
        resourceLoaderOptions: sealedResourceLoaderOptions(),
      },
      captured,
      dispose: () => provider.unregister(),
    };
  }

  it('locks the assembled explorer background prompt shape', async () => {
    const def = parseSubagentMarkdown(EXPLORER_MD);
    const rendered = composeBackgroundSubagentPrompt({
      definition: def,
      world: injectedWorld({ cwd: '/work/brunch-subagent' }).snapshot,
    }).prompt;

    const normalizedRendered = rendered.replaceAll(packageRoot, '<PKG>');

    await expect(normalizedRendered).toMatchFileSnapshot('../__snapshots__/subagent-explorer-prompt.md');
    expect(rendered).toContain('You are an explorer.');
    expect(rendered).toContain('[Brunch background subagent control]');
    expect(rendered).toContain('[Brunch injected world snapshot]');
    expect(rendered).toContain('[Brunch background routing]');
    expect(rendered).not.toContain('[Brunch elicitation recommendation]');
    expect(rendered).not.toContain('Current prompt-resource selection');
    expect(rendered).toContain('ambient Pi resources: sealed out');
  });

  it('runs a tool-less projector, owning the system prompt and returning its output', async () => {
    const rig = await fauxRig('PROPOSED VARIANT');
    try {
      const definition = parseSubagentMarkdown(
        '---\nname: projector\ndescription: One variant\nthinking: medium\n---\nYou are a projector. Emit one variant.',
      );
      const result = await runSubagent({
        definition,
        task: 'Propose a name for the widget.',
        ctx: rig.ctx,
        deps: rig.deps,
      });
      expect(result).toEqual({ agent: 'projector', status: 'ok', text: 'PROPOSED VARIANT' });
      // Sealing: the child system prompt is assembled from the agent body, not Pi's coding base.
      expect(rig.captured.systemPrompt).toContain('You are a projector. Emit one variant.');
      expect(rig.captured.systemPrompt).toContain('[Brunch background subagent control]');
      expect(rig.captured.systemPrompt).not.toContain('[Brunch elicitation recommendation]');
      expect(rig.captured.systemPrompt).not.toContain('coding agent');
      // No tools for a projector.
      expect(rig.captured.toolNames).toEqual([]);
      // The task is delivered as the (only) conversational input.
      expect(rig.captured.messages).toContain('Propose a name for the widget.');
    } finally {
      rig.dispose();
    }
  });

  it('advertises exactly the explorer tool allowlist to the model', async () => {
    const rig = await fauxRig('done');
    try {
      const result = await runSubagent({
        definition: parseSubagentMarkdown(EXPLORER_MD),
        task: 'Where is the auth code?',
        ctx: rig.ctx,
        deps: rig.deps,
      });
      expect(result.status).toBe('ok');
      expect([...rig.captured.toolNames].sort()).toEqual(['find', 'grep', 'ls', 'read']);
    } finally {
      rig.dispose();
    }
  });

  it('assembles injected parent-world context and reads the parent graph through read_graph', async () => {
    const rig = await fauxRig([
      () =>
        fauxAssistantMessage([fauxToolCall('read_graph', { mode: 'overview' }, { id: 'read_graph_call' })], {
          stopReason: 'toolUse',
        }),
      'Graph read complete.',
    ]);
    try {
      const result = await runSubagent({
        definition: parseSubagentMarkdown(
          '---\nname: explorer\ndescription: Parent graph recon\ntools: read_graph\nthinking: low\n---\nUse the parent graph.',
        ),
        task: 'Read the selected spec graph.',
        ctx: rig.ctx,
        deps: { ...rig.deps, injectedWorld: injectedWorld({ cwd: rig.ctx.cwd }) },
      });

      expect(result).toEqual({ agent: 'explorer', status: 'ok', text: 'Graph read complete.' });
      expect(rig.captured.systemPrompts[0]).toContain('[Brunch injected world snapshot]');
      expect(rig.captured.systemPrompts[0]).toContain('Parent Spec (#7)');
      expect(rig.captured.systemPrompts[0]).toContain('user asked for graph reconciliation');
      expect(rig.captured.systemPrompts[0]).not.toContain('Sibling-only goal');
      expect(rig.captured.systemPrompts[0]).toContain('the graph itself is not baked into this prompt');
      expect(rig.captured.toolNamesByTurn[0]).toEqual(['read_graph']);
      expect(rig.captured.messagesByTurn[1]).toContain('Parent-only goal');
      expect(rig.captured.messagesByTurn[1]).not.toContain('Sibling-only goal');
    } finally {
      rig.dispose();
    }
  });

  it('does not prompt when the parent aborts during child setup', async () => {
    const definition = parseSubagentMarkdown(EXPLORER_MD);
    const controller = new AbortController();
    const prompt = vi.fn(async () => undefined);
    const abort = vi.fn();
    const dispose = vi.fn();
    const createServices = vi.fn(async () => ({})) as never;
    const createSession = vi.fn(async () => {
      controller.abort();
      return {
        session: {
          prompt,
          abort,
          dispose,
          getLastAssistantText: () => 'should not be read',
        },
      };
    }) as never;
    const registry = { getAvailable: () => [{ provider: 'p', id: 'm' }], find: () => undefined } as never;

    const result = await runSubagent({
      definition,
      task: 'will abort',
      ctx: { cwd: '/w', modelRegistry: registry, model: undefined, signal: controller.signal },
      deps: {
        agentDir: '/agents',
        createSettingsManager: () => SettingsManager.inMemory({ quietStartup: true }),
        resourceLoaderOptions: sealedResourceLoaderOptions(),
      },
      createServices,
      createSession,
    });

    expect(result).toEqual({ agent: 'explorer', status: 'error', text: 'Subagent "explorer" was aborted.' });
    expect(prompt).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('aborts and disposes an already-created child session when the parent aborts', async () => {
    const definition = parseSubagentMarkdown(EXPLORER_MD);
    const controller = new AbortController();
    const abort = vi.fn();
    const dispose = vi.fn();
    let promptStarted!: () => void;
    const promptStartedPromise = new Promise<void>((resolve) => {
      promptStarted = resolve;
    });
    const prompt = vi.fn(async () => {
      promptStarted();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const createSession = vi.fn(async () => ({
      session: {
        prompt,
        abort,
        dispose,
        getLastAssistantText: () => 'done',
      },
    })) as never;
    const registry = { getAvailable: () => [{ provider: 'p', id: 'm' }], find: () => undefined } as never;

    const running = runSubagent({
      definition,
      task: 'run',
      ctx: { cwd: '/w', modelRegistry: registry, model: undefined, signal: controller.signal },
      deps: {
        agentDir: '/agents',
        createSettingsManager: () => SettingsManager.inMemory({ quietStartup: true }),
        resourceLoaderOptions: sealedResourceLoaderOptions(),
      },
      createServices: vi.fn(async () => ({})) as never,
      createSession,
    });
    await promptStartedPromise;
    controller.abort();

    await expect(running).resolves.toEqual({ agent: 'explorer', status: 'ok', text: 'done' });
    expect(abort).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
  });
});

function injectedWorld(options: { cwd?: string } = {}): NonNullable<SubagentSealedDeps['injectedWorld']> {
  const parentGraph = graphSlice('Parent-only goal', 7);
  const siblingGraph = graphSlice('Sibling-only goal', 8);
  void siblingGraph;
  const reads: GraphReaders = {
    queryGraph: () => parentGraph,
    getNodes: () => [],
    resolveNodeCode: () => undefined,
    getOpenReconciliationNeeds: () => [],
    latestLsn: () => parentGraph.lsn,
  };
  return {
    snapshot: {
      spec: { id: 7, name: 'Parent Spec' },
      workspace: { cwd: options.cwd ?? '/workspace' },
      session: { id: 'session-7', label: 'Grounding' },
      scratchpad: [],
      sessionDigest: '- user asked for graph reconciliation',
    },
    graph: { specId: 7, reads },
  };
}

function graphSlice(title: string, specId: number): GraphSlice {
  return {
    lsn: specId,
    nodes: [
      {
        id: specId,
        specId,
        plane: 'intent',
        kind: 'goal',
        kindOrdinal: 1,
        title,
        basis: 'explicit',
        settlement: 'settled',
        createdAtLsn: specId,
        updatedAtLsn: specId,
      },
    ],
    edges: [],
  };
}
