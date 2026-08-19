import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTestLabTheme } from '../../.pi/__tests__/support/tui-theme.js';
import { buildCurrentProjectionForSpec } from '../../.pi/extensions/executor/current-projection.js';
import { projectExecuteGraph } from '../../executor/execute-projection.js';
import { writePlanFile } from '../../executor/plan-file.js';
import { resolveDeterministicProcessMoveAvailability } from '../../executor/process-move-availability.js';
import { openWorkspaceGraphRuntime } from '../../graph/index.js';
import { createProductUpdatePublisher } from '../../rpc/product-updates.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { createBrunchAgentSessionRuntimeFactory } from '../brunch-tui.js';
import { appendBrunchAgentRuntimeSwitch } from '../pi-extensions.js';

describe('Brunch Pi runtime', () => {
  it('exposes no host-landing surface in an isolated execution comparison', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-comparison-runtime-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({
      specTitle: 'Comparison runtime',
      createNewSpec: true,
    });
    const createRuntime = createBrunchAgentSessionRuntimeFactory({
      workspace,
      coordinator,
      comparisonIsolation: { targetRoot: cwd },
    });
    const created = await createRuntime({
      cwd,
      agentDir,
      sessionManager: workspace.session.manager,
    });

    try {
      expect(created.session.extensionRunner.getCommand('brunch:land')).toBeUndefined();
      expect(created.session.getToolDefinition('execute_land_preflight')).toBeUndefined();
    } finally {
      created.session.dispose();
    }
  });

  it('registers graph and read-only tools without built-in write tools on the product runtime path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-graph-runtime-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({
      specTitle: 'Graph runtime',
      createNewSpec: true,
    });
    const createRuntime = createBrunchAgentSessionRuntimeFactory({ workspace, coordinator });
    const created = await createRuntime({
      cwd,
      agentDir,
      sessionManager: workspace.session.manager,
    });

    try {
      const toolNames = created.session.getAllTools().map((tool) => tool.name);
      expect(toolNames).toContain('mutate_graph');
      expect(toolNames).toContain('read_graph');
      expect(toolNames).toEqual(expect.arrayContaining(['read', 'grep', 'find', 'ls']));
      expect(toolNames).not.toEqual(expect.arrayContaining(['bash', 'edit', 'write']));
      const activeToolNames = created.session.getActiveToolNames();
      expect(activeToolNames).toEqual(expect.arrayContaining(['read', 'grep', 'find', 'ls']));
      expect(activeToolNames).not.toEqual(expect.arrayContaining(['bash', 'edit', 'write']));
    } finally {
      created.session.dispose();
    }
  });

  it('binds graph tools to the coordinator current spec when the runtime factory is reused after a switch', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-graph-switch-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const first = await coordinator.createSetupSession({
      specTitle: 'First spec',
      createNewSpec: true,
    });
    const productUpdates = createProductUpdatePublisher();
    const observedUpdates: Array<readonly unknown[]> = [];
    const unsubscribe = productUpdates.subscribe((updates) => {
      observedUpdates.push(updates);
    });
    const createRuntime = createBrunchAgentSessionRuntimeFactory({
      workspace: first,
      coordinator,
      productUpdates,
    });
    const second = await coordinator.createSetupSession({
      specTitle: 'Second spec',
      createNewSpec: true,
    });

    const created = await createRuntime({
      cwd,
      agentDir,
      sessionManager: second.session.manager,
    });

    try {
      const mutateGraph = created.session.getToolDefinition('mutate_graph') as
        | {
            execute: (
              id: string,
              params: unknown,
              signal?: AbortSignal,
              onUpdate?: unknown,
              ctx?: unknown,
            ) => unknown;
          }
        | undefined;
      expect(mutateGraph).toBeDefined();

      await mutateGraph!.execute(
        'commit-after-switch',
        {
          ops: [
            { op: 'create_node', ref: 'n1', plane: 'intent', kind: 'goal', title: 'Second current goal' },
          ],
        },
        undefined,
        undefined,
        undefined,
      );

      const graph = await openWorkspaceGraphRuntime(cwd);
      expect(graph.forSpec(first.spec.id).queryGraph().nodes).toHaveLength(0);
      expect(
        graph
          .forSpec(second.spec.id)
          .queryGraph()
          .nodes.map((node) => node.title),
      ).toEqual(['Second current goal']);
      expect(observedUpdates).toEqual([
        [
          { topic: 'graph.overview', specId: second.spec.id, lsn: expect.any(Number) },
          { topic: 'graph.nodeNeighborhood', specId: second.spec.id, lsn: expect.any(Number) },
        ],
      ]);
    } finally {
      unsubscribe();
      created.session.dispose();
    }
  });

  it('composes brownfield Execute availability read-only from the current graph and plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-availability-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({
      specTitle: 'Availability runtime',
      createNewSpec: true,
    });
    const graph = await openWorkspaceGraphRuntime(cwd);
    const requirement = graph.commandExecutor.createNode({
      specId: workspace.spec.id,
      plane: 'intent',
      kind: 'requirement',
      title: 'Build it',
      basis: 'explicit',
    });
    const criterion = graph.commandExecutor.createNode({
      specId: workspace.spec.id,
      plane: 'intent',
      kind: 'criterion',
      title: 'It works',
      basis: 'explicit',
    });
    graph.commandExecutor.createNode({
      specId: workspace.spec.id,
      plane: 'oracle',
      kind: 'vv_method',
      title: 'Project execution harness',
      body: 'execute.verify: npm test',
      basis: 'explicit',
    });
    if (requirement.status !== 'success' || criterion.status !== 'success')
      throw new Error('graph seed failed');
    const mutation = graph.commandExecutor.mutateGraph({
      specId: workspace.spec.id,
      ops: [
        {
          op: 'create_edge',
          category: 'witness',
          oracle: { existing: criterion.nodeId },
          claim: { existing: requirement.nodeId },
          stance: 'for',
        },
      ],
    });
    expect(mutation.status).toBe('success');
    const graphBefore = graph.forSpec(workspace.spec.id).queryGraph(undefined, { visibility: 'active' });
    const projection = projectExecuteGraph({
      specId: workspace.spec.id,
      graphLsn: graphBefore.lsn,
      nodes: graphBefore.nodes,
      edges: graphBefore.edges,
      mode: 'brownfield',
    });
    expect(projection.check).toMatchObject({ status: 'ok' });
    await writePlanFile({ cwd, preview: projection.planPreview, source: projection.source });
    const rebuilt = await buildCurrentProjectionForSpec({
      cwd,
      specId: workspace.spec.id,
      reads: graph.forSpec(workspace.spec.id),
    });
    expect(rebuilt.current.mode).toBe('brownfield');
    expect(await resolveDeterministicProcessMoveAvailability({ cwd, ...rebuilt })).toMatchObject({
      compile_plan: true,
      execute_plan: true,
    });
    appendBrunchAgentRuntimeSwitch(
      workspace.session.manager,
      { schemaVersion: 1, operationalMode: 'execute' },
      'user',
    );
    const specsDir = join(cwd, '.brunch', 'cook', 'specs', String(workspace.spec.id));
    const specFilesBefore = await readdir(specsDir);
    const specBytesBefore = await Promise.all(specFilesBefore.map((file) => readFile(join(specsDir, file))));
    const runsDir = join(cwd, '.brunch', 'cook', 'runs');
    const runsBefore = await readdir(runsDir).catch(() => [] as string[]);
    const createRuntime = createBrunchAgentSessionRuntimeFactory({ workspace, coordinator });
    const created = await createRuntime({ cwd, agentDir, sessionManager: workspace.session.manager });
    const branchBefore = JSON.stringify(workspace.session.manager.getBranch());
    const customFactories: Array<(...args: unknown[]) => unknown> = [];

    try {
      const consult = created.session.extensionRunner.getCommand('brunch:consult') as
        | { handler: (args: string, ctx: unknown) => Promise<void> }
        | undefined;
      expect(consult).toBeDefined();
      const ctx = created.session.createReplacedSessionContext();
      await consult!.handler('', {
        ...ctx,
        hasUI: true,
        ui: {
          ...ctx.ui,
          custom: async (factory: (...args: unknown[]) => unknown) => {
            customFactories.push(factory);
            return undefined;
          },
        },
      });

      const rendered = (
        customFactories[0]!(undefined, createTestLabTheme(), undefined, () => {}) as {
          render(width: number): string[];
        }
      )
        .render(80)
        .join('\n');
      expect(rendered).toContain('Compile a plan');
      expect(rendered).toContain('Execute the plan');
      expect(JSON.stringify(workspace.session.manager.getBranch())).toBe(branchBefore);
      expect(graph.forSpec(workspace.spec.id).queryGraph()).toEqual(graphBefore);
      expect(await readdir(specsDir)).toEqual(specFilesBefore);
      const specBytesAfter = await Promise.all(specFilesBefore.map((file) => readFile(join(specsDir, file))));
      expect(specBytesAfter.map(String)).toEqual(specBytesBefore.map(String));
      expect(await readdir(runsDir).catch(() => [] as string[])).toEqual(runsBefore);
    } finally {
      created.session.dispose();
    }
  });

  it('wires executor agent runner subagents in Execute mode without dev tools', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-executor-runtime-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({
      specTitle: 'Executor runtime',
      createNewSpec: true,
    });
    appendBrunchAgentRuntimeSwitch(
      workspace.session.manager,
      { schemaVersion: 1, operationalMode: 'execute' },
      'user',
    );
    const runId = 'run-agent-runtime';
    const sliceId = 'task-1';
    const runDir = join(cwd, '.brunch', 'cook', 'runs', runId);
    const worktreeDir = join(runDir, 'worktree');
    const requestPath = join(runDir, 'agent-output', sliceId, 'request.json');
    await mkdir(join(runDir, 'agent-output', sliceId), { recursive: true });
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(requestPath, `${JSON.stringify({ runId, sliceId })}\n`, 'utf8');
    await writeFile(
      join(runDir, 'run.json'),
      `${JSON.stringify({
        runId,
        specId: String(workspace.spec.id),
        planPath: join(cwd, '.brunch', 'cook', 'specs', String(workspace.spec.id), 'plan.json'),
        status: 'slice_execution_requested',
        worktreeDir,
        reportsPath: join(runDir, 'reports.jsonl'),
        activeSliceId: sliceId,
        activeEpicId: 'frontier-1',
        sliceExecutionRequestPath: requestPath,
      })}\n`,
      'utf8',
    );
    const createRuntime = createBrunchAgentSessionRuntimeFactory({ workspace, coordinator });
    const created = await createRuntime({
      cwd,
      agentDir,
      sessionManager: workspace.session.manager,
    });

    try {
      expect(created.session.getToolDefinition('subagent')).toBeUndefined();
      const executeAgentResult = created.session.getToolDefinition('execute_agent_result') as
        | {
            execute: (
              id: string,
              params: unknown,
              signal?: AbortSignal,
              onUpdate?: unknown,
              ctx?: unknown,
            ) => Promise<{ details: { result: { message?: string } } }>;
          }
        | undefined;
      expect(executeAgentResult).toBeDefined();

      const result = await executeAgentResult!.execute(
        'agent-runner-no-model',
        { runId },
        undefined,
        undefined,
        { cwd },
      );

      expect(result.details.result.message).toBe(
        'AgentRunnerPort requires Pi model context to launch the worker.',
      );
    } finally {
      created.session.dispose();
    }
  });
});
