/**
 * FE-847 coverage-first scaffold suites (I45-L watermark, I46-L honest
 * origination, I47-L carrier discipline) over the tier-2 real-boot harness.
 * Split from tier-2-harness.test.ts; kick/boot-path suites stay there.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildSessionContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { compactionAnchorContract } from '../../.pi/extensions/compaction/index.js';
import { openWorkspaceGraphRuntime } from '../../graph/index.js';
import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import { projectAssistantVisibleWatermark } from '../../projections/session/assistant-visible-watermark.js';
import {
  bootTier2RuntimeFromFixture,
  bootTier2RuntimeThroughRunBrunchTui,
  rebootTier2Runtime,
  withTier2FauxAgentServices,
} from '../tier-2-harness.js';
import {
  customEntries,
  executeReadGraph,
  expectNoKick,
  presentToolResults,
  readSessionContextSpecId,
  requestChoicesResultMessage,
  userMessages,
  waitForKick,
} from './support/tier-2-test-support.js';

describe('FE-847 coverage-first scaffold — I45-L assistant-visible watermark', () => {
  it('seed and full-overview snapshots advance the watermark while narrow getNodes/queryNodes reads do not', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const first = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Narrow-read goal',
      });
      if (first.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await executeReadGraph(boot.runtime.session, { mode: 'list_by_kind', kinds: ['goal'], show: 'all' });
      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});
      const afterNarrowRead = boot.runtime.session.sessionManager.getEntries();
      expect(customEntries(afterNarrowRead, 'worldUpdate')).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            currentLsn: first.lsn,
            changedSinceLsn: 1,
            items: expect.arrayContaining([
              expect.objectContaining({ lsn: first.lsn, title: 'Narrow-read goal' }),
            ]),
          }),
        }),
      ]);

      await executeReadGraph(boot.runtime.session, { mode: 'overview', show: 'all' });
      const afterOverview = boot.runtime.session.sessionManager.getEntries();
      expect(projectAssistantVisibleWatermark(afterOverview, { specId })).toEqual({ specId, lsn: first.lsn });
      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});
      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')).toHaveLength(1);
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('worldUpdate emits the strict-greater set through the live provider guard retry', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId,
        snapshotLsn: 1,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const stale = graph.commandExecutor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Old' });
      const fresh = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'requirement',
        title: 'Fresh',
      });
      if (stale.status !== 'success' || fresh.status !== 'success') {
        throw new Error('Failed to create Tier-2 graph fixture nodes');
      }

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            currentLsn: fresh.lsn,
            changedSinceLsn: 1,
            items: [expect.objectContaining({ lsn: stale.lsn }), expect.objectContaining({ lsn: fresh.lsn })],
          }),
        }),
      ]);

      // FE-857 card 1 payoff: the worldUpdate notice is provider-visible — pi's
      // own context builder (the function the provider call path uses) surfaces
      // its rendered text as an LLM-context message, not just a ledger fact.
      const llmContext = buildSessionContext(boot.runtime.session.sessionManager.getEntries() as never);
      const contextText = JSON.stringify(llmContext.messages);
      expect(contextText).toContain('Graph updated for spec');
      expect(contextText).toContain('Fresh');
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('bare LSNs are never compared across specs; watermark comparisons use {specId, lsn}', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId: specId + 1,
        snapshotLsn: 99,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const node = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Spec-local',
      });
      if (node.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ specId, changedSinceLsn: 1, currentLsn: node.lsn }),
        }),
      );
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('a foreign write between snapshot read and seed insertion is not masked by the seed', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId,
        snapshotLsn: 1,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const node = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Foreign write after seed snapshot',
      });
      if (node.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            changedSinceLsn: 1,
            items: [expect.objectContaining({ title: 'Foreign write after seed snapshot' })],
          }),
        }),
      );
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('same-session capture is surfaced by the next worldUpdate rather than swallowed as already visible', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId,
        snapshotLsn: 1,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const node = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'context',
        title: 'Captured from submit',
      });
      if (node.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            items: [expect.objectContaining({ title: 'Captured from submit' })],
          }),
        }),
      );
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });
});

describe('FE-847 coverage-first scaffold — I46-L honest origination', () => {
  it('a new session seeds context and appends the assistant-originated offer with no fabricated user entry', async () => {
    // Decision + append claim over transcript entries. The *live* kick turn
    // (provider call with no harness prompt) is owned by the
    // origination-kick-live oracle at the top of this file.
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      const entries = boot.runtime.session.sessionManager.getEntries();
      expect(customEntries(entries, 'brunch.context_seed')).toEqual([
        expect.objectContaining({ data: { specId, snapshotLsn: expect.any(Number) } }),
      ]);
      // No fabricated offer (D78-L revised): origination is seed-only.
      expect(presentToolResults(entries)).toHaveLength(0);
      expect(entries).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.objectContaining({ role: 'user' }) }),
        ]),
      );
      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});
      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')).toHaveLength(0);
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('seed content composition (FE-857): the seed carries the spec overview and graph facts + scratchpad into provider-visible context', async () => {
    // Content claim (buildSessionContext over entries). Startup *lifecycle*
    // completeness is owned by the origination-kick-live oracle.
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);

      const entries = boot.runtime.session.sessionManager.getEntries();
      const seeds = customEntries(entries, 'brunch.context_seed');
      expect(seeds).toHaveLength(1);

      // The seed entry is the provider-visible carrier: its content names the
      // spec graph state, the thin graph-fact seed, and the session
      // scratchpad; details still carry the watermark payload for the
      // projection. It never carries a persisted agenda row (D65-L/D101-L).
      const seed = seeds[0] as { content?: unknown; data: unknown };
      expect(seed.data).toEqual({ specId, snapshotLsn: expect.any(Number) });
      const seedContent = typeof seed.content === 'string' ? seed.content : '';
      expect(seedContent).toContain(`spec ${specId}`);
      expect(seedContent).toContain('Graph facts:');
      expect(seedContent).toContain('ELICITATION SCRATCHPAD');

      // pi's own context builder surfaces the seeded overview in the LLM
      // context the opening turn runs against (lifecycle is owned by the
      // origination-kick-live oracle).
      const llmContext = buildSessionContext(entries as never);
      const contextText = JSON.stringify(llmContext.messages);
      expect(contextText).toContain('Context seeded for spec');
      expect(contextText).toContain('ELICITATION SCRATCHPAD');
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('resume kick uses the pre-reconcile tail so a user tail still earns a kick after continuity notices', async () => {
    await withTier2FauxAgentServices(async (faux) => {
      const boot = await bootTier2RuntimeFromFixture({
        agentServices: faux.agentServices,
        fixtureEntries: (specId) => [
          { type: 'message', message: userMessage('Resume me: what is the next question?') },
          { type: 'custom', customType: 'worldUpdate', data: { specId, currentLsn: 99, items: [] } },
          {
            type: 'custom',
            customType: 'brunch.mention_staleness_hint',
            data: { specId, entityId: 1, seenLsn: 1, currentLsn: 99 },
          },
        ],
      });
      try {
        await waitForKick(boot.runtime);
        const entries = boot.runtime.session.sessionManager.getEntries();
        expect(customEntries(entries, 'brunch.kick')).toHaveLength(1);
        expect(userMessages(entries)).toHaveLength(1);
      } finally {
        await boot.runtime.dispose();
        boot.restoreEnv();
      }

      // A user tail still earns the kick when earlier completed exchanges exist
      // in the transcript — past exchange results must not blanket-suppress the
      // resume-debt decision.
      const postExchange = await bootTier2RuntimeFromFixture({
        agentServices: faux.agentServices,
        fixtureEntries: (specId) => [
          { type: 'message', message: userMessage('First question') },
          { type: 'message', message: requestChoicesResultMessage('answered') },
          { type: 'message', message: userMessage('Follow-up you never answered') },
          { type: 'custom', customType: 'worldUpdate', data: { specId, currentLsn: 99, items: [] } },
        ],
      });
      try {
        await waitForKick(postExchange.runtime);
        expect(
          customEntries(postExchange.runtime.session.sessionManager.getEntries(), 'brunch.kick'),
        ).toHaveLength(1);
      } finally {
        await postExchange.runtime.dispose();
        postExchange.restoreEnv();
      }
    });
  });

  it('request_* and system leaves stay idle on resume', async () => {
    await withTier2FauxAgentServices(async (faux) => {
      for (const status of ['answered', 'cancelled', 'unavailable'] as const) {
        const boot = await bootTier2RuntimeFromFixture({
          agentServices: faux.agentServices,
          fixtureEntries: () => [
            { type: 'message', message: userMessage('Earlier question') },
            { type: 'message', message: requestChoicesResultMessage(status) },
          ],
        });
        try {
          await expectNoKick(boot.runtime);
        } finally {
          await boot.runtime.dispose();
          boot.restoreEnv();
        }
      }

      const assistantLeaf = await bootTier2RuntimeFromFixture({
        agentServices: faux.agentServices,
        fixtureEntries: () => [
          { type: 'message', message: userMessage('Earlier question') },
          { type: 'message', message: assistantMessage('System-side answer; nothing owed.') },
        ],
      });
      try {
        await expectNoKick(assistantLeaf.runtime);
      } finally {
        await assistantLeaf.runtime.dispose();
        assistantLeaf.restoreEnv();
      }
    });
  });

  it('crash-after-notice-before-provider still kicks when the underlying debt is unanswered', async () => {
    // Reconciler-inserted seed/notices landed, then the process died before the
    // provider call; reboot must still answer the user's unresolved debt and
    // must not duplicate the already-written seed.
    await withTier2FauxAgentServices(async (faux) => {
      const boot = await bootTier2RuntimeFromFixture({
        agentServices: faux.agentServices,
        fixtureEntries: (specId) => [
          { type: 'message', message: userMessage('Crashed before you answered this.') },
          { type: 'custom', customType: 'brunch.context_seed', data: { specId, snapshotLsn: 9999 } },
          { type: 'custom', customType: 'worldUpdate', data: { specId, currentLsn: 9999, items: [] } },
        ],
      });
      try {
        await waitForKick(boot.runtime);
        const entries = boot.runtime.session.sessionManager.getEntries();
        expect(customEntries(entries, 'brunch.kick')).toHaveLength(1);
        expect(customEntries(entries, 'brunch.context_seed')).toHaveLength(1);
      } finally {
        await boot.runtime.dispose();
        boot.restoreEnv();
      }
    });
  });

  it('trailing side-task or reviewer drains are continuity-only and do not manufacture or mask debt', async () => {
    await withTier2FauxAgentServices(async (faux) => {
      const noDebt = await bootTier2RuntimeFromFixture({
        agentServices: faux.agentServices,
        fixtureEntries: (specId) => [
          { type: 'message', message: userMessage('Earlier question') },
          { type: 'message', message: requestChoicesResultMessage('answered') },
          { type: 'custom', customType: 'brunch.side_task_result', data: { specId, taskId: 't1' } },
          { type: 'custom', customType: 'brunch.reviewer_drain', data: { specId, findings: [] } },
        ],
      });
      try {
        await expectNoKick(noDebt.runtime);
      } finally {
        await noDebt.runtime.dispose();
        noDebt.restoreEnv();
      }

      const maskedDebt = await bootTier2RuntimeFromFixture({
        agentServices: faux.agentServices,
        fixtureEntries: (specId) => [
          { type: 'message', message: userMessage('Still waiting on this.') },
          { type: 'custom', customType: 'brunch.side_task_result', data: { specId, taskId: 't1' } },
        ],
      });
      try {
        await waitForKick(maskedDebt.runtime);
        expect(
          customEntries(maskedDebt.runtime.session.sessionManager.getEntries(), 'brunch.kick'),
        ).toHaveLength(1);
      } finally {
        await maskedDebt.runtime.dispose();
        maskedDebt.restoreEnv();
      }
    });
  });
});

describe('FE-847 coverage-first scaffold — I47-L carrier discipline and idempotence', () => {
  it('no redundant worldUpdate is emitted immediately after a seed naming the current snapshot LSN', async () => {
    const boot = await bootTier2RuntimeFromFixture({ fixtureEntries: () => [] });
    try {
      const entries = boot.runtime.session.sessionManager.getEntries();
      const seeds = customEntries(entries, 'brunch.context_seed');
      expect(seeds).toHaveLength(1);
      expect(seeds[0]?.data).toMatchObject({ specId: boot.specId, snapshotLsn: expect.any(Number) });

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});
      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')).toHaveLength(0);
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('compaction and resume preserve the latest watermark carrier so projection cannot regress', () => {
    const latestAnchorsByKind = new Map(
      compactionAnchorContract.anchors
        .filter((anchor) => anchor.select === 'latest')
        .map((anchor) => [anchor.kind, anchor.select]),
    );
    expect(latestAnchorsByKind.get('brunch.context_seed')).toBe('latest');
    expect(latestAnchorsByKind.get('brunch.graph_overview_snapshot')).toBe('latest');
    expect(latestAnchorsByKind.get('brunch.own_mutation')).toBe('latest');
    expect(latestAnchorsByKind.get('worldUpdate')).toBe('latest');

    const specId = 1;
    const compactedEntries = [
      { type: 'custom', customType: 'brunch.context_seed', data: { specId, snapshotLsn: 2 } },
      { type: 'custom', customType: 'worldUpdate', data: { specId, currentLsn: 5 } },
      { type: 'custom', customType: 'brunch.graph_overview_snapshot', data: { specId, snapshotLsn: 8 } },
    ];
    expect(projectAssistantVisibleWatermark(compactedEntries, { specId })).toEqual({ specId, lsn: 8 });
  });

  it('boot/resume seeding derives dedupe from transcript projection rather than hidden flags', async () => {
    // First real boot seeds and kicks; an actual restart over the same session
    // file must not duplicate the seed, the kick, or synthesize a worldUpdate —
    // with no state surviving except the transcript itself.
    const boot = await bootTier2RuntimeFromFixture({ fixtureEntries: () => [] });
    let rebooted: Awaited<ReturnType<typeof rebootTier2Runtime>> | undefined;
    try {
      const firstEntries = boot.runtime.session.sessionManager.getEntries();
      expect(customEntries(firstEntries, 'brunch.context_seed')).toHaveLength(1);
      expect(presentToolResults(firstEntries)).toHaveLength(0);

      const flushManager = boot.runtime.session.sessionManager;
      await boot.runtime.dispose();
      rebooted = await rebootTier2Runtime({
        cwd: boot.cwd,
        specId: boot.specId,
        sessionFile: boot.sessionFile,
        flushManager,
      });

      const rebootedEntries = rebooted.runtime.session.sessionManager.getEntries();
      expect(customEntries(rebootedEntries, 'brunch.context_seed')).toHaveLength(1);
      expect(presentToolResults(rebootedEntries)).toHaveLength(0);
      await rebooted.runtime.session.extensionRunner.emitBeforeProviderRequest({});
      expect(customEntries(rebooted.runtime.session.sessionManager.getEntries(), 'worldUpdate')).toHaveLength(
        0,
      );
    } finally {
      await rebooted?.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('continuity assertions use sets and {specId, lsn} properties rather than payload-order goldens', async () => {
    // Suite convention, enforced mechanically: continuity proofs in this file
    // assert sets and {specId, lsn} properties; no canonical item sort is
    // specified, so payload-order goldens are banned.
    const source = await readFile(
      fileURLToPath(new URL('./tier-2-harness.test.ts', import.meta.url)),
      'utf8',
    );
    const goldenMatchers = ['Snapshot', 'FileSnapshot', 'InlineSnapshot'].map(
      (suffix) => `toMatch${suffix}(`,
    );
    for (const matcher of goldenMatchers) {
      expect(source.includes(matcher)).toBe(false);
    }
  });
});
