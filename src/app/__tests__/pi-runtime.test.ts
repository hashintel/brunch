import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openWorkspaceGraphRuntime } from '../../graph/index.js';
import { createProductUpdatePublisher } from '../../rpc/product-updates.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { createBrunchAgentSessionRuntimeFactory } from '../brunch-tui.js';

describe('Brunch Pi runtime', () => {
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
});
