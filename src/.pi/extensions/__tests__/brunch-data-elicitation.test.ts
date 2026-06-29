import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema.js';
import { sortElicitationGapsForAsking } from '../../../graph/elicitation-driver.js';
import type { ElicitationGap } from '../../../graph/index.js';
import { CommandExecutor, getElicitationGaps } from '../../../graph/index.js';
import {
  READ_ELICITATION_GAPS_TOOL,
  registerBrunchElicitation,
  UPDATE_ELICITATION_GAPS_TOOL,
} from '../brunch-data/elicitation/index.js';

function gap(overrides: Partial<ElicitationGap> & { id: string }): ElicitationGap {
  return {
    specId: 7,
    refersTo: 'goal',
    question: `question for ${overrides.id}`,
    rationale: `rationale for ${overrides.id}`,
    basis: 'explicit',
    band: 'grounding',
    predicate: { kind: 'presence', nodeKind: 'goal', minimum: 1 },
    importance: 1,
    coverage: 0,
    answered: false,
    disposition: 'open',
    createdAtLsn: 1,
    ...overrides,
  };
}

const seededGaps: readonly ElicitationGap[] = [
  // deliberately unordered: lower importance first, answered noise interleaved
  gap({ id: 'g-low', importance: 1, band: 'elicitation', question: 'low priority?' }),
  gap({ id: 'g-answered', answered: true, disposition: 'answered', question: 'already answered?' }),
  gap({ id: 'g-top', importance: 9, band: 'grounding', question: 'top priority?' }),
  gap({ id: 'g-irrelevant', disposition: 'irrelevant', question: 'judged irrelevant?' }),
  gap({ id: 'g-second', importance: 3, band: 'grounding', question: 'second priority?' }),
];

function collectElicitationTool() {
  const tools = new Map<string, { execute: (...args: never[]) => Promise<unknown> }>();
  registerBrunchElicitation(
    {
      registerTool(tool: { name: string; execute: (...args: never[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never,
    {
      specId: 7,
      commandExecutor: {} as never,
      reads: { getElicitationGaps: () => seededGaps, resolveNodeCode: () => undefined },
    },
  );
  return tools;
}

async function executeTool(params: Record<string, unknown>, gaps: readonly ElicitationGap[] = seededGaps) {
  const tools = new Map<string, { execute: (...args: never[]) => Promise<unknown> }>();
  registerBrunchElicitation(
    {
      registerTool(tool: { name: string; execute: (...args: never[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never,
    {
      specId: 7,
      commandExecutor: {} as never,
      reads: { getElicitationGaps: () => gaps, resolveNodeCode: () => undefined },
    },
  );
  return (await tools.get(READ_ELICITATION_GAPS_TOOL)!.execute('call-1' as never, params as never)) as {
    content: Array<{ type: 'text'; text: string }>;
    details: { agenda: readonly ElicitationGap[]; others?: readonly ElicitationGap[] };
  };
}

describe('read_elicitation_gaps', () => {
  it('registers both register tools under their canonical names', () => {
    expect([...collectElicitationTool().keys()]).toEqual([
      READ_ELICITATION_GAPS_TOOL,
      UPDATE_ELICITATION_GAPS_TOOL,
    ]);
  });

  it('returns the ranked eligible agenda in canonical comparator order', async () => {
    const result = await executeTool({});

    // one ranking implementation: tool order must equal the driver's order
    expect(result.details.agenda.map((entry) => entry.id)).toEqual(
      sortElicitationGapsForAsking(seededGaps).map((entry) => entry.id),
    );
    expect(result.details.agenda.map((entry) => entry.id)).toEqual(['g-top', 'g-second', 'g-low']);
    expect(result.details.others).toBeUndefined();

    const text = result.content[0]!.text;
    expect(text.indexOf('top priority?')).toBeLessThan(text.indexOf('second priority?'));
    expect(text.indexOf('second priority?')).toBeLessThan(text.indexOf('low priority?'));
    expect(text).not.toContain('already answered?');
  });

  it("include 'all' also reports non-eligible gaps with their disposition state", async () => {
    const result = await executeTool({ include: 'all' });

    expect(result.details.others?.map((entry) => entry.id)).toEqual(['g-answered', 'g-irrelevant']);
    const text = result.content[0]!.text;
    expect(text).toContain('already answered?');
    expect(text).toContain('answered');
    expect(text).toContain('irrelevant');
  });

  it('reports an honest empty agenda for an empty register', async () => {
    const result = await executeTool({}, []);

    expect(result.details.agenda).toEqual([]);
    expect(result.content[0]!.text).toContain('No elicitation gaps');
  });
});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details: Record<string, unknown>;
}

function realExecutorHarness() {
  const db = createDb(':memory:');
  const executor = new CommandExecutor(db);
  const spec = executor.createSpec({ name: 'Writeback spec', slug: 'writeback-spec' });
  if (spec.status !== 'success') throw new Error('spec creation failed');
  const specId = spec.specId;

  const tools = new Map<string, { execute: (...args: never[]) => Promise<unknown> }>();
  registerBrunchElicitation(
    {
      registerTool(tool: { name: string; execute: (...args: never[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never,
    {
      specId,
      commandExecutor: executor,
      reads: {
        getElicitationGaps: (id: number) => getElicitationGaps(db, id),
        resolveNodeCode: () => undefined,
      },
    },
  );

  const call = async (toolName: string, params: Record<string, unknown>) =>
    (await tools.get(toolName)!.execute('call-1' as never, params as never)) as ToolResult;

  return { db, executor, specId, call };
}

// createSpec seeds the grounding-floor gaps, so the register starts
// populated; spawn a manually-judged gap to avoid colliding with the
// floor's presence predicates, and assert relative to the baseline.
function spawnParams(overrides: Record<string, unknown> = {}) {
  return {
    action: 'spawn',
    refersTo: 'constraint',
    question: 'What latency budget constrains the design?',
    rationale: 'Capture-reflection revealed an unstated constraint.',
    band: 'grounding',
    importance: 99,
    manualRubric: 'Judge whether a concrete latency budget has been stated.',
    ...overrides,
  };
}

describe('update_elicitation_gaps', () => {
  it('spawn creates a gap through CommandExecutor and it appears in the ranked agenda', async () => {
    const { call } = realExecutorHarness();

    const spawn = await call(UPDATE_ELICITATION_GAPS_TOOL, spawnParams());
    expect(spawn.details).toMatchObject({ status: 'success' });

    const read = await call(READ_ELICITATION_GAPS_TOOL, {});
    const agenda = (read.details as { agenda: readonly ElicitationGap[] }).agenda;
    expect(agenda.map((gap) => gap.question)).toContain('What latency budget constrains the design?');
  });

  it('set_disposition removes the gap from the eligible agenda and writes a change-log row', async () => {
    const { db, specId, call } = realExecutorHarness();

    const spawn = await call(UPDATE_ELICITATION_GAPS_TOOL, spawnParams());
    const gapId = (spawn.details as { id: number }).id;

    const disposition = await call(UPDATE_ELICITATION_GAPS_TOOL, {
      action: 'set_disposition',
      gapId: String(gapId),
      disposition: 'answered',
    });
    expect(disposition.details).toMatchObject({ status: 'success' });

    const read = await call(READ_ELICITATION_GAPS_TOOL, {});
    expect(
      (read.details as { agenda: readonly ElicitationGap[] }).agenda.map((gap) => gap.question),
    ).not.toContain('What latency budget constrains the design?');

    const changeLogOps = db
      .select({ operation: schema.changeLog.operation })
      .from(schema.changeLog)
      .where(eq(schema.changeLog.spec_id, specId))
      .all()
      .map((row) => row.operation);
    expect(changeLogOps).toContain('set_elicitation_gap_disposition');
  });

  it('surfaces executor structural diagnostics verbatim with no partial writes', async () => {
    const { call } = realExecutorHarness();

    const result = await call(UPDATE_ELICITATION_GAPS_TOOL, {
      action: 'set_disposition',
      gapId: '9999',
      disposition: 'answered',
    });

    expect(result.content[0]!.text).toContain('STRUCTURAL_ILLEGAL');
    expect(result.details).toMatchObject({ status: 'structural_illegal' });
    expect(JSON.stringify(result.details)).toContain('9999');
  });

  it('a rejected write leaves the register untouched (no partial writes)', async () => {
    const { call } = realExecutorHarness();
    const before = await call(READ_ELICITATION_GAPS_TOOL, { include: 'all' });

    const result = await call(UPDATE_ELICITATION_GAPS_TOOL, {
      action: 'spawn',
      refersTo: 'goal',
      question: '',
      rationale: '',
      band: 'grounding',
    });
    expect(result.details).toMatchObject({ status: 'structural_illegal' });

    const after = await call(READ_ELICITATION_GAPS_TOOL, { include: 'all' });
    expect(after.details).toEqual(before.details);
  });

  it('interleaves gap writes and graph writes on one monotonic {specId, lsn} clock', async () => {
    const { executor, specId, call } = realExecutorHarness();

    const lsns: number[] = [];
    const spawn = await call(UPDATE_ELICITATION_GAPS_TOOL, spawnParams());
    lsns.push((spawn.details as { lsn: number }).lsn);

    const graphWrite = executor.mutateGraph({
      specId,
      createBasis: 'explicit',
      ops: [{ op: 'create_node', ref: 'n1', plane: 'intent', kind: 'goal', title: 'One clock goal' }],
    });
    if (graphWrite.status !== 'success') throw new Error('graph write failed');
    lsns.push(graphWrite.lsn);

    const spawnId = (spawn.details as { id: number }).id;
    const disposition = await call(UPDATE_ELICITATION_GAPS_TOOL, {
      action: 'set_disposition',
      gapId: String(spawnId),
      disposition: 'answered',
    });
    lsns.push((disposition.details as { lsn: number }).lsn);

    expect(lsns).toEqual([...lsns].sort((a, b) => a - b));
    expect(new Set(lsns).size).toBe(lsns.length); // strictly increasing, one shared clock
  });

  it('proves the scripted loop: answer the top gap, spawn a follow-up, selection moves on', async () => {
    const { call } = realExecutorHarness();

    // importance outranks the seeded floor within the same band, so the
    // spawned question becomes the driver's top selection
    await call(UPDATE_ELICITATION_GAPS_TOOL, spawnParams({ question: 'Initial top question?' }));
    const first = await call(READ_ELICITATION_GAPS_TOOL, {});
    const firstAgenda = (first.details as { agenda: readonly ElicitationGap[] }).agenda;
    expect(firstAgenda[0]?.question).toBe('Initial top question?');

    // scripted reflection: close the asked gap, spawn the follow-up it revealed
    await call(UPDATE_ELICITATION_GAPS_TOOL, {
      action: 'set_disposition',
      gapId: firstAgenda[0]!.id,
      disposition: 'answered',
    });
    await call(UPDATE_ELICITATION_GAPS_TOOL, {
      action: 'spawn',
      refersTo: 'requirement',
      question: 'Follow-up revealed by the answer?',
      rationale: 'The answer surfaced a requirement-shaped obligation.',
      band: 'grounding',
      importance: 98,
      manualRubric: 'Judge whether the follow-up requirement has been captured.',
      aroseFromGapId: firstAgenda[0]!.id,
    });

    const second = await call(READ_ELICITATION_GAPS_TOOL, {});
    const secondAgenda = (second.details as { agenda: readonly ElicitationGap[] }).agenda;
    expect(secondAgenda[0]?.question).toBe('Follow-up revealed by the answer?');
    expect(secondAgenda.map((gap) => gap.question)).not.toContain('Initial top question?');
  });
});
