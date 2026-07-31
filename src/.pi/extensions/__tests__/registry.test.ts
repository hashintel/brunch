import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { EXECUTOR_ALLOWED_TOOL_NAMES } from '../../../agents/runtime/executor/active-tools.js';
import { createBrunchPiExtensions } from '../../../app/pi-extensions.js';
import {
  createFakeGitHostLandPort,
  createFakeGitRunPromotionPort,
  createFakeGitSliceIntegrationPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from '../../../executor/__tests__/fake-ports.js';
import type {
  AgentRunArgs,
  AgentRunnerPort,
  GitHostLandPort,
  GitRunPromotionPort,
  GitSliceIntegrationPort,
  GitWorktreePort,
  TestRunnerPort,
} from '../../../executor/execution-ports.js';
import { appendPetriEvent } from '../../../executor/petri-events.js';
import { planFilePath } from '../../../executor/plan-file.js';
import { PRODUCTION_EXECUTE_TOOL_MUTATIONS } from '../../../executor/run-execution-authority.js';
import { registerBrunchAlternatives as alternatives } from '../../components/alternatives.js';
import { registerBrunchOperationalModePolicy as operationalMode } from '../agent-runtime/runtime/index.js';
import { registerBrunchPrompting as prompting } from '../agent-runtime/system-prompts/index.js';
import { registerBrunchContext as context } from '../brunch-data/context/index.js';
import chrome from '../chrome/index.js';
import {
  BRUNCH_CONSULT_COMMAND,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_LAND_COMMAND,
  BRUNCH_MENU_COMMAND,
  BRUNCH_MENU_SHORTCUT,
  BRUNCH_MODE_COMMAND,
  BRUNCH_MODE_PICKER_SHORTCUT,
  registerBrunchCommands as commands,
} from '../commands/index.js';
import { registerBrunchBranchPolicyHandlers as commandPolicy } from '../commands/policy.js';
import {
  ASK_TOOL,
  PRESENT_CANDIDATES_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  registerStructuredExchange as structuredExchange,
} from '../exchanges/index.js';
import { BRUNCH_EXECUTE_AGENT_RESULT_TOOL } from '../executor/execute-agent-result/index.js';
import { BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL } from '../executor/execute-land/index.js';
import { BRUNCH_EXECUTE_LAUNCH_TOOL } from '../executor/execute-launch/index.js';
import { BRUNCH_EXECUTE_ORCHESTRATE_TOOL } from '../executor/execute-orchestrate/index.js';
import { BRUNCH_EXECUTE_PETRI_EXPORT_TOOL } from '../executor/execute-petri-export/index.js';
import { BRUNCH_EXECUTE_PLAN_CHECK_TOOL } from '../executor/execute-plan-check/index.js';
import { BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL } from '../executor/execute-plan-draft-artifact/index.js';
import { BRUNCH_EXECUTE_PLAN_DRAFT_TOOL } from '../executor/execute-plan-draft/index.js';
import { BRUNCH_EXECUTE_PLAN_FILE_TOOL } from '../executor/execute-plan-file/index.js';
import { BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL } from '../executor/execute-plan-outline-artifact/index.js';
import { BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL } from '../executor/execute-plan-outline/index.js';
import { BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL } from '../executor/execute-plan-preview/index.js';
import { BRUNCH_EXECUTE_POPULATE_TOOL } from '../executor/execute-populate/index.js';
import { BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL } from '../executor/execute-promotion-prepare/index.js';
import { BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL } from '../executor/execute-replan-abandon-run/index.js';
import { BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL } from '../executor/execute-replan-recommendation/index.js';
import { BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL } from '../executor/execute-replan-regenerate-plan/index.js';
import { BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL } from '../executor/execute-replan-retry-current-step/index.js';
import { BRUNCH_EXECUTE_REPLAN_START_NEW_RUN_TOOL } from '../executor/execute-replan-start-new-run/index.js';
import { BRUNCH_EXECUTE_REPORT_INIT_TOOL } from '../executor/execute-report-init/index.js';
import { BRUNCH_EXECUTE_RUN_COMPLETE_TOOL } from '../executor/execute-run-complete/index.js';
import { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../executor/execute-run-create/index.js';
import { BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL } from '../executor/execute-slice-complete/index.js';
import { BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL } from '../executor/execute-slice-execute/index.js';
import { BRUNCH_EXECUTE_SLICE_START_TOOL } from '../executor/execute-slice-start/index.js';
import { BRUNCH_EXECUTE_SNAPSHOT_TOOL } from '../executor/execute-snapshot/index.js';
import { BRUNCH_EXECUTE_SOURCE_COPY_TOOL } from '../executor/execute-source-copy/index.js';
import { BRUNCH_EXECUTE_SOURCE_POLICY_TOOL } from '../executor/execute-source-policy/index.js';
import { BRUNCH_EXECUTE_STATUS_TOOL } from '../executor/execute-status/index.js';
import { BRUNCH_EXECUTE_TEST_RESULT_TOOL } from '../executor/execute-test-result/index.js';
import { BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL } from '../executor/execute-worktree-create/index.js';
import { registerBrunchMentionAutocomplete as mentionAutocomplete } from '../mentions/index.js';
import { registerBrunchSessionBoundary as sessionLifecycle } from '../session-hooks/session/lifecycle.js';
import { hasBrunchDefaultRenderer } from '../shared/define-brunch-tool.js';
import { BRUNCH_TOOL_ACTIVITY_LABELS } from '../shared/tool-activity-labels.js';
import { assertProviderLegalToolSchema, hasToolParametersProvenance } from '../shared/tool-schema.js';
import {
  BRUNCH_SUBAGENT_TOOL,
  parseSubagentMarkdown,
  type BrunchSubagentsDeps,
  type SubagentResult,
} from '../subagents/index.js';
import { createSubagentToolCatalog } from '../subagents/session.js';

const extensionDefaults = {
  'components/alternatives.ts': alternatives,
  'chrome/index.ts': chrome,
  'commands/policy.ts': commandPolicy,
  'commands/index.ts': commands,
  'context/index.ts': context,
  'mentions/index.ts': mentionAutocomplete,
  'runtime/index.ts': operationalMode,
  'system-prompts/index.ts': prompting,
  'session/lifecycle.ts': sessionLifecycle,
  'exchanges/index.ts': structuredExchange,
};

function admittedPlanPayload(mode: 'greenfield' | 'brownfield'): string {
  const brownfield = mode === 'brownfield';
  const capabilityId = 'spec.verify';
  return JSON.stringify({
    mode,
    epics: [],
    slices: [],
    execution_contract: {
      schemaVersion: 1,
      requiredCapabilities: [{ id: capabilityId, source: { kind: 'elicited', itemId: 'D1' } }],
      detectedCapabilities: brownfield
        ? [{ id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } }]
        : [],
      resolvedActions: {
        setup: [],
        build: [],
        verify: [
          {
            capabilityId,
            providerId: 'spec-recipe',
            command: 'npm',
            args: brownfield ? ['test'] : ['run', 'verify'],
          },
        ],
      },
      blocked: [],
      conflicts: [],
    },
  });
}

describe('Brunch explicit Pi extension registry', () => {
  it('keeps named factory exports for src/.pi iteration', () => {
    for (const [path, factory] of Object.entries(extensionDefaults)) {
      expect(factory, path).toEqual(expect.any(Function));
    }
  });

  it('keeps product-dependency src/.pi extensions disabled for direct Pi iteration', async () => {
    const settings = JSON.parse(await readFile(join(projectRoot(), 'src/.pi/settings.json'), 'utf8')) as {
      extensions?: unknown;
    };

    expect(settings.extensions).toContain('extensions/chrome/index.ts');
    expect(settings.extensions).not.toContain('!extensions/**');
    expect(settings.extensions).toEqual(
      expect.arrayContaining([
        '-extensions/agent-runtime/index.ts',
        '-extensions/executor/index.ts',
        '-extensions/executor/execute-plan-preview/index.ts',
        '-extensions/executor/execute-plan-check/index.ts',
        '-extensions/executor/execute-plan-draft-artifact/index.ts',
        '-extensions/executor/execute-plan-draft/index.ts',
        '-extensions/executor/execute-plan-outline/index.ts',
        '-extensions/executor/execute-snapshot/index.ts',
        '-extensions/executor/execute-status/index.ts',
        '-extensions/agent-runtime/runtime/index.ts',
        '-extensions/agent-runtime/system-prompts/index.ts',
        '-extensions/brunch-data/context/index.ts',
        '-extensions/brunch-data/elicitation/index.ts',
        '-extensions/brunch-data/graph/index.ts',
        '-extensions/brunch-data/reconciliation/index.ts',
        '-extensions/commands/index.ts',
        '-extensions/commands/policy.ts',
        '-extensions/compaction/index.ts',
        '-extensions/dev-mode/index.ts',
        '-extensions/dev-mode/introspection/index.ts',
        '-extensions/session-hooks/index.ts',
        '-extensions/session-orientation/index.ts',
        '-extensions/subagents/index.ts',
        '-extensions/web-tools/index.ts',
        '-extensions/web-tools/web/index.ts',
        '-extensions/workspace/index.ts',
      ]),
    );
  });

  it('keeps every enabled src/.pi ambient entrypoint default-loadable', async () => {
    const settings = JSON.parse(await readFile(join(projectRoot(), 'src/.pi/settings.json'), 'utf8')) as {
      extensions?: string[];
    };
    const disabledEntrypoints = new Set(
      (settings.extensions ?? [])
        .filter((entry) => entry.startsWith('-'))
        .map((entry) => join(projectRoot(), 'src/.pi', entry.slice(1))),
    );

    const files = await listExtensionEntrypoints();
    for (const file of files) {
      if (disabledEntrypoints.has(file)) continue;
      const source = await readFile(file, 'utf8');
      expect(source, file).toContain('export default');
    }
  });

  it('registers product extensions from the shell in explicit order', async () => {
    const recording = createRecordingExtensionApi();

    await createBrunchPiExtensions(brunchChromeFixture, recording.onSessionBoundary, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
    })(recording.api);

    expect(recording.toolNames).toEqual([
      'read',
      'grep',
      'find',
      'ls',
      'read_workspace_context',
      'read_specification_context',
      'read_session_context',
      'web_fetch',
      'web_search',
      BRUNCH_EXECUTE_STATUS_TOOL,
      BRUNCH_EXECUTE_ORCHESTRATE_TOOL,
      BRUNCH_EXECUTE_AGENT_RESULT_TOOL,
      BRUNCH_EXECUTE_PETRI_EXPORT_TOOL,
      BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL,
      BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL,
      BRUNCH_EXECUTE_POPULATE_TOOL,
      BRUNCH_EXECUTE_REPORT_INIT_TOOL,
      BRUNCH_EXECUTE_RUN_COMPLETE_TOOL,
      BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL,
      BRUNCH_EXECUTE_SOURCE_POLICY_TOOL,
      BRUNCH_EXECUTE_SOURCE_COPY_TOOL,
      BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL,
      BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL,
      BRUNCH_EXECUTE_SLICE_START_TOOL,
      BRUNCH_EXECUTE_TEST_RESULT_TOOL,
      BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL,
      'present_alternatives',
      ASK_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      'present_digest',
      'read_elicitation_scratchpad',
      'update_elicitation_scratchpad',
    ]);
    expect(recording.commandNames).toEqual([
      BRUNCH_LAND_COMMAND,
      BRUNCH_MENU_COMMAND,
      BRUNCH_MODE_COMMAND,
      BRUNCH_CONSULT_COMMAND,
      BRUNCH_CONTINUE_COMMAND,
    ]);
    expect(recording.commandNames).not.toContain(['brunch', 'switch'].join(':'));
    expect(recording.messageRenderers).toEqual(['alternatives-card-set']);
    expect(recording.shortcuts).toEqual([BRUNCH_MODE_PICKER_SHORTCUT, BRUNCH_MENU_SHORTCUT]);
    expect(recording.eventNames).toEqual([
      'session_start',
      'session_start',
      'before_agent_start',
      'message_start',
      'session_start',
      'model_select',
      'thinking_level_select',
      'message_start',
      'turn_start',
      'turn_end',
      'agent_settled',
      'session_before_fork',
      'session_before_compact',
      'session_start',
      'before_agent_start',
      'tool_call',
      'user_bash',
      'before_agent_start',
      'session_start',
    ]);

    const sessionStartIndexes = recording.eventNames.flatMap((event, index) =>
      event === 'session_start' ? [index] : [],
    );
    expect(sessionStartIndexes[0]).toBeLessThan(sessionStartIndexes[1] ?? -1);
  });

  it('registers the comparison bundle without web or Specify subagent surfaces', async () => {
    const recording = createRecordingExtensionApi();
    const definitions = new Map([
      ['planner', { name: 'planner' }],
      ['worker', { name: 'worker' }],
    ]) as BrunchSubagentsDeps['definitions'];

    await createBrunchPiExtensions(brunchChromeFixture, recording.onSessionBoundary, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      allowWebTools: false,
      foregroundFilesystemRoot: '/tmp/comparison-target',
      subagents: {
        definitions,
        delegatableAgents: [],
        maxConcurrency: 1,
        agentDir: '/tmp/agent',
        modelRuntime: {} as never,
        createSettingsManager: () => ({}) as never,
        resourceLoaderOptions: {} as never,
      },
    })(recording.api);

    expect(recording.toolNames).not.toContain('web_fetch');
    expect(recording.toolNames).not.toContain('web_search');
    expect(recording.toolNames).not.toContain(BRUNCH_SUBAGENT_TOOL);
    expect(recording.toolNames).toEqual(
      expect.arrayContaining([
        'read',
        'grep',
        'find',
        'ls',
        BRUNCH_EXECUTE_ORCHESTRATE_TOOL,
        BRUNCH_EXECUTE_AGENT_RESULT_TOOL,
        BRUNCH_EXECUTE_TEST_RESULT_TOOL,
      ]),
    );
    expect([...definitions.keys()]).toEqual(['planner', 'worker']);
  });

  it('registers execute_plan_check only with selected graph deps and returns side-effect-free findings', async () => {
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 12,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 12,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const planCheck = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_CHECK_TOOL);
    expect(planCheck).toBeDefined();
    const result = await planCheck!.execute('call-1', { mode: 'greenfield' });

    expect(result.content[0]?.text).toContain('execute_plan_check: ok');
    expect(result.details).toMatchObject({
      source: { graphLsn: 12, visibility: 'active' },
      sideEffects: [],
      check: {
        status: 'ok',
        counts: { requirements: 1, criteria: 0, verifiedRequirements: 0, criteriaWithRequirement: 0 },
        findings: [expect.objectContaining({ code: 'requirement_without_criterion' })],
        sideEffects: [],
      },
    });
  });

  it('registers execute_plan_preview only with selected graph deps and returns old cook DTO shape', async () => {
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 17,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 17,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const preview = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL);
    expect(preview).toBeDefined();
    const result = await preview!.execute('call-1', { mode: 'brownfield' });

    expect(result.content[0]?.text).toContain('execute_plan_preview: brownfield');
    expect(result.details).toMatchObject({
      source: { graphLsn: 17, visibility: 'active' },
      sideEffects: [],
      preview: {
        schemaVersion: 2,
        mode: 'brownfield',
        spec: {
          spec_id: '42',
          requirements: [{ item_id: 'REQ1', content: 'Feature runs through the alpha executor.' }],
          criteria: [],
        },
        epics: [],
        slices: [expect.not.objectContaining({ id: 'task-1', epic_id: expect.anything() })],
        sideEffects: [],
      },
    });
  });

  it('registers execute_plan_draft only with selected graph deps and returns executable-plan-shaped data', async () => {
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 15,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 15,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const draft = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_DRAFT_TOOL);
    expect(draft).toBeDefined();
    const result = await draft!.execute('call-1', { mode: 'brownfield' });

    expect(result.content[0]?.text).toContain('execute_plan_draft: spec 42 (brownfield)');
    expect(result.details).toMatchObject({
      source: { graphLsn: 15, visibility: 'active' },
      sideEffects: [],
      draft: {
        schemaVersion: 2,
        specId: '42',
        mode: 'brownfield',
        epics: [],
        slices: [expect.not.objectContaining({ id: 'task-1', epicId: expect.anything() })],
        sideEffects: [],
      },
    });
  });

  it('registers execute_plan_draft_artifact only with selected graph deps and writes the draft artifact', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-plan-draft-'));
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
        onUpdate?: unknown,
        ctx?: { cwd: string },
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 16,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 16,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const draftArtifact = registeredTools.find(
      (tool) => tool.name === BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
    );
    expect(draftArtifact).toBeDefined();
    const result = await draftArtifact!.execute('call-1', { mode: 'brownfield' }, undefined, undefined, {
      cwd,
    });

    expect(result.content[0]?.text).toContain('execute_plan_draft_artifact:');
    expect(result.details.sideEffects).toEqual([
      {
        kind: 'write_file',
        path: join(cwd, '.brunch', 'execution-reports', '42', 'executable-plan-draft.json'),
        ifExists: 'overwrite',
      },
    ]);
    await expect(
      readFile(join(cwd, '.brunch', 'execution-reports', '42', 'executable-plan-draft.json'), 'utf8'),
    ).resolves.toContain('Run the cooked feature');
  });

  it('registers execute_plan_file only with selected graph deps and writes one bounded plan.json', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-plan-file-'));
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
        onUpdate?: unknown,
        ctx?: { cwd: string },
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 18,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 2,
                  specId: 42,
                  plane: 'oracle',
                  kind: 'vv_method',
                  kindOrdinal: 1,
                  title: 'Project execution harness',
                  body: 'execute.verify: npm test',
                  basis: 'explicit',
                  settlement: 'settled',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 18,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const planFile = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_FILE_TOOL);
    expect(planFile).toBeDefined();
    const result = await planFile!.execute('call-1', { mode: 'brownfield' }, undefined, undefined, { cwd });

    const path = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    expect(result.content[0]?.text).toContain('execute_plan_file:');
    expect(result.details).toMatchObject({
      artifact: { path, provenancePath, writeMode: 'overwrite' },
      source: { graphLsn: 18, visibility: 'active' },
      sideEffects: [
        { kind: 'write_file', path, ifExists: 'overwrite' },
        { kind: 'write_file', path: provenancePath, ifExists: 'overwrite' },
      ],
    });
    const payload = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    expect(payload).toMatchObject({ mode: 'brownfield', spec: { spec_id: '42' } });
    expect(payload).not.toHaveProperty('schemaVersion');
    expect(payload).not.toHaveProperty('sideEffects');
    const provenance = JSON.parse(await readFile(provenancePath, 'utf8')) as Record<string, unknown>;
    expect(provenance).toMatchObject({
      schemaVersion: 1,
      specId: '42',
      mode: 'brownfield',
      source: { graphLsn: 18, visibility: 'active' },
    });
  });

  it('persists authored frontier semantics through the registered execute_plan_file production path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-plan-file-authored-'));
    const base = {
      specId: 42,
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    } as const;
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 19,
        nodes: [
          { ...base, id: 1, plane: 'plan', kind: 'frontier', kindOrdinal: 1, title: 'Foundation' },
          { ...base, id: 2, plane: 'plan', kind: 'frontier', kindOrdinal: 2, title: 'Feature' },
          { ...base, id: 10, plane: 'intent', kind: 'requirement', kindOrdinal: 1, title: 'Build base' },
          { ...base, id: 11, plane: 'intent', kind: 'requirement', kindOrdinal: 2, title: 'Build feature' },
          { ...base, id: 12, plane: 'intent', kind: 'requirement', kindOrdinal: 3, title: 'Orphan task' },
          {
            ...base,
            id: 20,
            plane: 'intent',
            kind: 'criterion',
            kindOrdinal: 1,
            title: 'Feature verified',
          },
          {
            ...base,
            id: 30,
            plane: 'oracle',
            kind: 'vv_method',
            kindOrdinal: 1,
            title: 'Project execution harness',
            body: 'execute.verify: npm test',
          },
        ],
        edges: [
          { ...base, id: 1, category: 'composition', sourceId: 1, targetId: 10 },
          { ...base, id: 2, category: 'composition', sourceId: 2, targetId: 11 },
          { ...base, id: 3, category: 'dependency', sourceId: 1, targetId: 2 },
          { ...base, id: 4, category: 'witness', sourceId: 20, targetId: 2, stance: 'for' },
          { ...base, id: 5, category: 'witness', sourceId: 20, targetId: 11, stance: 'for' },
        ],
      },
    });
    const planFile = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_FILE_TOOL)!;

    await planFile.execute('call-1', { mode: 'greenfield' }, undefined, undefined, { cwd });

    const payload = JSON.parse(await readFile(planFilePath(cwd, '42'), 'utf8')) as {
      readonly epics: readonly unknown[];
      readonly slices: readonly unknown[];
    };
    expect(payload.epics).toEqual([
      { id: 'F1', summary: 'Foundation', depends_on: [], verification: [] },
      {
        id: 'F2',
        summary: 'Feature',
        depends_on: ['F1'],
        verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature verified' }],
      },
    ]);
    expect(payload.slices).toEqual([
      expect.objectContaining({ id: 'task-1', epic_id: 'F1', derived_from: ['REQ1'] }),
      expect.objectContaining({
        id: 'task-2',
        epic_id: 'F2',
        derived_from: ['REQ2'],
        verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature verified' }],
      }),
      expect.not.objectContaining({ id: 'task-3', epic_id: expect.anything() }),
    ]);
    expect(payload.slices[2]).toMatchObject({ id: 'task-3', derived_from: ['REQ3'] });
  });

  it('registers execute_launch as a selected-spec non-running readiness boundary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-launch-'));
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
        onUpdate?: unknown,
        ctx?: { cwd: string },
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 19,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 2,
                  specId: 42,
                  plane: 'intent',
                  kind: 'criterion',
                  kindOrdinal: 1,
                  title: 'Feature visible',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [
                {
                  id: 1,
                  specId: 42,
                  category: 'witness',
                  stance: 'for',
                  sourceId: 2,
                  targetId: 1,
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 19,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const launch = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_LAUNCH_TOOL);
    expect(launch).toBeDefined();
    const missing = await launch!.execute('call-1', {}, undefined, undefined, { cwd });

    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    expect(missing.content[0]?.text).toContain('execute_launch: missing_plan');
    expect(missing.details).toMatchObject({
      result: { status: 'missing_plan', runStatus: 'not_started', planPath, sideEffects: [] },
      sideEffects: [],
    });

    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 19, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    const ready = await launch!.execute('call-2', {}, undefined, undefined, { cwd });

    expect(ready.content[0]?.text).toContain('execute_launch: ready');
    expect(ready.details).toMatchObject({
      result: { status: 'ready', runStatus: 'not_started', planPath, sideEffects: [] },
      sideEffects: [],
    });

    await writeFile(planPath, '{"mode":"brownfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'brownfield',
        source: { graphLsn: 19, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    const brownfieldReady = await launch!.execute('call-3', {}, undefined, undefined, { cwd });
    expect(brownfieldReady.content[0]?.text).toContain('execute_launch: ready');
    expect(brownfieldReady.details).toMatchObject({
      result: { status: 'ready', provenance: { mode: 'brownfield' } },
    });
    await expect(access(join(cwd, '.brunch', 'cook', 'runs'))).rejects.toThrow();
  });

  it('registers execute_run_create with an attachable immutable Petrinaut observation snapshot', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-create-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, admittedPlanPayload('greenfield'), 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 20, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
        onUpdate?: unknown,
        ctx?: { cwd: string },
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 20,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 2,
                  specId: 42,
                  plane: 'intent',
                  kind: 'criterion',
                  kindOrdinal: 1,
                  title: 'Feature visible',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [
                {
                  id: 1,
                  specId: 42,
                  category: 'witness',
                  stance: 'for',
                  sourceId: 2,
                  targetId: 1,
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 20,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const createRun = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_RUN_CREATE_TOOL);
    expect(createRun).toBeDefined();
    const result = await createRun!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    expect(result.content[0]?.text).toContain('execute_run_create: created');
    expect(result.details).toMatchObject({
      result: {
        status: 'created',
        runStatus: 'created',
        runId: 'run-1',
        runDir,
        metadataPath,
        planPath,
      },
      sideEffects: [
        { kind: 'mkdir', path: runDir },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
        { kind: 'mkdir', path: join(runDir, 'petrinaut') },
        { kind: 'write_file', path: join(runDir, 'petrinaut', 'plan.json') },
        { kind: 'write_file', path: join(runDir, 'petrinaut', 'net.json') },
        { kind: 'write_file', path: join(runDir, 'petrinaut', 'net.sdcpn.json') },
        { kind: 'write_file', path: join(runDir, 'petrinaut', 'events.jsonl') },
      ],
    });
    // Mode is the sole authority: the greenfield plan derives the isolated empty_dir substrate.
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"substrate": "empty_dir"');
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"mode": "greenfield"');
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"command": "npm"');
    await expect(access(join(runDir, 'worktree'))).rejects.toThrow();
    await expect(access(join(runDir, 'reports.jsonl'))).rejects.toThrow();
    await expect(readFile(join(runDir, 'petrinaut', 'events.jsonl'), 'utf8')).resolves.toBe('');
  });

  it('registers execute_run_create using persisted brownfield mode when mode is omitted', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-create-brownfield-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, admittedPlanPayload('brownfield'), 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'brownfield',
        source: { graphLsn: 20, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 20,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Brownfield requirement',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [],
      },
    });

    const createRun = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_RUN_CREATE_TOOL);
    const result = await createRun!.execute('call-1', { runId: 'run-brownfield' }, undefined, undefined, {
      cwd,
    });

    expect(result.content[0]?.text).toContain('execute_run_create: created');
    const metadata = await readFile(
      join(cwd, '.brunch', 'cook', 'runs', 'run-brownfield', 'run.json'),
      'utf8',
    );
    expect(metadata).toContain('"status": "created"');
    // Mode is the sole authority: brownfield derives the host git_worktree substrate.
    expect(JSON.parse(metadata)).toMatchObject({ mode: 'brownfield', substrate: 'git_worktree' });
    // The derivation is unrepresentable to contradict: the tool has no substrate/mode inputs.
    expect(JSON.stringify(createRun!.parameters)).not.toContain('substrate');
    expect(JSON.stringify(createRun!.parameters)).not.toContain('"mode"');
  });

  it('registers execute_replan_recommendation as read-only HITL diagnosis', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-recommendation-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(dirname(planPath), { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 21, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'agent_result_ingested' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 21,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Run the cooked feature',
            body: 'Feature runs through the alpha executor.',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
          {
            id: 2,
            specId: 42,
            plane: 'intent',
            kind: 'criterion',
            kindOrdinal: 1,
            title: 'Feature visible',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [
          {
            id: 1,
            specId: 42,
            category: 'witness',
            stance: 'for',
            sourceId: 2,
            targetId: 1,
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
      },
    });

    const recommend = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL);
    expect(recommend).toBeDefined();
    const result = await recommend!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_replan_recommendation: retry_current_run');
    expect(result.content[0]?.text).toContain('recommended action: retry_current_step');
    expect(result.details).toMatchObject({
      recommendation: {
        status: 'retry_current_run',
        recommendedAction: 'retry_current_step',
        allowedActions: ['retry_current_step', 'inspect_run', 'abandon_run'],
        sideEffects: [],
      },
      sideEffects: [],
    });
    await expect(access(join(runDir, 'worktree'))).rejects.toThrow();
  });

  it('diagnoses replanning against the requested run spec when selected spec differs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-recommendation-run-spec-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    await mkdir(dirname(planPath), { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 21, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDir, 'run.json'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'agent_result_ingested' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 7, lsn: 99, nodes: [], edges: [] },
      graphsBySpec: {
        7: { specId: 7, lsn: 99, nodes: [], edges: [] },
        42: {
          specId: 42,
          lsn: 21,
          nodes: [
            {
              id: 1,
              specId: 42,
              plane: 'intent',
              kind: 'requirement',
              kindOrdinal: 1,
              title: 'Run spec requirement',
              basis: 'explicit',
              createdAtLsn: 1,
              updatedAtLsn: 1,
            },
          ],
          edges: [],
        },
      },
    });

    const recommend = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL);
    const result = await recommend!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_replan_recommendation: retry_current_run');
    expect(result.content[0]?.text).toContain('graph lsn: 21');
    expect(result.details).toMatchObject({
      recommendation: { status: 'retry_current_run', runStatus: 'agent_result_ingested' },
    });
  });

  it('registers execute_replan_start_new_run as explicit supersession creation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-start-new-run-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const oldRunDir = join(cwd, '.brunch', 'cook', 'runs', 'run-old');
    const oldMetadataPath = join(oldRunDir, 'run.json');
    await mkdir(dirname(planPath), { recursive: true });
    await mkdir(oldRunDir, { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 22, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    await writeFile(
      oldMetadataPath,
      JSON.stringify({ runId: 'run-old', specId: '42', planPath, status: 'agent_result_ingested' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 22,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Run the cooked feature',
            body: 'Feature runs through the alpha executor.',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
          {
            id: 2,
            specId: 42,
            plane: 'intent',
            kind: 'criterion',
            kindOrdinal: 1,
            title: 'Feature visible',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [
          {
            id: 1,
            specId: 42,
            category: 'witness',
            stance: 'for',
            sourceId: 2,
            targetId: 1,
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
      },
    });

    const startNewRun = registeredTools.find(
      (tool) => tool.name === BRUNCH_EXECUTE_REPLAN_START_NEW_RUN_TOOL,
    );
    expect(startNewRun).toBeDefined();
    const result = await startNewRun!.execute(
      'call-1',
      { previousRunId: 'run-old', runId: 'run-new' },
      undefined,
      undefined,
      { cwd },
    );

    const newMetadataPath = join(cwd, '.brunch', 'cook', 'runs', 'run-new', 'run.json');
    expect(result.content[0]?.text).toContain('execute_replan_start_new_run: created');
    expect(result.details).toMatchObject({
      result: {
        status: 'created',
        runStatus: 'created',
        previousRunId: 'run-old',
        runId: 'run-new',
        metadataPath: newMetadataPath,
        planPath,
      },
      sideEffects: [
        { kind: 'mkdir', path: dirname(newMetadataPath) },
        { kind: 'write_file', path: newMetadataPath, ifExists: 'overwrite' },
        { kind: 'mkdir', path: join(dirname(newMetadataPath), 'petrinaut') },
        { kind: 'write_file', path: join(dirname(newMetadataPath), 'petrinaut', 'plan.json') },
        { kind: 'write_file', path: join(dirname(newMetadataPath), 'petrinaut', 'net.json') },
        { kind: 'write_file', path: join(dirname(newMetadataPath), 'petrinaut', 'net.sdcpn.json') },
        { kind: 'write_file', path: join(dirname(newMetadataPath), 'petrinaut', 'events.jsonl') },
      ],
    });
    await expect(readFile(oldMetadataPath, 'utf8')).resolves.not.toContain('supersedesRunId');
    await expect(readFile(newMetadataPath, 'utf8')).resolves.toContain('"supersedesRunId": "run-old"');
  });

  it('registers execute_replan_retry_current_step as guarded one-step retry', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-retry-current-step-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(dirname(planPath), { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 23, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'created' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 23,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Run the cooked feature',
            body: 'Feature runs through the alpha executor.',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
          {
            id: 2,
            specId: 42,
            plane: 'intent',
            kind: 'criterion',
            kindOrdinal: 1,
            title: 'Feature visible',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [
          {
            id: 1,
            specId: 42,
            category: 'witness',
            stance: 'for',
            sourceId: 2,
            targetId: 1,
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
      },
      gitWorktree: createFakeGitWorktreePort(),
    });

    const retry = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL);
    expect(retry).toBeDefined();
    const result = await retry!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_replan_retry_current_step: retried_current_step');
    expect(result.content[0]?.text).toContain('outcome run status: worktree_created');
    expect(result.details).toMatchObject({
      result: {
        status: 'retried_current_step',
        eligibility: { status: 'retry_current_run' },
        outcome: { status: 'completed', runStatus: 'worktree_created' },
        sideEffects: [],
      },
      sideEffects: [],
    });
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"status": "worktree_created"');

    await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'worktree_created',
        step: 'populate',
        reason: 'operator_halt',
        failedSliceIds: [],
      },
    });
    const terminalMetadata = await readFile(metadataPath, 'utf8');

    const blocked = await retry!.execute('call-2', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(blocked.content[0]?.text).toContain('execute_replan_retry_current_step: retry_not_allowed');
    expect(blocked.details).toMatchObject({
      result: {
        status: 'retry_not_allowed',
        eligibility: {
          status: 'terminal_run',
          allowedActions: ['start_new_run', 'inspect_run', 'abandon_run'],
          terminal: { kind: 'net_halted', reason: 'operator_halt' },
        },
        sideEffects: [],
      },
      sideEffects: [],
    });
    await expect(readFile(metadataPath, 'utf8')).resolves.toBe(terminalMetadata);
  });

  it('registers execute_replan_retry_current_step as stale-run refusal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-retry-current-step-stale-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(dirname(planPath), { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 22, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'created' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 23,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Run the cooked feature',
            body: 'Feature runs through the alpha executor.',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
          {
            id: 2,
            specId: 42,
            plane: 'intent',
            kind: 'criterion',
            kindOrdinal: 1,
            title: 'Feature visible',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [
          {
            id: 1,
            specId: 42,
            category: 'witness',
            stance: 'for',
            sourceId: 2,
            targetId: 1,
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
      },
      gitWorktree: createFakeGitWorktreePort(),
    });

    const retry = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL);
    const result = await retry!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_replan_retry_current_step: retry_not_allowed');
    expect(result.details).toMatchObject({
      result: { status: 'retry_not_allowed', eligibility: { status: 'replan_before_retry' } },
      sideEffects: [],
    });
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"status":"created"');
  });

  it('registers execute_replan_regenerate_plan as guarded early-run plan refresh', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-regenerate-plan-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(dirname(planPath), { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 22, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    const originalMetadata = { runId: 'run-1', specId: '42', planPath, status: 'created' };
    await writeFile(metadataPath, JSON.stringify(originalMetadata), 'utf8');
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 23,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Run the cooked feature',
            body: 'Feature runs through the alpha executor.',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
          {
            id: 2,
            specId: 42,
            plane: 'intent',
            kind: 'criterion',
            kindOrdinal: 1,
            title: 'Feature visible',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [
          {
            id: 1,
            specId: 42,
            category: 'witness',
            stance: 'for',
            sourceId: 2,
            targetId: 1,
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
      },
    });

    const regenerate = registeredTools.find(
      (tool) => tool.name === BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL,
    );
    expect(regenerate).toBeDefined();
    const result = await regenerate!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_replan_regenerate_plan: regenerated_plan');
    expect(result.details).toMatchObject({
      result: {
        status: 'regenerated_plan',
        eligibility: { status: 'replan_before_retry' },
        artifact: { path: planPath, provenancePath, writeMode: 'overwrite' },
      },
      sideEffects: [
        { kind: 'write_file', path: planPath, ifExists: 'overwrite' },
        { kind: 'write_file', path: provenancePath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(provenancePath, 'utf8')).resolves.toContain('"graphLsn": 23');
    await expect(readFile(metadataPath, 'utf8')).resolves.toBe(JSON.stringify(originalMetadata));
  });

  it('regenerates the requested run spec plan, not the selected session spec plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-regenerate-plan-run-spec-'));
    const runPlanPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const runProvenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const selectedPlanPath = join(cwd, '.brunch', 'cook', 'specs', '7', 'plan.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(dirname(runPlanPath), { recursive: true });
    await mkdir(dirname(selectedPlanPath), { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(runPlanPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(selectedPlanPath, 'selected spec must not be touched\n', 'utf8');
    await writeFile(
      runProvenancePath,
      `${JSON.stringify({
        schemaVersion: 1,
        specId: '42',
        mode: 'greenfield',
        source: { graphLsn: 22, visibility: 'active' },
      })}\n`,
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: runPlanPath, status: 'created' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: {
        specId: 7,
        lsn: 23,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Run spec requirement',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [],
      },
    });

    const regenerate = registeredTools.find(
      (tool) => tool.name === BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL,
    );
    const result = await regenerate!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.details).toMatchObject({
      result: {
        status: 'regenerated_plan',
        artifact: { path: runPlanPath, provenancePath: runProvenancePath },
      },
    });
    await expect(readFile(runProvenancePath, 'utf8')).resolves.toContain('"specId": "42"');
    await expect(readFile(runProvenancePath, 'utf8')).resolves.toContain('"graphLsn": 23');
    await expect(readFile(selectedPlanPath, 'utf8')).resolves.toBe('selected spec must not be touched\n');
  });

  it('registers execute_replan_regenerate_plan as fresh-run refusal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-regenerate-plan-fresh-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const provenancePath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.provenance.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(dirname(planPath), { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      provenancePath,
      `${JSON.stringify({ schemaVersion: 1, specId: '42', mode: 'greenfield', source: { graphLsn: 24, visibility: 'active' } })}\n`,
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'created' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: {
        specId: 42,
        lsn: 24,
        nodes: [
          {
            id: 1,
            specId: 42,
            plane: 'intent',
            kind: 'requirement',
            kindOrdinal: 1,
            title: 'Run the cooked feature',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
          {
            id: 2,
            specId: 42,
            plane: 'intent',
            kind: 'criterion',
            kindOrdinal: 1,
            title: 'Feature visible',
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
        edges: [
          {
            id: 1,
            specId: 42,
            category: 'witness',
            stance: 'for',
            sourceId: 2,
            targetId: 1,
            basis: 'explicit',
            createdAtLsn: 1,
            updatedAtLsn: 1,
          },
        ],
      },
    });

    const regenerate = registeredTools.find(
      (tool) => tool.name === BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL,
    );
    const result = await regenerate!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_replan_regenerate_plan: regenerate_not_allowed');
    expect(result.details).toMatchObject({
      result: { status: 'regenerate_not_allowed', eligibility: { status: 'retry_current_run' } },
      sideEffects: [],
    });
  });

  it('registers execute_replan_abandon_run as evidence-preserving abandonment', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-abandon-run-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/plan.json',
        status: 'agent_result_ingested',
        worktreeDir: '/worktree',
      }),
      'utf8',
    );
    const registeredTools = await collectProductTools();

    const abandon = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL);
    expect(abandon).toBeDefined();
    const result = await abandon!.execute(
      'call-1',
      { runId: 'run-1', reason: 'User chose a new plan' },
      undefined,
      undefined,
      { cwd },
    );

    expect(result.content[0]?.text).toContain('execute_replan_abandon_run: abandoned');
    expect(result.details).toMatchObject({
      result: {
        status: 'abandoned',
        runStatus: 'abandoned',
        runId: 'run-1',
        metadataPath,
      },
      sideEffects: [{ kind: 'write_file', path: metadataPath, ifExists: 'overwrite' }],
    });
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"status": "abandoned"');
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"worktreeDir": "/worktree"');
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain(
      '"abandonReason": "User chose a new plan"',
    );
  });

  it('registers execute_worktree_create as empty worktree materialization only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-worktree-create-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.json', status: 'created' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 21, nodes: [], edges: [] },
      gitWorktree: createFakeGitWorktreePort(),
    });

    const createWorktree = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL);
    expect(createWorktree).toBeDefined();
    const result = await createWorktree!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    const worktreeDir = join(runDir, 'worktree');
    expect(result.content[0]?.text).toContain('execute_worktree_create: worktree_created');
    expect(result.details).toMatchObject({
      result: { status: 'worktree_created', runStatus: 'worktree_created', runId: 'run-1', worktreeDir },
      sideEffects: [
        { kind: 'git_worktree_add', path: worktreeDir, ref: 'HEAD' },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(access(worktreeDir)).resolves.toBeUndefined();
    await expect(access(join(runDir, 'reports.jsonl'))).rejects.toThrow();
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
  });

  it('registers execute_populate as plan-only worktree population', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-populate-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.json');
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const worktreeDir = join(runDir, 'worktree');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'worktree_created', worktreeDir }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 22, nodes: [], edges: [] },
    });

    const populate = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_POPULATE_TOOL);
    expect(populate).toBeDefined();
    const result = await populate!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    const populatedPlan = join(worktreeDir, '.brunch', 'cook', 'plan.json');
    expect(result.content[0]?.text).toContain('execute_populate: worktree_populated');
    expect(result.details).toMatchObject({
      result: {
        status: 'worktree_populated',
        runStatus: 'worktree_populated',
        runId: 'run-1',
        populatedPlanPath: populatedPlan,
      },
      sideEffects: [
        { kind: 'mkdir', path: dirname(populatedPlan) },
        { kind: 'write_file', path: populatedPlan, ifExists: 'overwrite' },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(populatedPlan, 'utf8')).resolves.toContain('"mode":"greenfield"');
    await expect(access(join(runDir, 'reports.jsonl'))).rejects.toThrow();
  });

  it('registers execute_source_policy as policy-only source selection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-source-policy-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const worktreeDir = join(runDir, 'worktree');
    const metadataPath = join(runDir, 'run.json');
    const populatedPlan = join(worktreeDir, '.brunch', 'cook', 'plan.json');
    const policyPath = join(runDir, 'source-policy.json');
    await mkdir(dirname(populatedPlan), { recursive: true });
    await writeFile(populatedPlan, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'worktree_populated',
        worktreeDir,
        populatedPlanPath: populatedPlan,
      }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 23, nodes: [], edges: [] },
    });

    const sourcePolicy = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SOURCE_POLICY_TOOL);
    expect(sourcePolicy).toBeDefined();
    const result = await sourcePolicy!.execute(
      'call-1',
      { runId: 'run-1', policy: 'plan_only' },
      undefined,
      undefined,
      { cwd },
    );

    expect(result.content[0]?.text).toContain('execute_source_policy: source_policy_selected');
    expect(result.details).toMatchObject({
      result: {
        status: 'source_policy_selected',
        runStatus: 'source_policy_selected',
        runId: 'run-1',
        sourcePolicyPath: policyPath,
        policy: 'plan_only',
      },
      sideEffects: [
        { kind: 'write_file', path: policyPath, ifExists: 'overwrite' },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(policyPath, 'utf8')).resolves.toContain('"hostSourceCopied": false');
    await expect(access(join(runDir, 'src'))).rejects.toThrow();
    await expect(access(join(runDir, 'reports.jsonl'))).rejects.toThrow();
  });

  it('registers execute_source_copy as bounded host source copy', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-source-copy-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const worktreeDir = join(runDir, 'worktree');
    const metadataPath = join(runDir, 'run.json');
    const policyPath = join(runDir, 'source-policy.json');
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
    await writeFile(join(cwd, 'package.json'), '{"type":"module"}\n', 'utf8');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'source_policy_selected',
        worktreeDir,
        sourcePolicy: 'host_source_deferred',
        sourcePolicyPath: policyPath,
      }),
      'utf8',
    );
    await writeFile(
      policyPath,
      JSON.stringify({ policy: 'host_source_deferred', hostSourceCopied: false }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 24, nodes: [], edges: [] },
    });

    const sourceCopy = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SOURCE_COPY_TOOL);
    expect(sourceCopy).toBeDefined();
    const result = await sourceCopy!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_source_copy: source_copied');
    expect(result.details).toMatchObject({
      result: {
        status: 'source_copied',
        runStatus: 'source_copied',
        runId: 'run-1',
        copiedEntries: ['package.json', 'src'],
      },
      sideEffects: [
        { kind: 'copy_entry', from: join(cwd, 'package.json'), to: join(worktreeDir, 'package.json') },
        { kind: 'copy_entry', from: join(cwd, 'src'), to: join(worktreeDir, 'src') },
        { kind: 'write_file', path: policyPath, ifExists: 'overwrite' },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(join(worktreeDir, 'src', 'app.ts'), 'utf8')).resolves.toContain('app = true');
    await expect(access(join(runDir, 'reports.jsonl'))).rejects.toThrow();
  });

  it('registers execute_report_init as report-log initialization only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-report-init-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportsPath = join(runDir, 'reports.jsonl');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.json', status: 'source_copied' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 25, nodes: [], edges: [] },
    });

    const reportInit = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_REPORT_INIT_TOOL);
    expect(reportInit).toBeDefined();
    const result = await reportInit!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_report_init: reports_initialized');
    expect(result.details).toMatchObject({
      result: {
        status: 'reports_initialized',
        runStatus: 'reports_initialized',
        runId: 'run-1',
        reportsPath,
      },
      sideEffects: [
        { kind: 'write_file', path: reportsPath, ifExists: 'overwrite' },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(reportsPath, 'utf8')).resolves.toContain('run_ready');
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
  });

  it('registers execute_slice_start as slice-start marker only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-slice-start-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const worktreePlan = join(runDir, 'worktree', '.brunch', 'cook', 'plan.json');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    await mkdir(dirname(worktreePlan), { recursive: true });
    await writeFile(
      worktreePlan,
      JSON.stringify({ slices: [{ id: 'task-1', epic_id: 'frontier-1' }] }),
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        populatedPlanPath: worktreePlan,
        status: 'reports_initialized',
        reportsPath: reportPath,
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 26, nodes: [], edges: [] },
    });

    const sliceStart = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SLICE_START_TOOL);
    expect(sliceStart).toBeDefined();
    const result = await sliceStart!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_slice_start: slice_started');
    expect(result.details).toMatchObject({
      result: { status: 'slice_started', runStatus: 'slice_started', runId: 'run-1', sliceId: 'task-1' },
      sideEffects: [
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(reportPath, 'utf8')).resolves.toContain('slice_started');
    await expect(access(join(runDir, 'agent-output'))).rejects.toThrow();
  });

  it('registers execute_slice_execute as execution request only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-slice-execute-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const populatedPlanPath = join(runDir, 'populated-plan.json');
    const worktreeDir = join(runDir, 'worktree');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      populatedPlanPath,
      JSON.stringify({
        scope_handoff_required: false,
        slices: [
          {
            id: 'task-1',
            epic_id: 'frontier-1',
            definition: 'Execute the requested slice.',
            verification: [],
            derived_from: ['REQ1'],
          },
        ],
      }),
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        populatedPlanPath,
        status: 'slice_started',
        worktreeDir,
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 27, nodes: [], edges: [] },
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    const sliceExecute = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL);
    expect(sliceExecute).toBeDefined();
    const result = await sliceExecute!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    const requestPath = join(runDir, 'agent-output', 'task-1', 'request.json');
    expect(result.content[0]?.text).toContain('execute_slice_execute: slice_execution_requested');
    expect(result.details).toMatchObject({
      result: {
        status: 'slice_execution_requested',
        runStatus: 'slice_execution_requested',
        runId: 'run-1',
        requestPath,
      },
      sideEffects: [
        {
          kind: 'git_worktree_add',
          path: join(runDir, 'slice-workspaces', 'task-1', 'worktree'),
          ref: 'base123',
        },
        { kind: 'mkdir', path: dirname(requestPath) },
        { kind: 'write_file', path: requestPath, ifExists: 'overwrite' },
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(requestPath, 'utf8')).resolves.toContain('execute_slice');
    await expect(access(join(runDir, 'agent-output', 'task-1', 'result.json'))).rejects.toThrow();
  });

  it('registers execute_agent_result as injected agent-runner ingestion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-agent-result-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const worktreeDir = join(runDir, 'worktree');
    const requestPath = join(runDir, 'agent-output', 'task-1', 'request.json');
    const resultPath = join(runDir, 'agent-output', 'task-1', 'attempt-1', 'result.json');
    await mkdir(dirname(requestPath), { recursive: true });
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(
      requestPath,
      JSON.stringify({ action: 'execute_slice', scopeHandoffRequired: false, task: 'execute_slice' }),
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'slice_execution_requested',
        worktreeDir,
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
        sliceExecutionRequestPath: requestPath,
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const calls: AgentRunArgs[] = [];
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 28, nodes: [], edges: [] },
      agentRunner: {
        async run(args) {
          calls.push(args);
          return { status: 'completed', summary: 'Implemented task.' };
        },
      },
    });

    const agentResult = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_AGENT_RESULT_TOOL);
    expect(agentResult).toBeDefined();
    const modelRegistry = { marker: 'registry' };
    const model = { provider: 'faux', id: 'model' };
    const result = await agentResult!.execute('call-1', { runId: 'run-1' }, undefined, undefined, {
      cwd,
      modelRegistry,
      model,
    });

    expect(result.content[0]?.text).toContain('execute_agent_result: agent_result_ingested');
    expect(calls).toEqual([
      {
        worktreeDir,
        requestPath,
        resultPath,
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        cycle: 1,
        onUpdate: expect.any(Function),
        runtime: { modelRegistry, model },
      },
    ]);
    expect(result.details).toMatchObject({
      result: { status: 'agent_result_ingested', runStatus: 'agent_result_ingested', resultPath },
      sideEffects: [
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(reportPath, 'utf8')).resolves.toContain('slice_agent_result');
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
  });

  it('registers execute_agent_result through default sealed-worker composition', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-agent-default-runner-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const worktreeDir = join(runDir, 'worktree');
    const requestPath = join(runDir, 'agent-output', 'task-1', 'request.json');
    const resultPath = join(runDir, 'agent-output', 'task-1', 'attempt-1', 'result.json');
    await mkdir(dirname(requestPath), { recursive: true });
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(
      requestPath,
      JSON.stringify({ action: 'execute_slice', scopeHandoffRequired: false, task: 'write proof' }),
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'slice_execution_requested',
        worktreeDir,
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
        sliceExecutionRequestPath: requestPath,
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const calls: Array<{ agent: string; cwd: string; task: string }> = [];
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 28, nodes: [], edges: [] },
      subagents: workerSubagents(async ({ definition, ctx, task }): Promise<SubagentResult> => {
        calls.push({ agent: definition.name, cwd: ctx.cwd, task });
        await writeFile(join(ctx.cwd, 'worker-proof.txt'), 'changed by worker\n', 'utf8');
        return { agent: definition.name, status: 'ok', text: 'Wrote worker-proof.txt' };
      }),
    });

    const agentResult = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_AGENT_RESULT_TOOL);
    const modelRegistry = { marker: 'registry' };
    const result = await agentResult!.execute('call-1', { runId: 'run-1' }, undefined, undefined, {
      cwd,
      modelRegistry,
    });

    expect(result.content[0]?.text).toContain('execute_agent_result: agent_result_ingested');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ agent: 'worker', cwd: worktreeDir });
    expect(calls[0]!.task).toContain('write proof');
    await expect(readFile(join(worktreeDir, 'worker-proof.txt'), 'utf8')).resolves.toBe(
      'changed by worker\n',
    );
    await expect(readFile(resultPath, 'utf8')).resolves.toContain('Wrote worker-proof.txt');
  });

  it('registers execute_test_result as injected verify-subprocess ingestion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-test-result-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const worktreeDir = join(runDir, 'worktree');
    const requestPath = join(runDir, 'agent-output', 'task-1', 'request.json');
    await mkdir(dirname(requestPath), { recursive: true });
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(
      requestPath,
      JSON.stringify({ action: 'execute_slice', scopeHandoffRequired: false, task: 'execute_slice' }),
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'slice_execution_requested',
        worktreeDir,
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 29, nodes: [], edges: [] },
      agentRunner: {
        async run() {
          return { status: 'completed', summary: 'Implemented task.' };
        },
      },
      testRunner: createFakeTestRunnerPort(),
    });

    const agentResult = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_AGENT_RESULT_TOOL);
    const testResult = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_TEST_RESULT_TOOL);
    expect(agentResult).toBeDefined();
    expect(testResult).toBeDefined();
    await agentResult!.execute('call-agent', { runId: 'run-1' }, undefined, undefined, { cwd });
    const result = await testResult!.execute('call-test', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_test_result: test_result_ingested');
    expect(result.details).toMatchObject({
      result: {
        status: 'test_result_ingested',
        runStatus: 'test_result_ingested',
        verdict: 'passed',
        worktreeDir,
      },
      sideEffects: [
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(reportPath, 'utf8')).resolves.toContain('slice_test_result');
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
  });

  it('registers execute_slice_complete as explicit integration then completion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-slice-complete-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const worktreeDir = join(runDir, 'worktree');
    const sliceWorktreeDir = join(runDir, 'slice-workspaces', 'task-1', 'worktree');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'test_result_ingested',
        worktreeDir,
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
        activeSliceWorkspaceDir: sliceWorktreeDir,
        activeSliceBaseSha: 'base123',
      }),
      'utf8',
    );
    await writeFile(
      reportPath,
      '{"event":"run_ready"}\n{"event":"slice_test_result","sliceId":"task-1","status":"passed"}\n',
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 30, nodes: [], edges: [] },
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    const complete = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL);
    expect(complete).toBeDefined();
    const result = await complete!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_slice_complete: slice_completed');
    expect(result.details).toMatchObject({
      result: { status: 'slice_completed', runStatus: 'slice_completed', sliceId: 'task-1' },
      sideEffects: [
        { kind: 'git_commit', path: sliceWorktreeDir, sha: 'slice123' },
        { kind: 'git_integrate', path: worktreeDir, sha: 'integrated123' },
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(reportPath, 'utf8')).resolves.toContain('slice_completed');
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
  });

  it('registers execute_petri_export as topology plus SDCPN export', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-petri-export-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const planPath = join(cwd, 'plan.json');
    await mkdir(runDir, { recursive: true });
    await writeFile(planPath, JSON.stringify({ mode: 'greenfield', slices: [{ id: 'task-1' }] }), 'utf8');
    await writeFile(reportPath, '{"event":"run_completed","runId":"run-1"}\n', 'utf8');
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'run_completed',
        reportsPath: reportPath,
        completedSliceIds: ['task-1'],
      }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 31, nodes: [], edges: [] },
    });

    const petriExport = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PETRI_EXPORT_TOOL);
    expect(petriExport).toBeDefined();
    const result = await petriExport!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    const petriPath = join(runDir, 'petrinaut', 'net.json');
    const sdcpnPath = join(runDir, 'petrinaut', 'net.sdcpn.json');
    expect(result.content[0]?.text).toContain('execute_petri_export: petri_exported');
    expect(result.content[0]?.text).toContain(`net: ${petriPath}`);
    expect(result.content[0]?.text).toContain(`sdcpn: ${sdcpnPath}`);
    expect(result.content[0]?.text).toContain('sse: /petrinaut/stream?runId=run-1');
    expect(result.content[0]?.text).toContain('launch: /petrinaut/launch?runId=run-1');
    expect(result.details).toMatchObject({
      result: { status: 'petri_exported', petriPath, petriSdcpnPath: sdcpnPath },
      sideEffects: [
        { kind: 'mkdir', path: dirname(petriPath) },
        { kind: 'write_file', path: petriPath, ifExists: 'overwrite' },
        { kind: 'write_file', path: sdcpnPath, ifExists: 'overwrite' },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(petriPath, 'utf8')).resolves.toContain('worktree_create');
    await expect(readFile(sdcpnPath, 'utf8')).resolves.toContain('Executor run run-1');
  });

  it('registers execute_promotion_prepare as injected run-local promotion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-promotion-prepare-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const petriPath = join(runDir, 'petrinaut', 'net.json');
    const worktreeDir = join(runDir, 'worktree');
    const promotionPath = join(runDir, 'promotion', 'promotion.json');
    await mkdir(dirname(petriPath), { recursive: true });
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(petriPath, JSON.stringify({ runId: 'run-1' }), 'utf8');
    await writeFile(
      reportPath,
      `${JSON.stringify({
        event: 'slice_test_result',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        status: 'passed',
        exitCode: 0,
      })}\n`,
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'petri_exported',
        reportsPath: reportPath,
        petriPath,
        worktreeDir,
        completedSliceIds: ['task-1'],
        runBaseSha: 'base123',
      }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 31, nodes: [], edges: [] },
      gitRunPromotion: createFakeGitRunPromotionPort({
        status: 'promoted',
        commitSha: 'def456',
        reviewBranch: 'brunch/review/run-1',
        sideEffects: [
          { kind: 'git_commit', path: worktreeDir, sha: 'def456' },
          {
            kind: 'git_ref_create',
            path: worktreeDir,
            ref: 'refs/heads/brunch/review/run-1',
            sha: 'def456',
          },
        ],
      }),
    });

    const promotion = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL);
    expect(promotion).toBeDefined();
    const result = await promotion!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_promotion_prepare: promotion_prepared');
    expect(result.details).toMatchObject({
      result: {
        status: 'promotion_prepared',
        runStatus: 'promotion_prepared',
        promotionPath,
        promotionBranch: 'brunch/review/run-1',
      },
      sideEffects: [
        { kind: 'git_commit', path: worktreeDir, sha: 'def456' },
        {
          kind: 'git_ref_create',
          path: worktreeDir,
          ref: 'refs/heads/brunch/review/run-1',
          sha: 'def456',
        },
        { kind: 'mkdir', path: dirname(promotionPath) },
        { kind: 'write_file', path: promotionPath, ifExists: 'overwrite' },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(promotionPath, 'utf8')).resolves.toContain('def456');
  });

  it('registers execute_land_preflight read-only with no agent-callable landing mutation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-land-preflight-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const worktreeDir = join(runDir, 'worktree');
    const promotionPath = join(runDir, 'promotion', 'promotion.json');
    await mkdir(dirname(promotionPath), { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'promotion_prepared',
        worktreeDir,
        runBaseSha: 'base123',
        promotionPath,
        promotionCommitSha: 'def456',
        promotionBranch: 'brunch/review/run-1',
      }),
      'utf8',
    );
    await writeFile(
      promotionPath,
      JSON.stringify({
        runId: 'run-1',
        promotion: {
          status: 'promoted',
          commitSha: 'def456',
          reviewBranch: 'brunch/review/run-1',
        },
      }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 32, nodes: [], edges: [] },
      gitHostLand: createFakeGitHostLandPort(),
    });

    const preflight = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL);
    expect(preflight).toBeDefined();
    const result = await preflight!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_land_preflight: preflight_ready');
    expect(result.content[0]?.text).toContain('/brunch:land');
    expect(result.details).toMatchObject({
      result: {
        status: 'preflight_ready',
        runStatus: 'promotion_prepared',
        promotionCommitSha: 'def456',
        substrate: 'git_worktree',
      },
      sideEffects: [],
    });
    // The landing mutation is command-only: no agent-callable apply exists.
    const names = registeredTools.map((tool) => tool.name);
    expect(names).not.toContain('execute_host_promotion_apply');
    expect(names).not.toContain('execute_host_promotion_preflight');
    expect(names.filter((name) => name.includes('land'))).toEqual([BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL]);
  });

  it('registers execute_plan_outline only with selected graph deps and returns a side-effect-free outline', async () => {
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 13,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 13,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const outline = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL);
    expect(outline).toBeDefined();
    const result = await outline!.execute('call-1', { mode: 'brownfield' });

    expect(result.content[0]?.text).toContain('execute_plan_outline: spec 42 (brownfield)');
    expect(result.details).toMatchObject({
      source: { graphLsn: 13, visibility: 'active' },
      sideEffects: [],
      outline: {
        schemaVersion: 2,
        specId: '42',
        mode: 'brownfield',
        frontiers: [],
        orphanTasks: [expect.objectContaining({ requirementId: 'REQ1' })],
        sideEffects: [],
      },
    });
  });

  it('registers execute_plan_outline_artifact only with selected graph deps and writes the review artifact', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-plan-outline-'));
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
        onUpdate?: unknown,
        ctx?: { cwd: string },
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 14,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 14,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const artifact = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL);
    expect(artifact).toBeDefined();
    const result = await artifact!.execute('call-1', { mode: 'brownfield' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_plan_outline_artifact:');
    expect(result.details.sideEffects).toEqual([
      {
        kind: 'write_file',
        path: join(cwd, '.brunch', 'execution-reports', '42', 'plan-outline.json'),
        ifExists: 'overwrite',
      },
    ]);
    await expect(
      readFile(join(cwd, '.brunch', 'execution-reports', '42', 'plan-outline.json'), 'utf8'),
    ).resolves.toContain('Run the cooked feature');
  });

  it('writes execute_plan_outline_artifact when non-requirement dependency edges are only graph context', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-plan-outline-context-deps-'));
    const artifactPath = join(cwd, '.brunch', 'execution-reports', '42', 'plan-outline.json');
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
        onUpdate?: unknown,
        ctx?: { cwd: string },
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 15,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  body: 'Feature runs through the alpha executor.',
                  basis: 'explicit',
                  settlement: 'settled',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 2,
                  specId: 42,
                  plane: 'intent',
                  kind: 'criterion',
                  kindOrdinal: 1,
                  title: 'Feature is verified',
                  body: 'Feature has a passing verification signal.',
                  basis: 'explicit',
                  settlement: 'settled',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 3,
                  specId: 42,
                  plane: 'intent',
                  kind: 'constraint',
                  kindOrdinal: 1,
                  title: 'Respect deployment boundary',
                  body: 'Execution must not cross the deployment boundary.',
                  basis: 'explicit',
                  settlement: 'settled',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [
                {
                  id: 1,
                  specId: 42,
                  category: 'witness',
                  sourceId: 2,
                  targetId: 1,
                  stance: 'for',
                  basis: 'explicit',
                  settlement: 'settled',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 2,
                  specId: 42,
                  category: 'dependency',
                  sourceId: 3,
                  targetId: 1,
                  basis: 'explicit',
                  settlement: 'settled',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 15,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const artifact = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL);
    const result = await artifact!.execute('call-1', {}, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_plan_outline_artifact:');
    await expect(access(artifactPath)).resolves.toBeUndefined();
  });

  it('registers execute_snapshot only with selected graph deps and returns a side-effect-free projection', async () => {
    const registeredTools: Array<{
      name: string;
      description: string;
      execute: (
        toolCallId: string,
        params: unknown,
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 11,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 2,
                  specId: 42,
                  plane: 'intent',
                  kind: 'criterion',
                  kindOrdinal: 1,
                  title: 'Feature answers the probe',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [
                {
                  id: 1,
                  specId: 42,
                  category: 'witness',
                  sourceId: 2,
                  targetId: 1,
                  stance: 'for',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 11,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const snapshot = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SNAPSHOT_TOOL);
    expect(snapshot).toBeDefined();
    expect(snapshot?.description).toContain('ExecutionSpecSnapshot v2');
    expect(snapshot?.description).not.toContain('ExecutionSpecSnapshot v1');
    const result = await snapshot!.execute('call-1', { mode: 'brownfield' });

    expect(result.content[0]?.text).toContain('execute_snapshot: spec 42 (brownfield)');
    expect(result.details).toMatchObject({
      source: { graphLsn: 11, visibility: 'active' },
      sideEffects: [],
      snapshot: {
        schemaVersion: 2,
        specId: '42',
        mode: 'brownfield',
        requirements: [expect.objectContaining({ itemId: 'REQ1' })],
        criteria: [
          expect.objectContaining({
            itemId: 'AC1',
            verifiesRequirements: ['REQ1'],
            verifiesFrontiers: [],
          }),
        ],
        frontiers: [],
      },
    });
  });

  it('keeps execute_status side-effect free after run-local promotion is ported', async () => {
    const registeredTools = await collectProductTools();

    const status = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_STATUS_TOOL);
    expect(status).toBeDefined();
    const result = await status!.execute('call-1', { discipline: 'interpretive' });

    expect(result.content[0]?.text).toContain('execute_status: interpretive');
    expect(result.content[0]?.text).toContain('ported tools: execute_status, execute_orchestrate');
    expect(result.content[0]?.text).toContain('pending tools: none');
    expect(result.content[0]?.text).toContain(
      'executor promotion: run-local git promotion ported; host preflight/apply ported with explicit acceptance',
    );
    expect(result.details).toMatchObject({
      discipline: 'interpretive',
      availableDisciplines: ['strict', 'interpretive'],
      portedTools: [
        'execute_status',
        'execute_orchestrate',
        'execute_snapshot',
        'execute_plan_check',
        'execute_plan_outline',
        'execute_plan_draft',
        'execute_plan_preview',
        'execute_plan_file',
        'execute_launch',
        'execute_run_create',
        'execute_replan_recommendation',
        'execute_replan_start_new_run',
        'execute_replan_retry_current_step',
        'execute_replan_regenerate_plan',
        'execute_replan_abandon_run',
        'execute_worktree_create',
        'execute_populate',
        'execute_source_policy',
        'execute_source_copy',
        'execute_report_init',
        'execute_slice_start',
        'execute_slice_execute',
        'execute_agent_result',
        'execute_test_result',
        'execute_slice_complete',
        'execute_run_complete',
        'execute_petri_export',
        'execute_promotion_prepare',
        'execute_land_preflight',
      ],
      pendingTools: [],
      sideEffects: [],
    });
  });

  it('covers the exact 31-tool executor family, including both artifact tools', async () => {
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 1, nodes: [], edges: [] },
    });
    const executorTools = registeredTools
      .filter((tool) => tool.name.startsWith('execute_'))
      .sort((left, right) => left.name.localeCompare(right.name));
    const expectedNames = [
      ...EXECUTOR_ALLOWED_TOOL_NAMES.filter((name) => name.startsWith('execute_')),
      BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
      BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
    ].sort((left, right) => left.localeCompare(right));

    expect(executorTools.map((tool) => tool.name)).toEqual(expectedNames);
    expect(executorTools).toHaveLength(31);
    for (const tool of executorTools) {
      expect(hasToolParametersProvenance(tool.parameters), `${tool.name} adapter provenance`).toBe(true);
      assertProviderLegalToolSchema(tool.parameters);
    }
  });

  it('classifies every registered production execute tool for run mutation authority', async () => {
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 1, nodes: [], edges: [] },
    });
    const registeredExecuteNames = registeredTools
      .map((tool) => tool.name)
      .filter((name) => name.startsWith('execute_'))
      .sort((left, right) => left.localeCompare(right));

    expect(PRODUCTION_EXECUTE_TOOL_MUTATIONS).toEqual({
      execute_agent_result: 'agent_result',
      execute_land_preflight: null,
      execute_launch: null,
      execute_orchestrate: 'drive',
      execute_petri_export: 'petri_export',
      execute_plan_check: null,
      execute_plan_draft: null,
      execute_plan_draft_artifact: null,
      execute_plan_file: null,
      execute_plan_outline: null,
      execute_plan_outline_artifact: null,
      execute_plan_preview: null,
      execute_populate: 'populate',
      execute_promotion_prepare: 'promotion',
      execute_replan_abandon_run: 'run_abandon',
      execute_replan_recommendation: null,
      execute_replan_regenerate_plan: 'replan_regenerate_plan_tool',
      execute_replan_retry_current_step: 'replan_retry_current_step',
      execute_replan_start_new_run: 'run_supersede',
      execute_report_init: 'report_init',
      execute_run_complete: 'run_complete',
      execute_run_create: 'run_create',
      execute_slice_complete: 'slice_complete',
      execute_slice_execute: 'slice_execute',
      execute_slice_start: 'slice_start',
      execute_snapshot: null,
      execute_source_copy: 'source_copy',
      execute_source_policy: 'source_policy',
      execute_status: null,
      execute_test_result: 'test_result',
      execute_worktree_create: 'worktree_create',
    });
    expect(Object.keys(PRODUCTION_EXECUTE_TOOL_MUTATIONS).sort()).toEqual(registeredExecuteNames);
  });

  it('keeps present_alternatives on the shared default renderer without changing its message renderer', async () => {
    const alternativesTool = (await collectProductTools()).find(
      (tool) => tool.name === 'present_alternatives',
    );

    expect(alternativesTool?.renderShell).toBe('self');
    expect(alternativesTool?.renderCall).toEqual(expect.any(Function));
    expect(alternativesTool?.renderResult).toEqual(expect.any(Function));

    const recording = createRecordingExtensionApi();
    alternatives(recording.api, (schema) => schema);
    expect(recording.messageRenderers).toEqual(['alternatives-card-set']);
  });

  it('keeps the exact 49-tool provider-facing Brunch inventory legal and adapter-derived', async () => {
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 1, nodes: [], edges: [] },
      subagents: workerSubagents(
        async () => ({ agent: 'worker', status: 'ok', text: 'ok' }) satisfies SubagentResult,
      ),
    });
    const piOwnedBuiltins = new Set(['read', 'grep', 'find', 'ls']);
    const registeredProductTools = registeredTools.filter((tool) => !piOwnedBuiltins.has(tool.name));
    const registeredProductNames = registeredProductTools.map((tool) => tool.name);
    const duplicateProductNames = registeredProductNames.filter(
      (name, index) => registeredProductNames.indexOf(name) !== index,
    );
    const registeredProductNameSet = new Set(registeredProductNames);
    const childOnlyTools = [...createSubagentToolCatalog('/tmp').values()].filter(
      (tool) => !piOwnedBuiltins.has(tool.name) && !registeredProductNameSet.has(tool.name),
    );
    const actualTools = [...registeredProductTools, ...childOnlyTools];
    const intentionalCustomCallRendererNames = [
      'ask',
      'present_candidates',
      'present_digest',
      'present_review_set',
      'subagent',
      'web_fetch',
      'web_search',
    ];
    const intentionalCustomRendererNames = [
      ...intentionalCustomCallRendererNames,
      'execute_orchestrate',
      'execute_plan_check',
      'execute_snapshot',
      'execute_status',
    ].sort((left, right) => left.localeCompare(right));
    const expectedNames = [
      'ask',
      'present_alternatives',
      'present_candidates',
      'present_digest',
      'present_review_set',
      'mutate_graph',
      'read_graph',
      'read_workspace_context',
      'read_specification_context',
      'read_session_context',
      'read_elicitation_scratchpad',
      'update_elicitation_scratchpad',
      'read_reconciliation_needs',
      'update_reconciliation_needs',
      'execute_agent_result',
      'execute_land_preflight',
      'execute_launch',
      'execute_orchestrate',
      'execute_petri_export',
      'execute_plan_check',
      'execute_plan_draft',
      'execute_plan_draft_artifact',
      'execute_plan_file',
      'execute_plan_outline',
      'execute_plan_outline_artifact',
      'execute_plan_preview',
      'execute_populate',
      'execute_promotion_prepare',
      'execute_replan_abandon_run',
      'execute_replan_recommendation',
      'execute_replan_regenerate_plan',
      'execute_replan_retry_current_step',
      'execute_replan_start_new_run',
      'execute_report_init',
      'execute_run_complete',
      'execute_run_create',
      'execute_slice_complete',
      'execute_slice_execute',
      'execute_slice_start',
      'execute_snapshot',
      'execute_source_copy',
      'execute_source_policy',
      'execute_status',
      'execute_test_result',
      'execute_worktree_create',
      'web_fetch',
      'web_search',
      'subagent',
      'write_worktree_file',
    ].sort((left, right) => left.localeCompare(right));

    expect(duplicateProductNames).toEqual([]);
    expect(childOnlyTools.map((tool) => tool.name)).toEqual(['write_worktree_file']);
    expect(actualTools.map((tool) => tool.name).sort((left, right) => left.localeCompare(right))).toEqual(
      expectedNames,
    );
    expect(actualTools).toHaveLength(49);
    for (const tool of actualTools) {
      expect(tool, 'every inventory member must resolve from a production registrar/catalog').toBeDefined();
      expect(hasToolParametersProvenance(tool!.parameters), `${tool!.name} adapter provenance`).toBe(true);
      assertProviderLegalToolSchema(tool!.parameters);
    }

    const defaultRenderedNames = actualTools
      .filter(hasBrunchDefaultRenderer)
      .map((tool) => tool.name)
      .sort((left, right) => left.localeCompare(right));
    expect(defaultRenderedNames).toEqual(
      expectedNames.filter((name) => !intentionalCustomRendererNames.includes(name)),
    );
    expect(Object.keys(BRUNCH_TOOL_ACTIVITY_LABELS).sort((left, right) => left.localeCompare(right))).toEqual(
      defaultRenderedNames,
    );
    expect(Object.values(BRUNCH_TOOL_ACTIVITY_LABELS)).not.toContainEqual(expect.stringMatching(/_/));

    const customRenderedTools = actualTools.filter((tool) =>
      intentionalCustomRendererNames.includes(tool.name),
    );
    expect(customRenderedTools.map((tool) => tool.name).sort()).toEqual(intentionalCustomRendererNames);
    for (const tool of customRenderedTools) {
      expect(hasBrunchDefaultRenderer(tool), `${tool.name} must keep its custom renderer`).toBe(false);
      if (intentionalCustomCallRendererNames.includes(tool.name)) {
        expect(tool.renderCall, `${tool.name} call renderer`).toEqual(expect.any(Function));
      }
      expect(tool.renderResult, `${tool.name} result renderer`).toEqual(expect.any(Function));
    }

    const piOwnedTools = registeredTools.filter((tool) => piOwnedBuiltins.has(tool.name));
    expect(piOwnedTools.map((tool) => tool.name)).toEqual(['read', 'grep', 'find', 'ls']);
    for (const tool of piOwnedTools) {
      expect(hasBrunchDefaultRenderer(tool), `${tool.name} remains Pi-owned`).toBe(false);
    }
  });

  it('registers both graph-register and reconciliation-register tools when graph deps are provided', async () => {
    const recording = createRecordingExtensionApi();

    await createBrunchPiExtensions(brunchChromeFixture, recording.onSessionBoundary, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () => ({ lsn: 1, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 1,
        },
      },
    })(recording.api);

    expect(recording.toolNames).toEqual(
      expect.arrayContaining([
        'mutate_graph',
        'read_graph',
        BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL,
        BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
        BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
        BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
        BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
        BRUNCH_EXECUTE_SNAPSHOT_TOOL,
        'read_elicitation_scratchpad',
        'update_elicitation_scratchpad',
        'read_reconciliation_needs',
        'update_reconciliation_needs',
      ]),
    );
    // the reconciliation register is a dedicated tool, not a read_graph mode
    expect(recording.toolNames.filter((name) => name === 'read_reconciliation_needs')).toHaveLength(1);
  });

  it('wires prepareNextTurn from the active branch despite an abandoned world watermark', async () => {
    let graphLsn = 3;
    const appended: Array<Record<string, unknown>> = [];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => [
        ...appended,
        { type: 'custom_message', customType: 'worldUpdate', details: { specId: 1, currentLsn: 99 } },
      ],
      getBranch: () => appended.slice(),
      appendCustomEntry(customType: string, data: unknown) {
        appended.push({ type: 'custom', customType, data });
      },
      appendCustomMessageEntry(customType: string, content: string, _display: boolean, details?: unknown) {
        appended.push({ type: 'custom_message', customType, content, details });
      },
    };

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: graphLsn,
              nodes: [{ id: 10, kind: 'goal', title: 'Live goal', updatedAtLsn: graphLsn }],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => graphLsn,
        },
      },
    })(recordingApiWithEvents(events));

    await events.get('before_agent_start')?.[0]?.({}, { sessionManager });

    expect(appended).toEqual([
      {
        type: 'custom_message',
        customType: 'worldUpdate',
        content: expect.any(String),
        details: expect.objectContaining({ specId: 1, currentLsn: 3, changedSinceLsn: 0 }),
      },
    ]);

    await expect(
      events.get('before_provider_request')?.[0]?.({}, { sessionManager }),
    ).resolves.toBeUndefined();
    expect(appended).toHaveLength(1);

    graphLsn = 4;
    await expect(
      events.get('before_provider_request')?.[0]?.({}, { sessionManager }),
    ).resolves.toBeUndefined();
    expect(appended).toEqual([
      {
        type: 'custom_message',
        customType: 'worldUpdate',
        content: expect.any(String),
        details: expect.objectContaining({ specId: 1, currentLsn: 3, changedSinceLsn: 0 }),
      },
      {
        type: 'custom_message',
        customType: 'worldUpdate',
        content: expect.any(String),
        details: expect.objectContaining({ specId: 1, currentLsn: 4, changedSinceLsn: 3 }),
      },
    ]);
  });

  it('advances capture from the active branch despite an abandoned later sweep watermark', async () => {
    const appended: Array<Record<string, unknown>> = [
      { type: 'message', message: { role: 'user', content: 'The web observer must be read-only.' } },
      { type: 'message', message: { role: 'toolResult', toolName: 'bash', details: { ok: true } } },
    ];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => [
        ...appended,
        {
          type: 'custom',
          customType: 'brunch.capture_sweep_watermark',
          data: { customType: 'brunch.capture_sweep_watermark', sweptAt: 999 },
        },
      ],
      getBranch: () => appended.slice(),
      appendCustomEntry(customType: string, data: unknown) {
        appended.push({ type: 'custom', customType, data });
      },
      appendCustomMessageEntry(customType: string, content: string, _display: boolean, details?: unknown) {
        appended.push({ type: 'custom_message', customType, content, details });
      },
    };

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () => ({ lsn: 0, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 0,
        },
      },
    })(recordingApiWithEvents(events));

    await events.get('before_agent_start')?.[0]?.({}, { sessionManager });

    expect(appended).toEqual([
      { type: 'message', message: { role: 'user', content: 'The web observer must be read-only.' } },
      { type: 'message', message: { role: 'toolResult', toolName: 'bash', details: { ok: true } } },
      {
        type: 'custom',
        customType: 'brunch.capture_sweep_watermark',
        data: expect.objectContaining({ customType: 'brunch.capture_sweep_watermark' }),
      },
    ]);

    await expect(
      events.get('before_provider_request')?.[0]?.({}, { sessionManager }),
    ).resolves.toBeUndefined();
    expect(appended).toHaveLength(3);
  });

  it('threads active mentions and seed state despite abandoned append-order rivals', async () => {
    const appended: Array<Record<string, unknown>> = [
      { type: 'custom', customType: 'brunch.context_seed', data: { specId: 1, snapshotLsn: 1 } },
      { type: 'custom', customType: 'brunch.mention', data: { entityId: '10', handle: 'G1', seenLsn: 1 } },
    ];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => [
        ...appended,
        { type: 'custom', customType: 'brunch.mention', data: { entityId: '10', handle: 'G1', seenLsn: 2 } },
        { type: 'custom', customType: 'brunch.context_seed', data: { specId: 1, snapshotLsn: 2 } },
      ],
      getBranch: () => appended.slice(),
      appendCustomEntry(customType: string, data: unknown) {
        appended.push({ type: 'custom', customType, data });
      },
      appendCustomMessageEntry(customType: string, content: string, _display: boolean, details?: unknown) {
        appended.push({ type: 'custom_message', customType, content, details });
      },
    };

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      continuityDrains: () => [{ kind: 'side_task', id: 'side-1', summary: 'Side task done' }],
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 2,
              nodes: [{ id: 10, kind: 'goal', title: 'Live goal', updatedAtLsn: 2 }],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 2,
        },
      },
    })(recordingApiWithEvents(events));

    await events.get('before_agent_start')?.[0]?.({}, { sessionManager });

    expect(appended).toEqual(
      expect.arrayContaining([
        {
          type: 'custom_message',
          customType: 'brunch.mention_staleness_hint',
          content: expect.stringContaining('G1'),
          details: { entityId: '10', handle: 'G1', seenLsn: 1, currentLsn: 2 },
        },
        {
          type: 'custom_message',
          customType: 'brunch.side_task_result',
          content: expect.stringContaining('Side task done'),
          details: { id: 'side-1', summary: 'Side task done' },
        },
      ]),
    );
  });
});

const brunchChromeFixture = {
  cwd: '/tmp/brunch',
  chatMode: 'responding-to-elicitation' as const,
  phase: 'elicitation' as const,
  spec: {
    id: 1,
    title: 'Fixture spec',
  },
  session: {
    id: 'session-1',
    label: 'Fixture session',
  },
};

type RegisteredTestTool = Pick<
  ToolDefinition,
  'name' | 'parameters' | 'renderShell' | 'renderCall' | 'renderResult'
> & {
  execute: (
    toolCallId: string,
    params: unknown,
    signal?: AbortSignal,
    onUpdate?: unknown,
    ctx?: { cwd: string; modelRegistry?: unknown; model?: unknown },
  ) => Promise<{
    content: readonly { text: string }[];
    details: Record<string, unknown>;
  }>;
};

interface TestGraphSlice {
  readonly specId?: number;
  readonly lsn: number;
  readonly nodes: readonly unknown[];
  readonly edges: readonly unknown[];
}

async function collectProductTools(
  options: {
    graph?: TestGraphSlice;
    graphsBySpec?: Readonly<Record<number, TestGraphSlice>>;
    gitWorktree?: GitWorktreePort;
    gitSliceIntegration?: GitSliceIntegrationPort;
    testRunner?: TestRunnerPort;
    agentRunner?: AgentRunnerPort;
    gitRunPromotion?: GitRunPromotionPort;
    gitHostLand?: GitHostLandPort;
    subagents?: BrunchSubagentsDeps;
  } = {},
): Promise<RegisteredTestTool[]> {
  const registeredTools: RegisteredTestTool[] = [];
  await createBrunchPiExtensions(brunchChromeFixture, undefined, {
    coordinator: {} as never,
    graphMentionSource: { listMentionCandidates: () => [] },
    ...(options.subagents ? { subagents: options.subagents } : {}),
    ...(options.gitWorktree ||
    options.gitSliceIntegration ||
    options.testRunner ||
    options.agentRunner ||
    options.gitRunPromotion ||
    options.gitHostLand
      ? {
          executionPorts: {
            ...(options.gitWorktree ? { gitWorktree: options.gitWorktree } : {}),
            ...(options.gitSliceIntegration ? { gitSliceIntegration: options.gitSliceIntegration } : {}),
            ...(options.testRunner ? { testRunner: options.testRunner } : {}),
            ...(options.agentRunner ? { agentRunner: options.agentRunner } : {}),
            ...(options.gitRunPromotion ? { gitRunPromotion: options.gitRunPromotion } : {}),
            ...(options.gitHostLand ? { gitHostLand: options.gitHostLand } : {}),
          },
        }
      : {}),
    ...(options.graph || options.graphsBySpec
      ? {
          graph: {
            specId: options.graph?.specId ?? 42,
            commandExecutor: {} as never,
            reads: {
              queryGraph: () =>
                graphSlice(options.graphsBySpec?.[options.graph?.specId ?? 42] ?? options.graph!),
              forSpec: (specId: number) => ({
                queryGraph: () => graphSlice(options.graphsBySpec?.[specId] ?? options.graph!),
                latestLsn: () => (options.graphsBySpec?.[specId] ?? options.graph!).lsn,
              }),
              getNodes: () => [],
              resolveNodeCode: () => undefined,
              getOpenReconciliationNeeds: () => [],
              latestLsn: () => (options.graphsBySpec?.[options.graph?.specId ?? 42] ?? options.graph!).lsn,
            },
          },
        }
      : {}),
  })({
    on() {},
    registerTool(tool: RegisteredTestTool) {
      registeredTools.push(tool);
    },
    registerCommand() {},
    registerShortcut() {},
    registerMessageRenderer() {},
    sendMessage() {},
    getAllTools: () => [],
    setActiveTools() {},
  } as never);
  return registeredTools;
}

function graphSlice(graph: TestGraphSlice) {
  return {
    lsn: graph.lsn,
    nodes: graph.nodes.map((node) => {
      const value = node as Record<string, unknown>;
      return { ...value, settlement: value.settlement ?? 'settled' };
    }),
    edges: graph.edges.map((edge) => {
      const value = edge as Record<string, unknown>;
      return { ...value, settlement: value.settlement ?? 'settled' };
    }),
  } as never;
}

function workerSubagents(runSubagent: NonNullable<BrunchSubagentsDeps['runSubagent']>): BrunchSubagentsDeps {
  return {
    definitions: new Map([
      [
        'worker',
        parseSubagentMarkdown(`---
name: worker
description: Execute one bounded code change in a sandbox worktree
tools: read, write_worktree_file
model: default
thinking: medium
---

Worker body.
`),
      ],
    ]),
    delegatableAgents: ['worker'],
    maxConcurrency: 1,
    agentDir: '/agent',
    modelRuntime: {} as never,
    createSettingsManager: () => ({}) as never,
    resourceLoaderOptions: { noContextFiles: true } as never,
    runSubagent,
  };
}

function recordingApiWithEvents(events: Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>) {
  return {
    on(eventName: string, handler: (event: any, ctx: any) => Promise<void> | void) {
      events.set(eventName, [...(events.get(eventName) ?? []), handler]);
    },
    registerTool() {},
    registerCommand() {},
    registerShortcut() {},
    registerMessageRenderer() {},
    sendMessage() {},
    getAllTools: () =>
      [
        'read',
        'grep',
        'find',
        'ls',
        'present_alternatives',
        ASK_TOOL,
        PRESENT_CANDIDATES_TOOL,
        PRESENT_REVIEW_SET_TOOL,
        'bash',
        'edit',
        'write',
      ].map((name) => ({ name })),
    setActiveTools() {},
  } as never;
}

function createRecordingExtensionApi() {
  const eventNames: string[] = [];
  const toolNames: string[] = [];
  const commandNames: string[] = [];
  const shortcuts: string[] = [];
  const messageRenderers: string[] = [];
  const onSessionBoundary = async () => {};
  const api = {
    on(eventName: string) {
      eventNames.push(eventName);
    },
    registerTool(tool: { name: string }) {
      toolNames.push(tool.name);
    },
    registerCommand(name: string) {
      commandNames.push(name);
    },
    registerShortcut(name: string) {
      shortcuts.push(name);
    },
    registerMessageRenderer(type: string) {
      messageRenderers.push(type);
    },
    sendMessage() {},
    getAllTools: () =>
      [
        'read',
        'grep',
        'find',
        'ls',
        'present_alternatives',
        ASK_TOOL,
        PRESENT_CANDIDATES_TOOL,
        PRESENT_REVIEW_SET_TOOL,
        'bash',
        'edit',
        'write',
      ].map((name) => ({ name })),
    setActiveTools() {},
  };
  return {
    api: api as never,
    eventNames,
    toolNames,
    commandNames,
    shortcuts,
    messageRenderers,
    onSessionBoundary,
  };
}

async function listExtensionEntrypoints(): Promise<string[]> {
  const extensionsDir = join(projectRoot(), 'src/.pi/extensions');
  const entries = await readdir(extensionsDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(extensionsDir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
    if (entry.isDirectory()) {
      const indexFile = join(path, 'index.ts');
      if (await fileExists(indexFile)) files.push(indexFile);
    }
  }
  return files;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function projectRoot(): string {
  return dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
}
