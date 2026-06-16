/**
 * Agent prompt composition previews — the single home for COMPOSE-stage golden coverage.
 *
 * Each case composes a fixture runtime state, selected-spec gaps, workspace posture,
 * and optional rendered context strings through `composeAgentPrompt`, then locks the
 * full provider-facing prompt under `__previews__/`. The locked file IS the wording
 * assertion: review the diff when output changes, accept with `--update` only after
 * human approval.
 *
 * Inline assertions stay limited to cross-cutting contract invariants that a careless
 * snapshot update could hide: fixture rendered contexts remain visibly bracketed, and
 * retired readiness-grade vocabulary never returns.
 */

import { mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../../graph/schema/nodes.js';
import {
  DEFAULT_BRUNCH_AGENT_STATE,
  projectBrunchAgentState,
} from '../../../projections/session/runtime-state.js';
import type { WorkspacePostureState } from '../../../session/workspace-session-coordinator.js';
import { composeAgentPrompt, type ComposeAgentPromptInput } from './compose.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = resolve(HERE, '__previews__');

const FLOOR_KINDS: readonly NodeKind[] = ['context', 'thesis', 'goal', 'constraint'];

const workspace: ComposeAgentPromptInput['workspace'] = {
  cwd: '/work/brunch-preview',
  posture: workspacePosture({
    certainty: 'proving',
    stakes: 'high',
    audience: 'internal',
    horizon: 'current-milestone',
    migration: 'free-rewrite',
    sourcing: 'strip-or-build',
  }),
};

async function lockPreview(fileName: string, rendered: string): Promise<void> {
  const normalized = normalizePreview(rendered);
  const locked = normalized.endsWith('\n') ? normalized : `${normalized}\n`;
  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(resolve(PREVIEWS_DIR, fileName));
}

function normalizePreview(rendered: string): string {
  const repoRoot = resolve(HERE, '../../../..');
  const relativePreviewsDir = relative(repoRoot, HERE);
  if (relativePreviewsDir !== 'src/.pi/extensions/system-prompts') {
    throw new Error(`Unexpected prompt preview test location: ${HERE}`);
  }
  return rendered.replaceAll(`${repoRoot}/`, '<repo>/');
}

function workspacePosture(posture: WorkspacePostureState): WorkspacePostureState {
  return posture;
}

function gap(refersTo: NodeKind, coverage: number): ElicitationGap {
  return {
    id: `${refersTo}:preview-gap`,
    specId: 101,
    refersTo,
    question: `What should Brunch know about the ${refersTo} before proceeding?`,
    rationale: gapRationale(refersTo),
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

function gapRationale(refersTo: NodeKind): string {
  if (refersTo === 'constraint') {
    return 'Constraints bound the solution space; an unestablished constraint undermines proposal legality.';
  }
  return `The ${refersTo} gap records what coverage is still needed before proceeding.`;
}

function gaps(coverage: number): readonly ElicitationGap[] {
  return FLOOR_KINDS.map((kind) => gap(kind, coverage));
}

function compose(input: Partial<ComposeAgentPromptInput> = {}): string {
  return composeAgentPrompt({
    agentId: 'elicitor',
    sessionState: projectBrunchAgentState([]),
    spec: { id: 101, name: 'COMPOSE Preview Spec' },
    workspace,
    activeTools: ['read', 'grep', 'find', 'ls', 'present_question', 'request_answer'],
    gaps: gaps(0),
    ...input,
  }).prompt;
}

function expectPromptContracts(rendered: string): void {
  expect(rendered).toContain('[Brunch agent control]');
  expect(rendered).toContain('[Brunch runtime state]');
  expect(rendered).toContain('[Brunch pushed context]');
  expect(rendered).toContain('[Brunch prompt-resource routing]');
  expect(rendered).not.toContain('readiness_grade');
  expect(rendered).not.toContain('READINESS_GRADES');
}

test('elicitor--auto-floor-gaps-open: all axes AUTO, floor gaps open', async () => {
  const rendered = compose();
  await lockPreview('elicitor--auto-floor-gaps-open.md', rendered);
  expectPromptContracts(rendered);
});

test('elicitor--auto-high-coverage: all axes AUTO, gaps largely answered', async () => {
  const rendered = compose({ gaps: gaps(1) });
  await lockPreview('elicitor--auto-high-coverage.md', rendered);
  expectPromptContracts(rendered);
});

test('elicitor--pinned-strategy-lens: legal pinned strategy and lens, others AUTO', async () => {
  const rendered = compose({
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
    gaps: gaps(1),
  });

  await lockPreview('elicitor--pinned-strategy-lens.md', rendered);
  expectPromptContracts(rendered);
  expect(rendered).toContain('name="step-wise-disambiguate"');
  expect(rendered).toContain('name="design"');
});

test('elicitor--pushed-context: fixture handles and rendered contexts present', async () => {
  const rendered = compose({
    context: {
      contextHandles: ['graph-overview: fixture selected-spec summary available through read_graph'],
      renderedContexts: [
        '[fixture rendered context: selected-spec graph overview]\n- snapshot lsn: 9\n- nodes: 4; edges: 3',
        '[fixture rendered context: recent transcript]\n- user answered a grounding question about constraints',
      ],
    },
  });

  await lockPreview('elicitor--pushed-context.md', rendered);
  expectPromptContracts(rendered);
  expect(rendered).toContain('[fixture rendered context: selected-spec graph overview]');
  expect(rendered).toContain('[fixture rendered context: recent transcript]');
});

test.todo(
  'reviewer--auto-default: reviewer composition is gated until reviewer has a buildable compose entrypoint',
);
