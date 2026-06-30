import { access, readFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { groundingFloorGaps } from '../../../graph/schema/elicitation-gap-fixtures.js';
import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../../graph/schema/nodes.js';
import {
  DEFAULT_BRUNCH_AGENT_STATE,
  projectBrunchAgentState,
} from '../../../projections/session/runtime-state.js';
import type { WorkspacePostureState } from '../../../session/workspace-session-coordinator.js';
import { composeAgentPrompt, type ComposeAgentPromptInput } from '../compose.js';
import { renderBrunchSkills } from '../prompt-skills.js';
import { LENS_RESOURCES, METHOD_RESOURCES, STRATEGY_RESOURCES } from '../state.js';

const projectRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

const groundingSpec = {
  id: 1,
  name: 'Grounding Spec',
};

const elicitationSpec = {
  id: 1,
  name: 'Elicitation Spec',
};

const workspace = {
  cwd: '/work/brunch',
  posture: workspacePosture({
    certainty: 'proving',
    stakes: 'high',
    audience: 'internal',
    horizon: 'current-milestone',
    migration: 'free-rewrite',
    dependencies: 'resist',
  }),
};

function workspacePosture(posture: WorkspacePostureState): WorkspacePostureState {
  return posture;
}

const coveredGaps = groundingFloorGaps();
const zeroCoverageGaps = groundingFloorGaps({ defaultCoverage: 0 });

const context = {
  contextHandles: ['graph-overview: compact selected-spec graph summary available via read tools'],
  renderedContexts: [
    '[Selected-spec graph context · intent lens]\n- selected-spec lsn: 7; nodes: 1; edges: 0',
  ],
};

describe('composeAgentPrompt', () => {
  it('renders prompt-resource manifests from the shared prompt-skill core', () => {
    const rendered = renderBrunchSkills({
      strategies: [
        {
          name: 'step<wise',
          description: 'choose & explain',
          location: '/skills/"step".md',
        },
      ],
      lenses: [],
      methods: [],
    });

    expect(rendered).toContain('<brunch-skills>');
    expect(rendered).toContain('<kind>strategy</kind>');
    expect(rendered).toContain('<name>step&lt;wise</name>');
    expect(rendered).toContain('<description>choose &amp; explain</description>');
    expect(rendered).toContain('<location>/skills/&quot;step&quot;.md</location>');
  });

  it('emits control, runtime, context handles, and manifest families for default AUTO axes', () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([]),
      spec: groundingSpec,
      workspace,
      context,
      activeTools: ['read', 'grep', 'present_question'],
      gaps: zeroCoverageGaps,
      agentBody: '[Agent: elicitor]\nUse this role body before runtime metadata.',
    });

    expect(result.prompt).toContain('[Agent: elicitor]\nUse this role body before runtime metadata.');
    expect(result.prompt.indexOf('[Agent: elicitor]')).toBeLessThan(
      result.prompt.indexOf('[Brunch agent control]'),
    );
    expect(result.prompt).toContain('[Brunch agent control]');
    expect(result.prompt).toContain('- agent: elicitor');
    expect(result.prompt).toContain('[Brunch runtime state]');
    expect(result.prompt).toContain(
      '- spec: Grounding Spec (#1), readiness estimate (soft; gates nothing): grounding=0.00, elicitation=0.00, projection=0.00, commitment=0.00',
    );
    expect(result.prompt).not.toContain('readiness_grade=');
    expect(result.prompt).toContain(
      '- workspace posture: certainty=proving; stakes=high; audience=internal; horizon=current-milestone; migration=free-rewrite; dependencies=resist',
    );
    expect(result.prompt).toContain('[Brunch elicitation recommendation]');
    expect(result.prompt).toContain('- next question: constraint question');
    expect(result.prompt).toContain('- refers to: constraint');
    expect(result.prompt).toContain('- rationale: constraint rationale');
    expect(result.prompt).toContain('[Brunch pushed context]');
    expect(result.prompt).toContain('handle: graph-overview: compact selected-spec graph summary');
    expect(result.prompt).toContain('[Selected-spec graph context · intent lens]');
    expect(result.prompt).not.toContain('<available_goals>');
    expect(result.prompt).toContain('<brunch-skills>');
    expect(result.prompt).toContain('<kind>strategy</kind>');
    expect(result.prompt).toContain('<kind>lens</kind>');
    expect(result.prompt).toContain('<kind>method</kind>');
    expect(result.prompt).not.toContain('<name>grounding-advance</name>');
    expect(result.prompt).not.toContain('<name>capture-posture</name>');
    expect(result.prompt).not.toContain('<name>commit-converge</name>');
  });

  it('surfaces rendered context text and preserves manifest legality when lens changes', () => {
    const intent = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentLens: 'intent',
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      context: {
        renderedContexts: ['[Selected-spec graph context · intent lens]\n- emphasis: intent claims'],
      },
      activeTools: ['read'],
      gaps: coveredGaps,
    });
    const design = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentLens: 'design',
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      context: {
        renderedContexts: ['[Selected-spec graph context · design lens]\n- emphasis: design modules'],
      },
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    expect(intent.prompt).toContain('[Selected-spec graph context · intent lens]');
    expect(design.prompt).toContain('[Selected-spec graph context · design lens]');
    expect(intent.manifests.methods.map((entry) => entry.name)).toEqual(
      design.manifests.methods.map((entry) => entry.name),
    );
    expect(intent.manifests.lenses.map((entry) => entry.name)).toEqual(['intent']);
    expect(design.manifests.lenses.map((entry) => entry.name)).toEqual(['design']);
  });

  it('filters AUTO axes by gap coverage and allow-list, while pinned legal axes point at only the pinned resource', () => {
    const auto = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    expect(Object.keys(auto.manifests)).toEqual(['strategies', 'lenses', 'methods']);
    expect(auto.manifests.strategies.map((entry) => entry.name)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
    expect(auto.manifests.lenses.map((entry) => entry.name)).toEqual(['intent', 'design', 'oracle']);

    const pinned = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentStrategy: 'step-wise-disambiguate',
              agentLens: 'design',
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    expect(pinned.manifests.strategies.map((entry) => entry.name)).toEqual(['step-wise-disambiguate']);
    expect(pinned.manifests.lenses.map((entry) => entry.name)).toEqual(['design']);

    const pinnedFreestyle = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentStrategy: 'freestyle',
            },
          },
        },
      ]),
      spec: groundingSpec,
      workspace,
      activeTools: ['read'],
      gaps: zeroCoverageGaps,
    });

    expect(pinnedFreestyle.manifests.strategies.map((entry) => entry.name)).toEqual(['freestyle']);
    expect(auto.prompt).toContain(
      '- spec: Elicitation Spec (#1), readiness estimate (soft; gates nothing): grounding=1.00, elicitation=0.00, projection=0.00, commitment=0.00',
    );
    expect(auto.prompt).not.toContain('readiness_grade=');
    expect(auto.prompt).not.toContain('<name>freestyle</name>');
    expect(pinnedFreestyle.prompt).toContain('<name>freestyle</name>');
  });

  it('omits the elicitation recommendation when no open gaps remain', () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([]),
      spec: groundingSpec,
      workspace,
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    expect(result.prompt).not.toContain('[Brunch elicitation recommendation]');
  });

  it('keeps pinned strategy selections in the prompt while graph-write methods stay floor (D86-L)', () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentStrategy: 'step-wise-disambiguate',
            },
          },
        },
      ]),
      spec: groundingSpec,
      workspace,
      activeTools: ['read'],
      gaps: zeroCoverageGaps,
    });

    expect(result.prompt).not.toMatch(/- goal:/);
    expect(result.prompt).toContain('- prompt strategy resource: step-wise-disambiguate');
    expect(Object.keys(result.manifests)).toEqual(['strategies', 'lenses', 'methods']);
    expect(result.manifests.strategies.map((entry) => entry.name)).toEqual(['step-wise-disambiguate']);
    // D86-L: commit-graph + generate-proposal are floor (graph-write is never readiness-gated);
    // review-for-gaps stays gated (deliberate audit, no graph-write tool) so it is absent at zero coverage.
    expect(result.manifests.methods.map((entry) => entry.name)).toEqual([
      'run-structured-exchange',
      'capture',
      'commit-graph',
      'elicit-by-question',
      'ingest-paste',
      'read-referenced-documents',
      'explore-and-characterize',
      'read-context',
      'generate-proposal',
    ]);
  });

  it('advertises only readable code-owned prompt resources without filesystem discovery', async () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([]),
      spec: elicitationSpec,
      workspace,
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    for (const entry of Object.values(result.manifests).flat()) {
      expect(relative(projectRoot, entry.location).startsWith('src/agents/')).toBe(true);
      await expect(access(entry.location)).resolves.toBeUndefined();
    }
    expect(result.prompt).not.toContain('unlisted-fixture');
    expect(
      Object.values(result.manifests)
        .flat()
        .map((entry) => entry.name),
    ).not.toContain('unlisted-fixture');
  });

  it('keeps every manifest prompt resource readable and non-trivial', async () => {
    const entries = [
      ...Object.values(STRATEGY_RESOURCES),
      ...Object.values(LENS_RESOURCES),
      ...Object.values(METHOD_RESOURCES),
    ];

    for (const entry of entries) {
      expect(relative(projectRoot, entry.location).startsWith('src/agents/skills/')).toBe(true);
      expect(entry.location.endsWith(`/${entry.name}/SKILL.md`)).toBe(true);
      const raw = await readFile(entry.location, 'utf8');
      const { frontmatter, body } = parseFrontmatter(raw);
      expect(frontmatter).toMatchObject({ name: entry.name, description: entry.description });
      expect(
        body.length,
        `${entry.name} should carry prompt-resource guidance beyond a placeholder`,
      ).toBeGreaterThanOrEqual(700);
    }
  });
});

// ── COMPOSE-stage prompt golden previews ──────────────────────────────────────
// Each case composes a fixture runtime state, selected-spec gaps, workspace
// posture, and optional rendered context strings, then locks the full
// provider-facing prompt under the sibling `__snapshots__/`. The locked file IS
// the wording assertion: review the diff when output changes, accept with
// `--update` only after human approval. Inline asserts stay limited to
// cross-cutting contract invariants a careless snapshot update could hide:
// fixture rendered contexts stay visibly bracketed, retired readiness-grade
// vocabulary never returns. Absolute repo paths are normalized to `<repo>/` so
// the goldens stay machine-stable.

const FLOOR_KINDS: readonly NodeKind[] = ['context', 'thesis', 'goal', 'constraint'];

const previewWorkspace: ComposeAgentPromptInput['workspace'] = {
  cwd: '/work/brunch-preview',
  posture: workspacePosture({
    certainty: 'proving',
    stakes: 'high',
    audience: 'internal',
    horizon: 'current-milestone',
    migration: 'free-rewrite',
    dependencies: 'resist',
  }),
};

function normalizeRepoPaths(rendered: string): string {
  return rendered.replaceAll(`${projectRoot}/`, '<repo>/');
}

function previewGap(refersTo: NodeKind, coverage: number): ElicitationGap {
  return {
    id: `${refersTo}:preview-gap`,
    specId: 101,
    refersTo,
    question: `What should Brunch know about the ${refersTo} before proceeding?`,
    rationale: previewGapRationale(refersTo),
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', minimum: 1, nodeKind: refersTo },
    importance: 1,
    coverage,
    answered: coverage >= 1,
    disposition: coverage >= 1 ? 'answered' : 'open',
    createdAtLsn: 1,
  };
}

function previewGapRationale(refersTo: NodeKind): string {
  if (refersTo === 'constraint') {
    return 'Constraints bound the solution space; an unestablished constraint undermines proposal legality.';
  }
  return `The ${refersTo} gap records what coverage is still needed before proceeding.`;
}

function previewFloorGaps(coverage: number): readonly ElicitationGap[] {
  return FLOOR_KINDS.map((kind) => previewGap(kind, coverage));
}

function composePreviewPrompt(input: Partial<ComposeAgentPromptInput> = {}): string {
  return composeAgentPrompt({
    agentId: 'elicitor',
    sessionState: projectBrunchAgentState([]),
    spec: { id: 101, name: 'COMPOSE Preview Spec' },
    workspace: previewWorkspace,
    activeTools: ['read', 'grep', 'find', 'ls', 'present_question', 'request_response'],
    gaps: previewFloorGaps(0),
    agentBody: '# Agent: elicitor\n\nPreview role body from `src/agents/prompts/elicitor.md`.',
    ...input,
  }).prompt;
}

function expectPromptContracts(rendered: string): void {
  expect(rendered).toContain('# Agent: elicitor');
  expect(rendered.indexOf('# Agent: elicitor')).toBeLessThan(rendered.indexOf('[Brunch agent control]'));
  expect(rendered).toContain('[Brunch agent control]');
  expect(rendered).toContain('[Brunch runtime state]');
  expect(rendered).toContain('[Brunch pushed context]');
  expect(rendered).toContain('[Brunch prompt-resource routing]');
  expect(rendered).not.toContain('readiness_grade');
  expect(rendered).not.toContain('READINESS_GRADES');
  expect(rendered).not.toContain('<available_goals>');
  expect(rendered).toContain('<brunch-skills>');
  expect(rendered).not.toMatch(/\bgoal=/);
  expect(rendered).not.toMatch(/- goal:/);
  expect(rendered).not.toContain('- strategy:');
  expect(rendered).not.toContain('- lens:');
  expect(rendered).toContain('prompt-resource routing hints, not user-changeable session identity');
}

describe('composeAgentPrompt previews', () => {
  it('elicitor--auto-floor-gaps-open: all axes AUTO, floor gaps open', async () => {
    const rendered = normalizeRepoPaths(composePreviewPrompt());
    await expect(rendered).toMatchFileSnapshot('../__snapshots__/elicitor--auto-floor-gaps-open.md');
    expectPromptContracts(rendered);
  });

  it('elicitor--auto-high-coverage: all axes AUTO, gaps largely answered', async () => {
    const rendered = normalizeRepoPaths(composePreviewPrompt({ gaps: previewFloorGaps(1) }));
    await expect(rendered).toMatchFileSnapshot('../__snapshots__/elicitor--auto-high-coverage.md');
    expectPromptContracts(rendered);
  });

  it('elicitor--pinned-strategy-lens: legal pinned strategy and lens, others AUTO', async () => {
    const rendered = normalizeRepoPaths(
      composePreviewPrompt({
        sessionState: projectBrunchAgentState([
          {
            type: 'custom',
            customType: 'brunch.agent_runtime_state',
            data: {
              schemaVersion: 1,
              reason: 'switch',
              source: 'user',
              state: {
                ...DEFAULT_BRUNCH_AGENT_STATE,
                agentStrategy: 'step-wise-disambiguate',
                agentLens: 'design',
              },
            },
          },
        ]),
        gaps: previewFloorGaps(1),
      }),
    );

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/elicitor--pinned-strategy-lens.md');
    expectPromptContracts(rendered);
    expect(rendered).toContain('<name>step-wise-disambiguate</name>');
    expect(rendered).toContain('<name>design</name>');
  });

  it('executor--execute-default: executor prompt omits elicitor-only guidance', async () => {
    const rendered = normalizeRepoPaths(
      composePreviewPrompt({
        agentId: 'executor',
        sessionState: projectBrunchAgentState([
          {
            type: 'custom',
            customType: 'brunch.agent_runtime_state',
            data: {
              schemaVersion: 1,
              reason: 'switch',
              source: 'user',
              state: {
                ...DEFAULT_BRUNCH_AGENT_STATE,
                operationalMode: 'execute',
              },
            },
          },
        ]),
        activeTools: [
          'read',
          'grep',
          'find',
          'ls',
          'execute_plan_check',
          'execute_plan_draft_artifact',
          'execute_plan_draft',
          'execute_plan_outline_artifact',
          'execute_plan_outline',
          'execute_snapshot',
          'execute_status',
          'orchestrator_stub',
        ],
        agentBody: '# Agent: executor\n\nPreview role body from `src/agents/prompts/executor.md`.',
      }),
    );

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/executor--execute-default.md');
    expect(rendered).toContain('# Agent: executor');
    expect(rendered).toContain('- op_mode: execute');
    expect(rendered).not.toContain('[Brunch elicitation recommendation]');
    expect(rendered).toContain('[Brunch prompt-resource routing]');
    expect(rendered).toContain('<brunch-skills>');
    expect(rendered).toContain('<name>scope-execution-task</name>');
    expect(rendered).toContain('<name>build-with-tests</name>');
    expect(rendered).toContain('Current prompt-resource selection');
    expect(rendered).toContain(
      '- active tools: read, grep, find, ls, execute_plan_check, execute_plan_draft_artifact, execute_plan_draft, execute_plan_outline_artifact, execute_plan_outline, execute_snapshot, execute_status, orchestrator_stub',
    );
  });

  it('elicitor--pushed-context: fixture handles and rendered contexts present', async () => {
    const rendered = normalizeRepoPaths(
      composePreviewPrompt({
        context: {
          contextHandles: ['graph-overview: fixture selected-spec summary available through read_graph'],
          renderedContexts: [
            '[fixture rendered context: selected-spec graph overview]\n- snapshot lsn: 9\n- nodes: 4; edges: 3',
            '[fixture rendered context: recent transcript]\n- user answered a grounding question about constraints',
          ],
        },
      }),
    );

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/elicitor--pushed-context.md');
    expectPromptContracts(rendered);
    expect(rendered).toContain('[fixture rendered context: selected-spec graph overview]');
    expect(rendered).toContain('[fixture rendered context: recent transcript]');
  });

  it.todo(
    'reviewer--auto-default: reviewer composition is gated until reviewer has a buildable compose entrypoint',
  );
});
