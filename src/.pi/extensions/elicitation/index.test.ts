import { describe, expect, it } from 'vitest';

import { sortElicitationGapsForAsking } from '../../../graph/elicitation-driver.js';
import type { ElicitationGap } from '../../../graph/index.js';
import { READ_ELICITATION_GAPS_TOOL, registerBrunchElicitation } from './index.js';

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
    { reads: { getElicitationGaps: () => seededGaps }, specId: 7 },
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
    { reads: { getElicitationGaps: () => gaps }, specId: 7 },
  );
  return (await tools.get(READ_ELICITATION_GAPS_TOOL)!.execute('call-1' as never, params as never)) as {
    content: Array<{ type: 'text'; text: string }>;
    details: { agenda: readonly ElicitationGap[]; others?: readonly ElicitationGap[] };
  };
}

describe('read_elicitation_gaps', () => {
  it('registers the tool under the canonical name', () => {
    expect([...collectElicitationTool().keys()]).toEqual([READ_ELICITATION_GAPS_TOOL]);
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
