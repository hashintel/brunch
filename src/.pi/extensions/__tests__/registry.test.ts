import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../../../app/pi-extensions.js';
import { registerBrunchAlternatives as alternatives } from '../../components/alternatives.js';
import { BRUNCH_EXECUTE_AGENT_RESULT_TOOL } from '../agent-runtime/execute-agent-result/index.js';
import { BRUNCH_EXECUTE_LAUNCH_TOOL } from '../agent-runtime/execute-launch/index.js';
import { BRUNCH_EXECUTE_PETRI_EXPORT_TOOL } from '../agent-runtime/execute-petri-export/index.js';
import { BRUNCH_EXECUTE_PLAN_CHECK_TOOL } from '../agent-runtime/execute-plan-check/index.js';
import { BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL } from '../agent-runtime/execute-plan-draft-artifact/index.js';
import { BRUNCH_EXECUTE_PLAN_DRAFT_TOOL } from '../agent-runtime/execute-plan-draft/index.js';
import { BRUNCH_EXECUTE_PLAN_FILE_TOOL } from '../agent-runtime/execute-plan-file/index.js';
import { BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL } from '../agent-runtime/execute-plan-outline-artifact/index.js';
import { BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL } from '../agent-runtime/execute-plan-outline/index.js';
import { BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL } from '../agent-runtime/execute-plan-preview/index.js';
import { BRUNCH_EXECUTE_POPULATE_TOOL } from '../agent-runtime/execute-populate/index.js';
import { BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL } from '../agent-runtime/execute-promotion-prepare/index.js';
import { BRUNCH_EXECUTE_REPORT_INIT_TOOL } from '../agent-runtime/execute-report-init/index.js';
import { BRUNCH_EXECUTE_RUN_COMPLETE_TOOL } from '../agent-runtime/execute-run-complete/index.js';
import { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../agent-runtime/execute-run-create/index.js';
import { BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL } from '../agent-runtime/execute-slice-complete/index.js';
import { BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL } from '../agent-runtime/execute-slice-execute/index.js';
import { BRUNCH_EXECUTE_SLICE_START_TOOL } from '../agent-runtime/execute-slice-start/index.js';
import { BRUNCH_EXECUTE_SNAPSHOT_TOOL } from '../agent-runtime/execute-snapshot/index.js';
import { BRUNCH_EXECUTE_SOURCE_COPY_TOOL } from '../agent-runtime/execute-source-copy/index.js';
import { BRUNCH_EXECUTE_SOURCE_POLICY_TOOL } from '../agent-runtime/execute-source-policy/index.js';
import { BRUNCH_EXECUTE_STATUS_TOOL } from '../agent-runtime/execute-status/index.js';
import { BRUNCH_EXECUTE_TEST_RESULT_TOOL } from '../agent-runtime/execute-test-result/index.js';
import { BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL } from '../agent-runtime/execute-worktree-create/index.js';
import { BRUNCH_ORCHESTRATOR_STUB_TOOL } from '../agent-runtime/orchestrator-stub/index.js';
import { registerBrunchOperationalModePolicy as operationalMode } from '../agent-runtime/runtime/index.js';
import { registerBrunchPrompting as prompting } from '../agent-runtime/system-prompts/index.js';
import { registerBrunchContext as context } from '../brunch-data/context/index.js';
import chrome from '../chrome/index.js';
import {
  BRUNCH_MODE_COMMAND,
  BRUNCH_SWITCH_COMMAND,
  registerBrunchCommands as commands,
} from '../commands/index.js';
import { registerBrunchBranchPolicyHandlers as commandPolicy } from '../commands/policy.js';
import {
  PRESENT_CANDIDATES_TOOL,
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_RESPONSE_TOOL,
  registerStructuredExchange as structuredExchange,
} from '../exchanges/index.js';
import { registerBrunchMentionAutocomplete as mentionAutocomplete } from '../mentions/index.js';
import { registerBrunchSessionBoundary as sessionLifecycle } from '../session-hooks/session/lifecycle.js';

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
        '-extensions/agent-runtime/execute-plan-preview/index.ts',
        '-extensions/agent-runtime/execute-plan-check/index.ts',
        '-extensions/agent-runtime/execute-plan-draft-artifact/index.ts',
        '-extensions/agent-runtime/execute-plan-draft/index.ts',
        '-extensions/agent-runtime/execute-plan-outline/index.ts',
        '-extensions/agent-runtime/execute-snapshot/index.ts',
        '-extensions/agent-runtime/execute-status/index.ts',
        '-extensions/agent-runtime/orchestrator-stub/index.ts',
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
        '-extensions/dev-mode/introspect-query/index.ts',
        '-extensions/dev-mode/introspection/index.ts',
        '-extensions/dev-mode/session-query/index.ts',
        '-extensions/session-hooks/index.ts',
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
      BRUNCH_EXECUTE_AGENT_RESULT_TOOL,
      BRUNCH_EXECUTE_PETRI_EXPORT_TOOL,
      BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL,
      BRUNCH_EXECUTE_POPULATE_TOOL,
      BRUNCH_EXECUTE_REPORT_INIT_TOOL,
      BRUNCH_EXECUTE_RUN_COMPLETE_TOOL,
      BRUNCH_EXECUTE_SOURCE_POLICY_TOOL,
      BRUNCH_EXECUTE_SOURCE_COPY_TOOL,
      BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL,
      BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL,
      BRUNCH_EXECUTE_SLICE_START_TOOL,
      BRUNCH_EXECUTE_TEST_RESULT_TOOL,
      BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL,
      BRUNCH_ORCHESTRATOR_STUB_TOOL,
      'present_alternatives',
      PRESENT_QUESTION_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      REQUEST_RESPONSE_TOOL,
      'read_elicitation_scratchpad',
      'update_elicitation_scratchpad',
    ]);
    expect(recording.commandNames).toEqual([BRUNCH_SWITCH_COMMAND, BRUNCH_MODE_COMMAND]);
    expect(recording.messageRenderers).toEqual(['alternatives-card-set']);
    expect(recording.shortcuts).toEqual(['alt+m', 'ctrl+shift+b']);
    expect(recording.eventNames).toEqual([
      'session_start',
      'before_agent_start',
      'message_start',
      'session_start',
      'model_select',
      'thinking_level_select',
      'message_start',
      'turn_end',
      'session_before_fork',
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
          getElicitationGaps: () => [],
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
          getElicitationGaps: () => [],
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
        schemaVersion: 1,
        mode: 'brownfield',
        spec: {
          spec_id: '42',
          requirements: [{ item_id: 'REQ1', content: 'Feature runs through the alpha executor.' }],
          criteria: [],
        },
        epics: [expect.objectContaining({ id: 'frontier-1', summary: 'Implement projected requirements' })],
        slices: [expect.objectContaining({ id: 'task-1', epic_id: 'frontier-1' })],
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
          getElicitationGaps: () => [],
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
        schemaVersion: 1,
        specId: '42',
        mode: 'brownfield',
        epics: [expect.objectContaining({ id: 'frontier-1', sliceIds: ['task-1'] })],
        slices: [expect.objectContaining({ id: 'task-1', requirementId: 'REQ1' })],
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
          getElicitationGaps: () => [],
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

  it('registers execute_plan_file only with selected graph deps and writes one bounded plan.yaml', async () => {
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
              ],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getElicitationGaps: () => [],
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

    const path = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.yaml');
    expect(result.content[0]?.text).toContain('execute_plan_file:');
    expect(result.details).toMatchObject({
      artifact: { path, writeMode: 'overwrite' },
      source: { graphLsn: 18, visibility: 'active' },
      sideEffects: [{ kind: 'write_file', path, ifExists: 'overwrite' }],
    });
    const payload = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    expect(payload).toMatchObject({ mode: 'brownfield', spec: { spec_id: '42' } });
    expect(payload).not.toHaveProperty('schemaVersion');
    expect(payload).not.toHaveProperty('sideEffects');
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
          queryGraph: () => ({ lsn: 19, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getElicitationGaps: () => [],
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

    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.yaml');
    expect(missing.content[0]?.text).toContain('execute_launch: missing_plan');
    expect(missing.details).toMatchObject({
      result: { status: 'missing_plan', runStatus: 'not_started', planPath, sideEffects: [] },
      sideEffects: [],
    });

    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    const ready = await launch!.execute('call-2', {}, undefined, undefined, { cwd });

    expect(ready.content[0]?.text).toContain('execute_launch: ready');
    expect(ready.details).toMatchObject({
      result: { status: 'ready', runStatus: 'not_started', planPath, sideEffects: [] },
      sideEffects: [],
    });
    await expect(access(join(cwd, '.brunch', 'cook', 'runs'))).rejects.toThrow();
  });

  it('registers execute_run_create as metadata-only run creation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-create-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.yaml');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
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
          queryGraph: () => ({ lsn: 20, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getElicitationGaps: () => [],
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
      ],
    });
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"status": "created"');
    await expect(access(join(runDir, 'worktree'))).rejects.toThrow();
    await expect(access(join(runDir, 'reports.jsonl'))).rejects.toThrow();
  });

  it('registers execute_worktree_create as empty worktree materialization only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-worktree-create-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'created' }),
      'utf8',
    );
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 21, nodes: [], edges: [] },
    });

    const createWorktree = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL);
    expect(createWorktree).toBeDefined();
    const result = await createWorktree!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    const worktreeDir = join(runDir, 'worktree');
    expect(result.content[0]?.text).toContain('execute_worktree_create: worktree_created');
    expect(result.details).toMatchObject({
      result: { status: 'worktree_created', runStatus: 'worktree_created', runId: 'run-1', worktreeDir },
      sideEffects: [
        { kind: 'mkdir', path: worktreeDir },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(access(worktreeDir)).resolves.toBeUndefined();
    await expect(access(join(runDir, 'reports.jsonl'))).rejects.toThrow();
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
  });

  it('registers execute_populate as plan-only worktree population', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-populate-'));
    const planPath = join(cwd, '.brunch', 'cook', 'specs', '42', 'plan.yaml');
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

    const populatedPlan = join(worktreeDir, '.brunch', 'cook', 'plan.yaml');
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
    const populatedPlan = join(worktreeDir, '.brunch', 'cook', 'plan.yaml');
    const policyPath = join(runDir, 'source-policy.json');
    await mkdir(dirname(populatedPlan), { recursive: true });
    await writeFile(populatedPlan, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
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
        planPath: '/tmp/plan.yaml',
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
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'source_copied' }),
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
    const worktreePlan = join(runDir, 'worktree', '.brunch', 'cook', 'plan.yaml');
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
        planPath: '/tmp/plan.yaml',
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
    await mkdir(runDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'slice_started',
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 27, nodes: [], edges: [] },
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
        { kind: 'mkdir', path: dirname(requestPath) },
        { kind: 'write_file', path: requestPath, ifExists: 'overwrite' },
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(requestPath, 'utf8')).resolves.toContain('execute_slice');
    await expect(access(join(runDir, 'agent-output', 'task-1', 'result.json'))).rejects.toThrow();
  });

  it('registers execute_agent_result as prewritten result ingestion only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-agent-result-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const resultPath = join(runDir, 'agent-output', 'task-1', 'result.json');
    await mkdir(dirname(resultPath), { recursive: true });
    await writeFile(
      resultPath,
      JSON.stringify({ status: 'completed', summary: 'Implemented task.' }),
      'utf8',
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'slice_execution_requested',
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 28, nodes: [], edges: [] },
    });

    const agentResult = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_AGENT_RESULT_TOOL);
    expect(agentResult).toBeDefined();
    const result = await agentResult!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_agent_result: agent_result_ingested');
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

  it('registers execute_test_result as prewritten test result ingestion only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-test-result-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    const resultPath = join(runDir, 'agent-output', 'task-1', 'test-result.json');
    await mkdir(dirname(resultPath), { recursive: true });
    await writeFile(resultPath, JSON.stringify({ status: 'passed', target: 'tests/task-1.test.ts' }), 'utf8');
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'agent_result_ingested',
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 29, nodes: [], edges: [] },
    });

    const testResult = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_TEST_RESULT_TOOL);
    expect(testResult).toBeDefined();
    const result = await testResult!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_test_result: test_result_ingested');
    expect(result.details).toMatchObject({
      result: { status: 'test_result_ingested', runStatus: 'test_result_ingested', resultPath },
      sideEffects: [
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(reportPath, 'utf8')).resolves.toContain('slice_test_result');
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
  });

  it('registers execute_slice_complete as completion marker only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-slice-complete-'));
    const runDir = join(cwd, '.brunch', 'cook', 'runs', 'run-1');
    const metadataPath = join(runDir, 'run.json');
    const reportPath = join(runDir, 'reports.jsonl');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'test_result_ingested',
        reportsPath: reportPath,
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    const registeredTools = await collectProductTools({
      graph: { specId: 42, lsn: 30, nodes: [], edges: [] },
    });

    const complete = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL);
    expect(complete).toBeDefined();
    const result = await complete!.execute('call-1', { runId: 'run-1' }, undefined, undefined, { cwd });

    expect(result.content[0]?.text).toContain('execute_slice_complete: slice_completed');
    expect(result.details).toMatchObject({
      result: { status: 'slice_completed', runStatus: 'slice_completed', sliceId: 'task-1' },
      sideEffects: [
        { kind: 'append_file', path: reportPath },
        { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
      ],
    });
    await expect(readFile(reportPath, 'utf8')).resolves.toContain('slice_completed');
    await expect(access(join(runDir, 'petrinaut'))).rejects.toThrow();
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
          getElicitationGaps: () => [],
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
        schemaVersion: 1,
        specId: '42',
        mode: 'brownfield',
        frontiers: [
          expect.objectContaining({
            id: 'frontier-1',
            tasks: [expect.objectContaining({ requirementId: 'REQ1' })],
          }),
        ],
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
          getElicitationGaps: () => [],
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

  it('registers execute_snapshot only with selected graph deps and returns a side-effect-free projection', async () => {
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
          getElicitationGaps: () => [],
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
    const result = await snapshot!.execute('call-1', { mode: 'brownfield' });

    expect(result.content[0]?.text).toContain('execute_snapshot: spec 42 (brownfield)');
    expect(result.details).toMatchObject({
      source: { graphLsn: 11, visibility: 'active' },
      sideEffects: [],
      snapshot: {
        schemaVersion: 1,
        specId: '42',
        mode: 'brownfield',
        requirements: [expect.objectContaining({ itemId: 'REQ1' })],
        criteria: [expect.objectContaining({ itemId: 'AC1', verifies: ['REQ1'] })],
      },
    });
  });

  it('keeps execute_status side-effect free while execution and land are pending', async () => {
    const registeredTools = await collectProductTools();

    const status = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_STATUS_TOOL);
    expect(status).toBeDefined();
    const result = await status!.execute('call-1', { discipline: 'interpretive' });

    expect(result.content[0]?.text).toContain('execute_status: interpretive');
    expect(result.content[0]?.text).toContain(
      'ported tools: execute_status, execute_snapshot, execute_agent_result, execute_test_result, execute_launch, execute_plan_file, execute_plan_preview, execute_petri_export, execute_promotion_prepare, execute_populate, execute_report_init, execute_run_complete, execute_run_create, execute_source_policy, execute_source_copy, execute_slice_complete, execute_slice_start, execute_slice_execute, execute_worktree_create, execute_plan_check, execute_plan_draft, execute_plan_draft_artifact, execute_plan_outline, execute_plan_outline_artifact',
    );
    expect(result.content[0]?.text).toContain('pending tools: land');
    expect(result.content[0]?.text).toContain(
      'cook execution: Petri artifact export and promotion-prepare report only; land not ported',
    );
    expect(result.details).toMatchObject({
      discipline: 'interpretive',
      availableDisciplines: ['strict', 'interpretive'],
      portedTools: [
        'execute_status',
        'execute_snapshot',
        'execute_agent_result',
        'execute_test_result',
        'execute_launch',
        'execute_plan_file',
        'execute_plan_preview',
        'execute_petri_export',
        'execute_promotion_prepare',
        'execute_populate',
        'execute_report_init',
        'execute_run_complete',
        'execute_run_create',
        'execute_source_policy',
        'execute_source_copy',
        'execute_slice_complete',
        'execute_slice_start',
        'execute_slice_execute',
        'execute_worktree_create',
        'execute_plan_check',
        'execute_plan_draft',
        'execute_plan_draft_artifact',
        'execute_plan_outline',
        'execute_plan_outline_artifact',
      ],
      pendingTools: ['land'],
      sideEffects: [],
    });
  });

  it('keeps the default stub tool output aligned with its registered identity', async () => {
    const registeredTools = await collectProductTools();

    const stub = registeredTools.find((tool) => tool.name === BRUNCH_ORCHESTRATOR_STUB_TOOL);
    expect(stub).toBeDefined();
    const result = await stub!.execute('call-1', { message: 'standup' });
    const toolLabel = BRUNCH_ORCHESTRATOR_STUB_TOOL.replaceAll('_', ' ');
    expect(result.content[0]?.text).toBe(`${toolLabel} ran: standup`);
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
        'read_elicitation_gaps',
        'read_reconciliation_needs',
        'update_reconciliation_needs',
      ]),
    );
    // the reconciliation register is a dedicated tool, not a read_graph mode
    expect(recording.toolNames.filter((name) => name === 'read_reconciliation_needs')).toHaveLength(1);
  });

  it('wires prepareNextTurn into the live session boundary and leaves provider-request as guard-only', async () => {
    let graphLsn = 3;
    const appended: Array<Record<string, unknown>> = [];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => appended.slice(),
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

  it('advances the capture sweep watermark from the live before_agent_start boundary', async () => {
    const appended: Array<Record<string, unknown>> = [
      { type: 'message', message: { role: 'user', content: 'The web observer must be read-only.' } },
      { type: 'message', message: { role: 'toolResult', toolName: 'bash', details: { ok: true } } },
    ];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => appended.slice(),
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

  it('threads transcript mentions and continuity drains into the live prepareNextTurn adapter', async () => {
    const appended: Array<Record<string, unknown>> = [
      { type: 'custom', customType: 'brunch.context_seed', data: { specId: 1, snapshotLsn: 1 } },
      { type: 'custom', customType: 'brunch.mention', data: { entityId: '10', handle: 'G1', seenLsn: 1 } },
    ];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => appended.slice(),
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

type RegisteredTestTool = {
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
};

interface TestGraphSlice {
  readonly specId?: number;
  readonly lsn: number;
  readonly nodes: readonly unknown[];
  readonly edges: readonly unknown[];
}

async function collectProductTools(options: { graph?: TestGraphSlice } = {}): Promise<RegisteredTestTool[]> {
  const registeredTools: RegisteredTestTool[] = [];
  await createBrunchPiExtensions(brunchChromeFixture, undefined, {
    coordinator: {} as never,
    graphMentionSource: { listMentionCandidates: () => [] },
    ...(options.graph
      ? {
          graph: {
            specId: options.graph.specId ?? 42,
            commandExecutor: {} as never,
            reads: {
              queryGraph: () =>
                ({
                  lsn: options.graph!.lsn,
                  nodes: options.graph!.nodes,
                  edges: options.graph!.edges,
                }) as never,
              getNodes: () => [],
              resolveNodeCode: () => undefined,
              getElicitationGaps: () => [],
              getOpenReconciliationNeeds: () => [],
              latestLsn: () => options.graph!.lsn,
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
        PRESENT_QUESTION_TOOL,
        REQUEST_RESPONSE_TOOL,
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
        PRESENT_QUESTION_TOOL,
        REQUEST_RESPONSE_TOOL,
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
