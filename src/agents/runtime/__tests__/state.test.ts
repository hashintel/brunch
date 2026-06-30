import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { groundingFloorGaps } from '../../../graph/schema/elicitation-gap-fixtures.js';
import { projectBrunchAgentState } from '../../../projections/session/runtime-state.js';
import {
  BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL,
  BRUNCH_EXECUTE_COOK_LAUNCH_TOOL,
  BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL,
  BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL,
  BRUNCH_EXECUTE_COOK_PETRI_EXPORT_TOOL,
  BRUNCH_EXECUTE_COOK_POPULATE_TOOL,
  BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL,
  BRUNCH_EXECUTE_COOK_RUN_COMPLETE_TOOL,
  BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL,
  BRUNCH_EXECUTE_COOK_SOURCE_POLICY_TOOL,
  BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_START_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_EXECUTE_TOOL,
  BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL,
  BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
  BRUNCH_EXECUTE_SNAPSHOT_TOOL,
  BRUNCH_EXECUTE_STATUS_TOOL,
  BRUNCH_ORCHESTRATOR_STUB_TOOL,
} from '../../../session/schema/tool-names.js';
import { bundledAgentBodyLocation } from '../../registry.js';
import { FOREGROUND_AGENT_ROSTER, delegatableAgentsForRuntimeState } from '../policy.js';
import { activeToolNamesForPosture, agentBodyResourceLocation, manifestsForState } from '../state.js';

const registeredToolNames = [
  'read',
  'grep',
  'find',
  'ls',
  'bash',
  'edit',
  'write',
  'present_question',
  'request_response',
  'present_candidates',
  'present_review_set',
  'read_graph',
  'read_session_context',
  'read_elicitation_gaps',
  'update_elicitation_gaps',
  'read_reconciliation_needs',
  'update_reconciliation_needs',
  'mutate_graph',
  BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL,
  BRUNCH_EXECUTE_COOK_LAUNCH_TOOL,
  BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL,
  BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL,
  BRUNCH_EXECUTE_COOK_PETRI_EXPORT_TOOL,
  BRUNCH_EXECUTE_COOK_POPULATE_TOOL,
  BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL,
  BRUNCH_EXECUTE_COOK_RUN_COMPLETE_TOOL,
  BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL,
  BRUNCH_EXECUTE_COOK_SOURCE_POLICY_TOOL,
  BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_START_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_EXECUTE_TOOL,
  BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL,
  BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
  BRUNCH_EXECUTE_SNAPSHOT_TOOL,
  BRUNCH_EXECUTE_STATUS_TOOL,
  BRUNCH_ORCHESTRATOR_STUB_TOOL,
];

describe('agent posture policy', () => {
  it('derives method manifests and active tool names from gap coverage', () => {
    const state = projectBrunchAgentState([]);
    const uncoveredGaps = groundingFloorGaps({ defaultCoverage: 0 });
    const coveredGaps = groundingFloorGaps();

    const floorMethods = manifestsForState(state, uncoveredGaps).methods.map((entry) => entry.name);
    const floorTools = activeToolNamesForPosture({ registeredToolNames, state, gaps: uncoveredGaps });
    const coveredMethods = manifestsForState(state, coveredGaps).methods.map((entry) => entry.name);
    const coveredTools = activeToolNamesForPosture({ registeredToolNames, state, gaps: coveredGaps });

    expect(floorMethods).toEqual([
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
    expect(floorMethods).not.toContain('scope-execution-task');
    expect(floorMethods).not.toContain('build-with-tests');
    // D86-L: graph-write tools are floor — present even at zero grounding coverage.
    expect(floorTools).toContain('mutate_graph');
    expect(floorTools).toContain('present_candidates');
    expect(floorTools).toContain('present_review_set');
    expect(floorTools).toContain('request_response');
    expect(floorTools).toContain('read_graph');
    expect(floorTools).toContain('read_session_context');
    expect(floorTools).toContain('read_elicitation_gaps');
    expect(floorTools).toContain('update_elicitation_gaps');
    expect(floorTools).toContain('read_reconciliation_needs');
    expect(floorTools).toContain('update_reconciliation_needs');
    expect(floorTools).not.toContain('bash');
    expect(floorTools).toEqual(expect.arrayContaining(['present_question', 'request_response']));

    expect(coveredMethods).toEqual([
      'run-structured-exchange',
      'capture',
      'commit-graph',
      'elicit-by-question',
      'ingest-paste',
      'read-referenced-documents',
      'explore-and-characterize',
      'read-context',
      'generate-proposal',
      'review-for-gaps',
    ]);
    expect(coveredTools).toContain('mutate_graph');
    expect(coveredTools).toEqual(
      expect.arrayContaining(['present_candidates', 'present_review_set', 'request_response']),
    );
  });

  it('keeps graph-write tools floor even when graph-write readiness negotiates (D86-L)', () => {
    const state = projectBrunchAgentState([]);
    // thesis uncovered => propose-graph / project-graph readiness negotiates, but the
    // graph-write methods/tools must stay available (no bootstrap deadlock).
    const negotiating = groundingFloorGaps({ coverage: { thesis: 0 } });

    const methods = manifestsForState(state, negotiating).methods.map((entry) => entry.name);
    expect(methods).toContain('commit-graph');
    expect(methods).toContain('generate-proposal');

    const tools = activeToolNamesForPosture({ registeredToolNames, state, gaps: negotiating });
    expect(tools).toContain('mutate_graph');
    expect(tools).toEqual(
      expect.arrayContaining(['present_candidates', 'present_review_set', 'request_response']),
    );
  });

  it('allows registered dev tool names only through the injected dev allow-list', () => {
    const state = projectBrunchAgentState([]);
    const gaps = groundingFloorGaps({ defaultCoverage: 0 });
    const productTools = activeToolNamesForPosture({
      registeredToolNames: [...registeredToolNames, 'brunch_session_query'],
      state,
      gaps,
    });
    const devTools = activeToolNamesForPosture({
      registeredToolNames: [...registeredToolNames, 'brunch_session_query'],
      state,
      gaps,
      devAllowedToolNames: ['brunch_session_query'],
    });

    expect(productTools).not.toContain('brunch_session_query');
    expect(devTools).toContain('brunch_session_query');
    expect(productTools).toEqual(activeToolNamesForPosture({ registeredToolNames, state, gaps }));
  });

  it('keeps blocked tools blocked and never advertises unregistered dev tool names', () => {
    const state = projectBrunchAgentState([]);
    const tools = activeToolNamesForPosture({
      registeredToolNames,
      state,
      gaps: groundingFloorGaps({ defaultCoverage: 0 }),
      devAllowedToolNames: ['bash', 'brunch_session_query'],
    });

    expect(tools).not.toContain('bash');
    expect(tools).not.toContain('brunch_session_query');
  });

  it('keeps freestyle pin-only while leaving elicit tool authority unchanged', () => {
    const autoState = projectBrunchAgentState([]);
    const pinnedFreestyle = projectBrunchAgentState([
      {
        type: 'custom',
        customType: 'brunch.agent_runtime_state',
        data: {
          schemaVersion: 1,
          reason: 'switch',
          source: 'user',
          state: {
            schemaVersion: 1,
            operationalMode: 'elicit',
            agentStrategy: 'freestyle',
            agentLens: 'auto',
          },
        },
      },
    ]);

    expect(manifestsForState(autoState, groundingFloorGaps()).strategies.map((entry) => entry.name)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
    expect(
      manifestsForState(pinnedFreestyle, groundingFloorGaps({ defaultCoverage: 0 })).strategies.map(
        (entry) => entry.name,
      ),
    ).toEqual(['freestyle']);
    expect(
      activeToolNamesForPosture({
        registeredToolNames,
        state: pinnedFreestyle,
        gaps: groundingFloorGaps(),
      }),
    ).toEqual(
      activeToolNamesForPosture({
        registeredToolNames,
        state: autoState,
        gaps: groundingFloorGaps(),
      }),
    );
  });

  it('omits only the non-graph-write gated method (review-for-gaps) when readiness negotiates', () => {
    const state = projectBrunchAgentState([
      {
        type: 'custom',
        customType: 'brunch.agent_runtime_state',
        data: {
          schemaVersion: 1,
          reason: 'switch',
          source: 'user',
          state: {
            schemaVersion: 1,
            operationalMode: 'elicit',
            agentStrategy: 'auto',
            agentLens: 'auto',
          },
        },
      },
    ]);

    const manifests = manifestsForState(state, groundingFloorGaps({ coverage: { thesis: 0 } }));

    expect(Object.keys(manifests)).toEqual(['strategies', 'lenses', 'methods']);
    expect(manifests.methods.map((entry) => entry.name)).not.toContain('review-for-gaps');
    // D86-L: graph-write methods stay present through negotiation.
    expect(manifests.methods.map((entry) => entry.name)).toContain('commit-graph');
    expect(manifests.methods.map((entry) => entry.name)).toContain('generate-proposal');
  });

  it('fails loud on an empty gap register instead of returning empty manifests', () => {
    // Every spec is seeded with floor gaps at creation; an empty register reaching
    // manifest derivation is a wiring bug, never a legal quiet posture.
    const state = projectBrunchAgentState([]);
    expect(() => manifestsForState(state, [])).toThrow(/no presence gap/);
  });

  it('resolves agent SYSTEM.md bodies through the central agent context registry location', () => {
    const location = agentBodyResourceLocation('elicitor');
    expect(location).toBe(bundledAgentBodyLocation('elicitor'));
    expect(location).toMatch(/src\/agents\/prompts\/elicitor\.md$/);
    const body = readFileSync(location, 'utf8');
    expect(body).toContain('# Agent: elicitor');
  });

  it('carries the foreground manifest on the op-mode-keyed roster', () => {
    const manifest = FOREGROUND_AGENT_ROSTER.elicit.foregroundAgent;

    expect(manifest).toMatchObject({
      kind: 'foreground',
      id: 'elicitor',
      operationalMode: 'elicit',
      model: 'default',
      thinking: 'medium',
      canDelegate: ['explorer', 'researcher', 'projector', 'reviewer'],
    });
    expect(manifest.skills.strategies).toEqual([
      'freestyle',
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
    expect(manifest.skills.lenses).toEqual(['intent', 'design', 'oracle']);
    expect(manifest.skills.methods).not.toContain('scope-execution-task');
    expect(manifest.skills.methods).not.toContain('build-with-tests');
  });

  it('derives delegatable agents from the code-owned foreground roster', () => {
    const state = projectBrunchAgentState([]);

    expect(delegatableAgentsForRuntimeState(state)).toEqual([
      'explorer',
      'researcher',
      'projector',
      'reviewer',
    ]);
  });

  it('activates the executor stub only in execute mode', () => {
    const executeState = projectBrunchAgentState([
      {
        type: 'custom',
        customType: 'brunch.agent_runtime_state',
        data: {
          schemaVersion: 1,
          reason: 'switch',
          source: 'user',
          state: {
            schemaVersion: 1,
            operationalMode: 'execute',
            agentStrategy: 'auto',
            agentLens: 'auto',
          },
        },
      },
    ]);
    const elicitState = projectBrunchAgentState([]);

    const executeTools = activeToolNamesForPosture({
      registeredToolNames,
      state: executeState,
      gaps: groundingFloorGaps({ defaultCoverage: 0 }),
    });
    const elicitTools = activeToolNamesForPosture({
      registeredToolNames,
      state: elicitState,
      gaps: groundingFloorGaps({ defaultCoverage: 0 }),
    });

    expect(executeState.agentRole).toBe('executor');
    expect(delegatableAgentsForRuntimeState(executeState)).toEqual([]);
    expect(executeState.agentRoleDefinition.skills.methods).toEqual([
      'scope-execution-task',
      'build-with-tests',
    ]);
    expect(
      manifestsForState(executeState, groundingFloorGaps({ defaultCoverage: 0 })).methods.map(
        (entry) => entry.name,
      ),
    ).toEqual(['scope-execution-task', 'build-with-tests']);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_LAUNCH_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_PETRI_EXPORT_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_POPULATE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_RUN_COMPLETE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_SOURCE_POLICY_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_SLICE_START_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_SLICE_EXECUTE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_PLAN_CHECK_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_PLAN_DRAFT_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_SNAPSHOT_TOOL);
    expect(executeTools).toContain(BRUNCH_EXECUTE_STATUS_TOOL);
    expect(executeTools).toContain(BRUNCH_ORCHESTRATOR_STUB_TOOL);
    expect(executeTools).not.toEqual(expect.arrayContaining(['bash', 'edit', 'write']));
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_LAUNCH_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_PETRI_EXPORT_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_POPULATE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_RUN_COMPLETE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_SOURCE_POLICY_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_SLICE_START_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_SLICE_EXECUTE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_PLAN_CHECK_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_PLAN_DRAFT_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_SNAPSHOT_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_EXECUTE_STATUS_TOOL);
    expect(elicitTools).not.toContain(BRUNCH_ORCHESTRATOR_STUB_TOOL);
  });

  it('keeps state.ts free of grade-gate symbols', () => {
    const source = readFileSync(fileURLToPath(new URL('../state.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/ReadinessGrade|GRADE_RANK|MIN_GRADE|isGradeLegal/);
  });
});
