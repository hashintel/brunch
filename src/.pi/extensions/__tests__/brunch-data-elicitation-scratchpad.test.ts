import { describe, expect, it } from 'vitest';

import {
  appendElicitationScratchpadSnapshot,
  BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE,
  type ElicitationScratchpadEntryData,
  type ElicitationScratchpadItem,
} from '../../../session/elicitation-scratchpad.js';
import {
  READ_ELICITATION_SCRATCHPAD_TOOL,
  registerBrunchElicitationScratchpad,
  UPDATE_ELICITATION_SCRATCHPAD_TOOL,
} from '../brunch-data/elicitation/index.js';
import { scratchpadToolSchemaBaseline } from './fixtures/scratchpad-tool-schemas.pre-fe-1163.js';
import { normalizeToolSchema } from './tool-schema-baseline.js';

class FakeSessionManager {
  entries: Array<{ type: 'custom'; customType: string; data: unknown }> = [];
  abandoned: Array<{ type: 'custom'; customType: string; data: unknown }> = [];

  getBranch() {
    return this.entries;
  }

  getEntries() {
    return [...this.entries, ...this.abandoned];
  }

  appendCustomEntry(customType: string, data: ElicitationScratchpadEntryData) {
    this.entries.push({ type: 'custom', customType, data });
  }
}

type ScratchpadTool = {
  parameters: unknown;
  renderShell?: string;
  renderCall?: unknown;
  renderResult?: unknown;
  execute: (...args: never[]) => Promise<unknown>;
};

function collectScratchpadTools() {
  const tools = new Map<string, ScratchpadTool>();
  registerBrunchElicitationScratchpad({
    registerTool(tool: { name: string } & ScratchpadTool) {
      tools.set(tool.name, tool);
    },
  } as never);
  return tools;
}

async function executeTool(
  name: string,
  params: Record<string, unknown>,
  sessionManager?: FakeSessionManager,
) {
  const tools = collectScratchpadTools();
  const tool = tools.get(name)!;
  return tool.execute(
    'call-1' as never,
    params as never,
    undefined as never,
    undefined as never,
    (sessionManager ? { sessionManager } : undefined) as never,
  );
}

describe('read_elicitation_scratchpad', () => {
  it('adopts the shared Brunch default renderer for both scratchpad tools', () => {
    const tools = collectScratchpadTools();

    expect([...tools.keys()]).toEqual([READ_ELICITATION_SCRATCHPAD_TOOL, UPDATE_ELICITATION_SCRATCHPAD_TOOL]);
    for (const [name, tool] of tools) {
      expect(tool.renderShell, name).toBe('self');
      expect(tool.renderCall, name).toEqual(expect.any(Function));
      expect(tool.renderResult, name).toEqual(expect.any(Function));
    }
  });

  it('preserves the pre-FE-1163 provider-facing family schema semantics', () => {
    const schemas = Object.fromEntries(
      [...collectScratchpadTools()].map(([name, tool]) => [name, tool.parameters]),
    );

    expect(Object.keys(schemas)).toEqual(Object.keys(scratchpadToolSchemaBaseline.schemas));
    expect(normalizeToolSchema(schemas)).toEqual(normalizeToolSchema(scratchpadToolSchemaBaseline.schemas));
  });

  it('reports an empty scratchpad reconstructed from an empty branch', async () => {
    const sessionManager = new FakeSessionManager();
    const result = (await executeTool(READ_ELICITATION_SCRATCHPAD_TOOL, {}, sessionManager)) as {
      details: { items: readonly ElicitationScratchpadItem[] };
      content: readonly { text: string }[];
    };

    expect(result.details.items).toEqual([]);
    expect(result.content[0]!.text).toContain('empty');
  });

  it('renders each item id in the tool content text, since update requires it and details is not the read surface', async () => {
    const sessionManager = new FakeSessionManager();
    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about budget', disposition: 'open' },
    ]);

    const result = (await executeTool(READ_ELICITATION_SCRATCHPAD_TOOL, {}, sessionManager)) as {
      content: readonly { text: string }[];
    };

    expect(result.content[0]!.text).toContain('id=a');
  });

  it('reconstructs the current scratchpad from prior appended snapshots on the branch, not from tool-result details', async () => {
    const sessionManager = new FakeSessionManager();
    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about budget', disposition: 'open' },
    ]);

    sessionManager.abandoned.push({
      type: 'custom',
      customType: BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE,
      data: {
        schemaVersion: 1,
        items: [{ id: 'rival', obligation: 'abandoned obligation', disposition: 'open' }],
      },
    });
    const result = (await executeTool(READ_ELICITATION_SCRATCHPAD_TOOL, {}, sessionManager)) as {
      details: { items: readonly ElicitationScratchpadItem[] };
    };

    expect(result.details.items).toEqual([{ id: 'a', obligation: 'ask about budget', disposition: 'open' }]);
  });

  it('ignores runtime-state entries of a different custom type', async () => {
    const sessionManager = new FakeSessionManager();
    sessionManager.appendCustomEntry('brunch.agent_runtime_state', { schemaVersion: 1 } as never);

    const result = (await executeTool(READ_ELICITATION_SCRATCHPAD_TOOL, {}, sessionManager)) as {
      details: { items: readonly ElicitationScratchpadItem[] };
    };

    expect(result.details.items).toEqual([]);
  });
});

describe('update_elicitation_scratchpad', () => {
  it('add appends a new open obligation as a branch entry the read tool then sees', async () => {
    const sessionManager = new FakeSessionManager();

    await executeTool(
      UPDATE_ELICITATION_SCRATCHPAD_TOOL,
      { operation: 'add', id: 'a', obligation: 'ask about budget' },
      sessionManager,
    );

    expect(sessionManager.entries).toHaveLength(1);
    expect(sessionManager.entries[0]!.customType).toBe(BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE);

    const read = (await executeTool(READ_ELICITATION_SCRATCHPAD_TOOL, {}, sessionManager)) as {
      details: { items: readonly ElicitationScratchpadItem[] };
    };
    expect(read.details.items).toEqual([{ id: 'a', obligation: 'ask about budget', disposition: 'open' }]);
  });

  it('resolve marks an existing obligation resolved via a new full-replacement snapshot', async () => {
    const sessionManager = new FakeSessionManager();
    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about budget', disposition: 'open' },
    ]);

    await executeTool(UPDATE_ELICITATION_SCRATCHPAD_TOOL, { operation: 'resolve', id: 'a' }, sessionManager);

    expect(sessionManager.entries).toHaveLength(2);
    const read = (await executeTool(READ_ELICITATION_SCRATCHPAD_TOOL, {}, sessionManager)) as {
      details: { items: readonly ElicitationScratchpadItem[] };
    };
    expect(read.details.items).toEqual([
      { id: 'a', obligation: 'ask about budget', disposition: 'resolved' },
    ]);
  });

  it('update edits obligation text without changing disposition', async () => {
    const sessionManager = new FakeSessionManager();
    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about budget', disposition: 'open' },
    ]);

    await executeTool(
      UPDATE_ELICITATION_SCRATCHPAD_TOOL,
      { operation: 'update', id: 'a', obligation: 'ask about the budget ceiling' },
      sessionManager,
    );

    const read = (await executeTool(READ_ELICITATION_SCRATCHPAD_TOOL, {}, sessionManager)) as {
      details: { items: readonly ElicitationScratchpadItem[] };
    };
    expect(read.details.items).toEqual([
      { id: 'a', obligation: 'ask about the budget ceiling', disposition: 'open' },
    ]);
  });

  it('returns structural_illegal and writes nothing when add is missing required fields', async () => {
    const sessionManager = new FakeSessionManager();

    const result = (await executeTool(
      UPDATE_ELICITATION_SCRATCHPAD_TOOL,
      { operation: 'add' },
      sessionManager,
    )) as { details: { status: string } };

    expect(result.details.status).toBe('structural_illegal');
    expect(sessionManager.entries).toHaveLength(0);
  });

  it('returns structural_illegal and writes nothing when resolving an unknown id', async () => {
    const sessionManager = new FakeSessionManager();

    const result = (await executeTool(
      UPDATE_ELICITATION_SCRATCHPAD_TOOL,
      { operation: 'resolve', id: 'missing' },
      sessionManager,
    )) as { details: { status: string } };

    expect(result.details.status).toBe('structural_illegal');
    expect(sessionManager.entries).toHaveLength(0);
  });

  it('returns structural_illegal and writes nothing when resolve omits id', async () => {
    const sessionManager = new FakeSessionManager();

    const result = (await executeTool(
      UPDATE_ELICITATION_SCRATCHPAD_TOOL,
      { operation: 'resolve' },
      sessionManager,
    )) as { details: { status: string; diagnostics: readonly { field: string }[] } };

    expect(result.details.status).toBe('structural_illegal');
    expect(result.details.diagnostics).toContainEqual(expect.objectContaining({ field: 'id' }));
    expect(sessionManager.entries).toHaveLength(0);
  });

  it('returns structural_illegal and writes nothing when update omits id', async () => {
    const sessionManager = new FakeSessionManager();
    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about budget', disposition: 'open' },
    ]);

    const result = (await executeTool(
      UPDATE_ELICITATION_SCRATCHPAD_TOOL,
      { operation: 'update', obligation: 'ask about timeline' },
      sessionManager,
    )) as { details: { status: string; diagnostics: readonly { field: string }[] } };

    expect(result.details.status).toBe('structural_illegal');
    expect(result.details.diagnostics).toContainEqual(expect.objectContaining({ field: 'id' }));
    expect(sessionManager.entries).toHaveLength(1);
  });

  it('returns structural_illegal and writes nothing when update supplies an empty obligation', async () => {
    const sessionManager = new FakeSessionManager();
    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about budget', disposition: 'open' },
    ]);

    const result = (await executeTool(
      UPDATE_ELICITATION_SCRATCHPAD_TOOL,
      { operation: 'update', id: 'a', obligation: '' },
      sessionManager,
    )) as { details: { status: string; diagnostics: readonly { field: string }[] } };

    expect(result.details.status).toBe('structural_illegal');
    expect(result.details.diagnostics).toContainEqual(expect.objectContaining({ field: 'obligation' }));
    expect(sessionManager.entries).toHaveLength(1);
  });

  it('returns structural_illegal when the session manager cannot append custom entries', async () => {
    const result = await executeTool(UPDATE_ELICITATION_SCRATCHPAD_TOOL, {
      operation: 'add',
      id: 'a',
      obligation: 'ask about budget',
    });

    expect((result as { details: { status: string } }).details.status).toBe('structural_illegal');
  });
});
