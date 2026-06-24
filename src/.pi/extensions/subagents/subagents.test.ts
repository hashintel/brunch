import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, registerFauxProvider, type Context } from '@earendil-works/pi-ai';
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  type CreateAgentSessionServicesOptions,
  type ExtensionAPI,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';

import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
} from '../../../probes/faux-provider.js';
import {
  loadSubagentDefinitions,
  parseSubagentMarkdown,
  subagentAgentsDir,
  type SubagentDefinition,
} from './agents.js';
import { loadSubagentConfig, parseSubagentConfig, subagentConfigPath } from './config.js';
import {
  BRUNCH_SUBAGENT_TOOL,
  createSemaphore,
  registerBrunchSubagents,
  type BrunchSubagentsDeps,
} from './index.js';
import {
  planSubagentTools,
  resolveSubagentModel,
  runSubagent,
  type SubagentResult,
  type SubagentRunContext,
  type SubagentSealedDeps,
} from './session.js';

const SCOUT_MD = `---
name: scout
description: Read-only recon
tools: read, grep, find, ls
model: default
thinking: low
---

You are a scout.
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
    const def = parseSubagentMarkdown(SCOUT_MD);
    expect(def.name).toBe('scout');
    expect(def.description).toBe('Read-only recon');
    expect(def.tools).toEqual(['read', 'grep', 'find', 'ls']);
    expect(def.model).toBe('default');
    expect(def.thinking).toBe('low');
    expect(def.systemPrompt).toBe('You are a scout.');
  });

  it('defaults tools to empty, model to default, and thinking to medium', () => {
    const def = parseSubagentMarkdown('---\nname: proposer\ndescription: One variant\n---\nBody.');
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
      parseSubagentMarkdown('---\nname: scout\ndescription: one\nname: duplicate\n---\nBody.'),
    ).toThrow(/duplicate frontmatter key "name"/);
  });

  it('throws on an empty body', () => {
    expect(() => parseSubagentMarkdown('---\nname: x\ndescription: y\n---\n')).toThrow(
      /empty system-prompt body/,
    );
  });
});

describe('loadSubagentDefinitions (bundled agents)', () => {
  it('loads the scout, researcher, and proposer starter agents', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    expect([...definitions.keys()].sort()).toEqual(['proposer', 'researcher', 'scout']);
    expect(definitions.get('scout')?.tools).toEqual(['read', 'grep', 'find', 'ls']);
    expect(definitions.get('researcher')?.tools).toEqual(['web_search', 'web_fetch']);
    expect(definitions.get('proposer')?.tools).toEqual([]);
  });

  it('loads only the explicit registry ids and ignores planted unlisted markdown files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-subagent-registry-'));
    await writeFile(join(dir, 'scout.md'), SCOUT_MD);
    await writeFile(
      join(dir, 'ghost.md'),
      '---\nname: ghost\ndescription: Should not load\ntools: bash\n---\nYou should not see me.',
    );

    const definitions = await loadSubagentDefinitions(dir, ['scout']);

    expect([...definitions.keys()]).toEqual(['scout']);
    expect(definitions.has('ghost')).toBe(false);
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

  it('loads the bundled config.json', async () => {
    const config = await loadSubagentConfig(subagentConfigPath());
    expect(config.version).toBeGreaterThanOrEqual(1);
    expect(config.maxConcurrency).toBeGreaterThanOrEqual(1);
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
  it('maps read-only filesystem tools to a cwd-bound custom-tool allowlist', () => {
    const def = { name: 'scout', tools: ['read', 'grep', 'find', 'ls'] } as unknown as SubagentDefinition;
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

  it('uses noTools for a tool-less agent', () => {
    const def = { name: 'proposer', tools: [] } as unknown as SubagentDefinition;
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
  function harness(): {
    pi: ExtensionAPI;
    getTool: () => ToolDefinition;
    calls: Array<{ agent: string; task: string }>;
  } {
    const registered: ToolDefinition[] = [];
    const pi = { registerTool: (tool: ToolDefinition) => registered.push(tool) } as unknown as ExtensionAPI;
    const calls: Array<{ agent: string; task: string }> = [];
    const deps: BrunchSubagentsDeps = {
      definitions: new Map<string, SubagentDefinition>([
        ['scout', parseSubagentMarkdown(SCOUT_MD)],
        ['proposer', parseSubagentMarkdown('---\nname: proposer\ndescription: One variant\n---\nBody.')],
      ]),
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

  it('runs a single { agent, task } call', async () => {
    const { getTool, calls } = harness();
    const result = await getTool().execute(
      'id',
      { agent: 'scout', task: 'find X' },
      undefined,
      undefined,
      ctx,
    );
    expect(calls).toEqual([{ agent: 'scout', task: 'find X' }]);
    expect(result.content[0]).toEqual({ type: 'text', text: 'ran scout: find X' });
  });

  it('fans out a { tasks: [...] } call', async () => {
    const { getTool } = harness();
    const result = await getTool().execute(
      'id',
      {
        tasks: [
          { agent: 'scout', task: 'a' },
          { agent: 'proposer', task: 'b' },
        ],
      },
      undefined,
      undefined,
      ctx,
    );
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('## scout');
    expect(text).toContain('## proposer');
  });

  it('returns an error result for an unknown agent', async () => {
    const { getTool } = harness();
    const result = await getTool().execute('id', { agent: 'ghost', task: 'x' }, undefined, undefined, ctx);
    expect((result.content[0] as { text: string }).text).toContain('Unknown subagent "ghost"');
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
      { agent: 'scout', task: 'single', tasks: [{ agent: 'proposer', task: 'parallel' }] },
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
    readonly captured: { systemPrompt?: string; toolNames: string[]; messages: string };
    dispose(): void;
  }

  async function fauxRig(reply: string): Promise<FauxRig> {
    const model = defaultBrunchFauxModel();
    const provider = registerFauxProvider({
      provider: model.provider,
      api: `${model.api}-faux-source`,
      models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
    });
    const captured: FauxRig['captured'] = { toolNames: [], messages: '' };
    provider.setResponses([
      (context: Context) => {
        captured.systemPrompt = context.systemPrompt;
        captured.toolNames = (context.tools ?? []).map((tool) => tool.name);
        captured.messages = JSON.stringify(context.messages);
        return fauxAssistantMessage(reply);
      },
    ]);
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

  it('runs a tool-less proposer, owning the system prompt and returning its output', async () => {
    const rig = await fauxRig('PROPOSED VARIANT');
    try {
      const definition = parseSubagentMarkdown(
        '---\nname: proposer\ndescription: One variant\nthinking: medium\n---\nYou are a proposer. Emit one variant.',
      );
      const result = await runSubagent({
        definition,
        task: 'Propose a name for the widget.',
        ctx: rig.ctx,
        deps: rig.deps,
      });
      expect(result).toEqual({ agent: 'proposer', status: 'ok', text: 'PROPOSED VARIANT' });
      // Sealing: the child system prompt IS the agent body (not pi's coding base).
      expect(rig.captured.systemPrompt).toContain('You are a proposer. Emit one variant.');
      expect(rig.captured.systemPrompt).not.toContain('coding agent');
      // No tools for a proposer.
      expect(rig.captured.toolNames).toEqual([]);
      // The task is delivered as the (only) conversational input.
      expect(rig.captured.messages).toContain('Propose a name for the widget.');
    } finally {
      rig.dispose();
    }
  });

  it('advertises exactly the scout tool allowlist to the model', async () => {
    const rig = await fauxRig('done');
    try {
      const result = await runSubagent({
        definition: parseSubagentMarkdown(SCOUT_MD),
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

  it('does not prompt when the parent aborts during child setup', async () => {
    const definition = parseSubagentMarkdown(SCOUT_MD);
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

    expect(result).toEqual({ agent: 'scout', status: 'error', text: 'Subagent "scout" was aborted.' });
    expect(prompt).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('aborts and disposes an already-created child session when the parent aborts', async () => {
    const definition = parseSubagentMarkdown(SCOUT_MD);
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

    await expect(running).resolves.toEqual({ agent: 'scout', status: 'ok', text: 'done' });
    expect(abort).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
