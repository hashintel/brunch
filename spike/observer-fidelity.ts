/**
 * Spike: Observer extraction fidelity
 *
 * Question: Can the LLM reliably extract decisions, assumptions, and
 * dependency edges from a single turn's Q&A?
 *
 * Approach: 5 realistic fixture turns → observer extraction via query() →
 * compare against hand-labeled golden master → measure capture rate.
 *
 * THROWAWAY CODE — not for promotion to production.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';

interface Entity {
  type: 'decision' | 'assumption';
  content: string;
}

interface Fixture {
  name: string;
  turn: {
    question: string;
    why: string;
    impact: string;
    answer: string;
    options: string[];
  };
  existingEntities: Entity[];
  expected: {
    decisions: string[];
    assumptions: string[];
  };
}

const FIXTURES: Fixture[] = [
  {
    name: 'scope-target-audience',
    turn: {
      question: 'Who is the primary target audience for this product?',
      why: 'Target audience shapes feature priorities, UX complexity, and go-to-market strategy.',
      impact: 'high',
      answer: 'Developer tools teams at mid-size companies (50-500 engineers). They need to standardize how specs are written across teams.',
      options: ['Individual developers', 'Developer tools teams at mid-size companies', 'Enterprise architecture groups', 'Startup founders'],
    },
    existingEntities: [],
    expected: {
      decisions: ['Target audience is developer tools teams at mid-size companies'],
      assumptions: ['Mid-size companies need standardized spec processes', 'Teams of 50-500 engineers have enough complexity to benefit'],
    },
  },
  {
    name: 'scope-deployment-model',
    turn: {
      question: 'How should the tool be deployed and accessed?',
      why: 'Deployment model affects architecture, security requirements, and adoption friction.',
      impact: 'high',
      answer: 'Local-first CLI tool that runs on the developer\'s machine. No cloud service, no account creation. Just npx and an API key.',
      options: ['Cloud SaaS with team accounts', 'Local CLI tool (npx)', 'VS Code extension', 'Self-hosted server'],
    },
    existingEntities: [
      { type: 'decision', content: 'Target audience is developer tools teams at mid-size companies' },
    ],
    expected: {
      decisions: ['Local-first CLI deployment via npx'],
      assumptions: ['Users are comfortable with CLI tools', 'API key management is acceptable friction', 'No cloud service needed for single-user tool'],
    },
  },
  {
    name: 'design-data-persistence',
    turn: {
      question: 'How should interview data be persisted between sessions?',
      why: 'Persistence strategy affects resume capability, data portability, and architecture complexity.',
      impact: 'high',
      answer: 'SQLite embedded database, stored locally. Simple, zero-config, and the data can be inspected with standard tools.',
      options: ['SQLite local database', 'JSON files on disk', 'Cloud database with sync', 'In-memory only (no persistence)'],
    },
    existingEntities: [
      { type: 'decision', content: 'Target audience is developer tools teams at mid-size companies' },
      { type: 'decision', content: 'Local-first CLI deployment via npx' },
      { type: 'assumption', content: 'Users are comfortable with CLI tools' },
    ],
    expected: {
      decisions: ['SQLite for local data persistence'],
      assumptions: ['SQLite is sufficient for single-user workloads', 'Users want to inspect data with standard tools'],
    },
  },
  {
    name: 'design-conversation-model',
    turn: {
      question: 'Should the interview be a flat conversation or support branching when decisions are revisited?',
      why: 'The conversation model determines how decision revisits work and whether spec evolution is traceable.',
      impact: 'high',
      answer: 'Tree-based conversation with branching. When a decision is revisited, the conversation forks. The active path determines the current spec state.',
      options: ['Flat conversation log', 'Tree with branching (git-like)', 'Append-only with edit markers'],
    },
    existingEntities: [
      { type: 'decision', content: 'SQLite for local data persistence' },
      { type: 'decision', content: 'Local-first CLI deployment via npx' },
    ],
    expected: {
      decisions: ['Tree-based conversation model with branching'],
      assumptions: ['Users understand branching metaphor from git', 'Decision revisit is a core workflow'],
    },
  },
  {
    name: 'constraints-api-provider',
    turn: {
      question: 'Should the tool support multiple AI providers or focus on one?',
      why: 'Multi-provider support adds abstraction cost and testing burden. Single-provider allows deeper integration.',
      impact: 'medium',
      answer: 'Anthropic only for now. We can use the Claude Agent SDK directly without an abstraction layer. Multi-provider is a future consideration if demand exists.',
      options: ['Anthropic only (Claude Agent SDK)', 'Multi-provider via AI SDK', 'Pluggable provider interface'],
    },
    existingEntities: [
      { type: 'decision', content: 'Tree-based conversation model with branching' },
      { type: 'decision', content: 'SQLite for local data persistence' },
      { type: 'assumption', content: 'Users understand branching metaphor from git' },
    ],
    expected: {
      decisions: ['Anthropic-only, using Claude Agent SDK directly'],
      assumptions: ['Claude Agent SDK is sufficient without abstraction layer', 'Multi-provider demand is uncertain'],
    },
  },
];

const OBSERVER_SYSTEM_PROMPT = `You are an observer agent for a spec elicitation tool. Your job is to extract decisions and assumptions from a single interview turn.

A DECISION is a resolved choice the user made — something they committed to.
An ASSUMPTION is a belief that underlies the decision — something that could be falsified.

Rules:
- Extract ONLY what this specific turn added. Do not repeat entities from the existing graph.
- Each decision should be a concise statement of the choice made.
- Each assumption should be a falsifiable belief.
- Keep extractions tight — 1-3 decisions and 0-3 assumptions per turn is typical.

You MUST respond with ONLY a raw JSON object. No markdown fences, no explanation, no preamble.

Format:
{"decisions": ["decision 1"], "assumptions": ["assumption 1"]}

Start your response with { and end with }. Nothing else.`;

function buildPrompt(fixture: Fixture): string {
  const sections: string[] = [];

  if (fixture.existingEntities.length > 0) {
    const lines = ['Existing entities (do NOT re-extract these):'];
    for (const e of fixture.existingEntities) {
      lines.push(`  ${e.type}: ${e.content}`);
    }
    sections.push(lines.join('\n'));
  }

  sections.push(`Current turn:
  Question: ${fixture.turn.question}
  Why: ${fixture.turn.why}
  Impact: ${fixture.turn.impact}
  Options: ${fixture.turn.options.join(', ')}
  User's answer: ${fixture.turn.answer}`);

  return sections.join('\n\n');
}

function fuzzyMatch(extracted: string, expected: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = normalize(extracted);
  const b = normalize(expected);
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = new Set(a.split(' '));
  const bWords = new Set(b.split(' '));
  const significant = [...bWords].filter((w) => w.length > 2);
  const overlap = significant.filter((w) => aWords.has(w));
  return overlap.length >= Math.ceil(significant.length * 0.4);
}

function scoreExtraction(
  extracted: { decisions: string[]; assumptions: string[] },
  expected: { decisions: string[]; assumptions: string[] },
): { decisionCapture: number; assumptionCapture: number; total: number } {
  let decisionHits = 0;
  for (const exp of expected.decisions) {
    if (extracted.decisions.some((d) => fuzzyMatch(d, exp))) decisionHits++;
  }

  let assumptionHits = 0;
  for (const exp of expected.assumptions) {
    if (extracted.assumptions.some((a) => fuzzyMatch(a, exp))) assumptionHits++;
  }

  const totalExpected = expected.decisions.length + expected.assumptions.length;
  const totalHits = decisionHits + assumptionHits;

  return {
    decisionCapture: expected.decisions.length > 0 ? decisionHits / expected.decisions.length : 1,
    assumptionCapture: expected.assumptions.length > 0 ? assumptionHits / expected.assumptions.length : 1,
    total: totalExpected > 0 ? totalHits / totalExpected : 1,
  };
}

async function runFixture(fixture: Fixture): Promise<{
  name: string;
  extracted: { decisions: string[]; assumptions: string[] };
  score: ReturnType<typeof scoreExtraction>;
  latencyMs: number;
  error?: string;
}> {
  const prompt = buildPrompt(fixture);
  const start = Date.now();

  try {
    let responseText = '';
    for await (const msg of query({
      prompt,
      options: {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        systemPrompt: OBSERVER_SYSTEM_PROMPT,
        maxTurns: 1,
        includePartialMessages: true,
      },
    })) {
      const m = msg as any;
      if (m.type === 'stream_event' && m.event?.type === 'content_block_delta') {
        if (m.event.delta?.type === 'text_delta' && m.event.delta.text) {
          responseText += m.event.delta.text;
        }
      } else if (m.type === 'assistant') {
        for (const block of m.message?.content ?? []) {
          if (block.type === 'text') responseText = block.text;
        }
      }
    }

    const latencyMs = Date.now() - start;
    const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(jsonStr) as { decisions: string[]; assumptions: string[] };
    const score = scoreExtraction(extracted, fixture.expected);

    return { name: fixture.name, extracted, score, latencyMs };
  } catch (err) {
    return {
      name: fixture.name,
      extracted: { decisions: [], assumptions: [] },
      score: { decisionCapture: 0, assumptionCapture: 0, total: 0 },
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log('Observer Extraction Fidelity Spike');
  console.log('==================================\n');

  const results = [];
  for (const fixture of FIXTURES) {
    console.log(`Running: ${fixture.name}...`);
    const result = await runFixture(fixture);
    results.push(result);

    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
    } else {
      console.log(`  Latency: ${result.latencyMs}ms`);
      console.log(`  Decisions: ${result.extracted.decisions.join('; ')}`);
      console.log(`  Assumptions: ${result.extracted.assumptions.join('; ')}`);
      console.log(`  Score: decisions=${(result.score.decisionCapture * 100).toFixed(0)}% assumptions=${(result.score.assumptionCapture * 100).toFixed(0)}% total=${(result.score.total * 100).toFixed(0)}%`);
    }
    console.log();
  }

  const avgTotal = results.reduce((sum, r) => sum + r.score.total, 0) / results.length;
  const avgDecision = results.reduce((sum, r) => sum + r.score.decisionCapture, 0) / results.length;
  const avgAssumption = results.reduce((sum, r) => sum + r.score.assumptionCapture, 0) / results.length;
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  const errors = results.filter((r) => r.error).length;

  console.log('Summary');
  console.log('-------');
  console.log(`Fixtures: ${results.length}, Errors: ${errors}`);
  console.log(`Avg capture: decisions=${(avgDecision * 100).toFixed(0)}% assumptions=${(avgAssumption * 100).toFixed(0)}% total=${(avgTotal * 100).toFixed(0)}%`);
  console.log(`Avg latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`Threshold: ≥80% total capture`);
  console.log(`Result: ${avgTotal >= 0.8 ? 'PASS ✓' : 'FAIL ✗'}`);
}

main().catch(console.error);
