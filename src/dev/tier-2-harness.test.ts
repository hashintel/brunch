import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildSessionContext, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { compactionAnchorContract } from '../.pi/extensions/compaction/index.js';
import { openWorkspaceGraphRuntime } from '../graph/index.js';
import { assistantMessage, userMessage } from '../probes/test-helpers.js';
import { projectRequestChoices } from '../projections/exchanges/request-choices.js';
import { projectAssistantVisibleWatermark } from '../projections/session/assistant-visible-watermark.js';
import { projectBrunchAgentState } from '../projections/session/runtime-state.js';
import { BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE } from '../session/runtime-state.js';
import {
  bootTier2ProductOriginatedTurn,
  bootTier2RuntimeFromFixture,
  bootTier2RuntimeThroughRunBrunchTui,
  createTier2FauxAgentServices,
  rebootTier2Runtime,
  resumeTier2Fixture,
  runTier2RealBootFauxTurn,
  waitForCondition,
} from './tier-2-harness.js';

/** Wait for the product kick turn (brunch.kick entry) on a fixture boot. */
async function waitForKick(runtime: { session: { sessionManager: { getEntries(): readonly unknown[] } } }) {
  await waitForCondition(
    () => customEntries(runtime.session.sessionManager.getEntries(), 'brunch.kick').length > 0,
    8000,
    'resume kick turn (brunch.kick entry)',
  );
}

/** Settle window in which a wrongly-fired kick would have appended its entry. */
async function expectNoKick(runtime: { session: { sessionManager: { getEntries(): readonly unknown[] } } }) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(customEntries(runtime.session.sessionManager.getEntries(), 'brunch.kick')).toHaveLength(0);
}

describe('origination-kick-live — the product originates the opening turn on its own bones', () => {
  it('a new spec boot fires a provider call with no harness prompt, carrying the seeded context', async () => {
    const boot = await bootTier2ProductOriginatedTurn();
    try {
      expect(boot.providerContexts.length).toBeGreaterThan(0);
      const contextText = JSON.stringify(boot.providerContexts[0]!.messages);
      expect(contextText).toContain('Context seeded for spec');
      expect(contextText).toContain('Open elicitation gaps');

      const entries = boot.runtime.session.sessionManager.getEntries();
      // Revised D78-L (2026-06-12): the product fabricates no present_* offer;
      // the assistant authors the opening live from the seeded context.
      expect(presentToolResults(entries)).toHaveLength(0);
      expect(userMessages(entries)).toHaveLength(0);
      expect(customEntries(entries, 'brunch.kick')).toHaveLength(1);

      // Provider legality (Anthropic 400 regression, 2026-06-12 walkthrough):
      // every tool result in the payload must use a ^[a-zA-Z0-9_-]+$ id and be
      // paired with a preceding assistant toolCall carrying the same id.
      expectProviderLegalToolPairs(boot.providerContexts[0]!.messages);
    } finally {
      await boot.dispose();
    }
  });

  it('picker path parity: continue an existing spec into a new session also kicks', async () => {
    const boot = await bootTier2ProductOriginatedTurn({ activation: 'pickerNewSession' });
    try {
      expect(boot.providerContexts.length).toBeGreaterThan(0);
      const entries = boot.runtime.session.sessionManager.getEntries();
      expect(presentToolResults(entries)).toHaveLength(0);
      expect(userMessages(entries)).toHaveLength(0);
    } finally {
      await boot.dispose();
    }
  });

  it('reboot over the kicked session stays idle — no second kick, offer, or provider call', async () => {
    const boot = await bootTier2ProductOriginatedTurn();
    try {
      expect(boot.providerContexts).toHaveLength(1);
      const reboot = await rebootTier2Runtime({
        cwd: boot.cwd,
        specId: boot.specId,
        sessionFile: boot.sessionFile,
        flushManager: boot.runtime.session.sessionManager,
        agentServices: boot.agentServices,
      });
      try {
        // settle: any wrongly-fired trigger would capture within this window
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(boot.providerContexts).toHaveLength(1);
        const entries = reboot.runtime.session.sessionManager.getEntries();
        // No fabricated offers on either boot; exactly one kick across both
        // (crash-after-kick reboot rests idle — assistant tail owes nothing).
        expect(presentToolResults(entries)).toHaveLength(0);
        expect(customEntries(entries, 'brunch.kick')).toHaveLength(1);
      } finally {
        await reboot.runtime.dispose();
      }
    } finally {
      await boot.dispose();
    }
  });

  it('a seeded-but-unkicked session is visible in .brunch/debug/entry-contents.md with zero provider calls', async () => {
    // The regression named for the 2026-06-11 walkthrough defect: both prior
    // debug surfaces were provider-activity-driven, so a boot whose kick
    // never fired left no observable trace. The entry mirror hooks the append
    // seam instead — dev boots show Brunch entries before any turn runs.
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: true });
    try {
      // dev boot has no model → no kick → no provider call; the mirror must exist anyway
      const mirror = await readFile(`${boot.cwd}/.brunch/debug/entry-contents.md`, 'utf8');
      expect(mirror).toContain('brunch.context_seed');
      expect(mirror).toContain('Open elicitation gaps');
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('without BRUNCH_DEV no entry mirror is written', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      await expect(readFile(`${boot.cwd}/.brunch/debug/entry-contents.md`, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('a boot with no available model does not kick (content boots stay deterministic)', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      // No auth/provider in this boot — the model-availability guard must keep
      // the trigger silent rather than firing a turn that errors at startup.
      await new Promise((resolve) => setTimeout(resolve, 100));
      const entries = boot.runtime.session.sessionManager.getEntries();
      expect(customEntries(entries, 'brunch.kick')).toHaveLength(0);
      // The synthetic present_* pair includes a sentinel-provenance assistant
      // toolCall; "no kick turn ran" means no provider-produced assistant message.
      expect(
        messagesByRole(entries, 'assistant').filter((message) => message.provider !== 'brunch'),
      ).toHaveLength(0);
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });
});

describe('FE-847 Tier-2 real boot harness', () => {
  it('owns real runtime boot proof for ready context and BRUNCH_DEV-gated query tools', async () => {
    const productBoot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      expect(productBoot.runtime.session.sessionManager.getHeader()).toMatchObject({
        cwd: productBoot.cwd,
        id: expect.any(String),
        type: 'session',
      });
      await expect(readSessionContextDetails(productBoot.runtime.session)).resolves.toMatchObject({
        status: 'ready',
        specId: expect.any(Number),
      });
      await expect(readWorkspaceContextMarkdownFiles(productBoot.runtime.session)).resolves.toContain(
        'boot-seam.md',
      );
      expect(productBoot.runtime.session.getAllTools().map((tool) => tool.name)).not.toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
      expect(productBoot.runtime.session.getActiveToolNames()).not.toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
    } finally {
      await productBoot.runtime.dispose();
      productBoot.restoreEnv();
    }

    const devBoot = await bootTier2RuntimeThroughRunBrunchTui({ dev: true });
    try {
      expect(devBoot.runtime.session.sessionManager.getHeader()).toMatchObject({ cwd: devBoot.cwd });
      await expect(readSessionContextDetails(devBoot.runtime.session)).resolves.toMatchObject({
        status: 'ready',
      });
      expect(devBoot.runtime.session.getAllTools().map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
      expect(devBoot.runtime.session.getActiveToolNames()).toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
    } finally {
      await devBoot.runtime.dispose();
      devBoot.restoreEnv();
    }
  });

  it('invokes a registered Brunch runtime switch command through the real runBrunchTui boot', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const command = boot.runtime.session.extensionRunner.getCommand('brunch:lens');
      expect(command).toBeDefined();

      await command?.handler('intent', boot.runtime.session.extensionRunner.createCommandContext());

      const entries = boot.runtime.session.sessionManager.getEntries();
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'custom',
            customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
            data: expect.objectContaining({
              reason: 'switch',
              source: 'user',
              state: expect.objectContaining({ agentLens: 'intent' }),
              previous: expect.objectContaining({ agentLens: 'auto' }),
            }),
          }),
        ]),
      );
      expect(projectBrunchAgentState(entries).agentLens).toBe('intent');
      expect(boot.runtime.session.getActiveToolNames()).not.toEqual(expect.arrayContaining(['bash']));
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('boots runBrunchTui, drives one faux-provider turn, captures payload, and inspects transcript entries', async () => {
    const result = await runTier2RealBootFauxTurn({
      prompt: 'Tier-2 oracle prompt',
      responseText: 'Tier-2 oracle response',
    });

    expect(result.providerPayload).toBeDefined();
    expect(result.providerContexts).toHaveLength(1);
    expect(result.activeToolNames).toEqual(result.providerPayload?.activeToolNames);
    expect(result.assistantText).toBe('Tier-2 oracle response');
    expect(result.transcriptEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          message: expect.objectContaining({ role: 'user' }),
        }),
        expect.objectContaining({
          type: 'message',
          message: expect.objectContaining({ role: 'assistant' }),
        }),
      ]),
    );
    expect(JSON.stringify(result.transcriptEntries)).toContain('Tier-2 oracle prompt');
    expect(result.renderedTranscript).toContain('Tier-2 oracle response');
  });

  it('resumes from a fixture transcript and exposes transcript state', async () => {
    const fixtureJsonl = [
      JSON.stringify(userMessage('Fixture question')),
      JSON.stringify(assistantMessage('Fixture answer')),
    ].join('\n');

    const result = await resumeTier2Fixture({ fixtureJsonl });

    expect(result.resumedSameSessionFile).toBe(true);
    expect(result.originalSessionFile).toBe(result.sessionFile);
    expect(result.transcriptEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'message', message: expect.objectContaining({ role: 'user' }) }),
        expect.objectContaining({ type: 'message', message: expect.objectContaining({ role: 'assistant' }) }),
      ]),
    );
    expect(JSON.stringify(result.transcriptEntries)).toContain('Fixture question');
  });
});

describe('FE-844/FE-847 live gap legality through real boot', () => {
  it('derives prompt/tool legality from the selected spec real gap coverage, not a fallback floor', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);

      // Legality is derived at the turn boundary (before_agent_start); this
      // harness does not fire session_start, so drive the boundary directly.
      // Fresh spec: grounding floor gaps are uncovered, so capability-gated
      // tools stay locked while floor tools remain available (and elicit mode
      // never advertises bash/edit/write).
      await boot.runtime.session.extensionRunner.emitBeforeAgentStart(
        'Derive legality',
        undefined,
        '',
        {} as never,
      );
      const lockedTools = boot.runtime.session.getActiveToolNames();
      expect(lockedTools).toEqual(expect.arrayContaining(['read_graph']));
      expect(lockedTools).not.toEqual(expect.arrayContaining(['mutate_graph']));
      expect(lockedTools).not.toEqual(expect.arrayContaining(['bash']));

      // Cover the grounding floor in the real graph (foreign writer).
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      for (const kind of ['context', 'thesis', 'goal', 'constraint'] as const) {
        const created = graph.commandExecutor.createNode({
          specId,
          plane: 'intent',
          kind,
          title: `${kind} floor coverage`,
        });
        if (created.status !== 'success') throw new Error(`Failed to create ${kind} coverage node`);
      }

      // The next turn boundary re-derives legality from live selected-spec
      // gap reads — covered floor gaps unlock the gated posture.
      await boot.runtime.session.extensionRunner.emitBeforeAgentStart(
        'Re-derive legality',
        undefined,
        '',
        {} as never,
      );
      const unlockedTools = boot.runtime.session.getActiveToolNames();
      expect(unlockedTools).toEqual(expect.arrayContaining(['mutate_graph']));
      expect(unlockedTools).not.toEqual(expect.arrayContaining(['bash']));
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });
});

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

  it('seed content composition (FE-857): the seed carries the spec overview and gap framing into provider-visible context', async () => {
    // Content claim (buildSessionContext over entries). Startup *lifecycle*
    // completeness is owned by the origination-kick-live oracle.
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const gaps = graph.forSpec(specId).getElicitationGaps();
      const topGap = gaps.find((gap) => !gap.answered && gap.disposition === 'open');
      expect(topGap).toBeDefined();

      const entries = boot.runtime.session.sessionManager.getEntries();
      const seeds = customEntries(entries, 'brunch.context_seed');
      expect(seeds).toHaveLength(1);

      // The seed entry is the provider-visible carrier: its content names the
      // spec graph state and the grounding-floor gaps; details still carry the
      // watermark payload for the projection.
      const seed = seeds[0] as { content?: unknown; data: unknown };
      expect(seed.data).toEqual({ specId, snapshotLsn: expect.any(Number) });
      const seedContent = typeof seed.content === 'string' ? seed.content : '';
      expect(seedContent).toContain(`spec ${specId}`);
      expect(seedContent).toContain('Open elicitation gaps');

      // pi's own context builder surfaces the seeded overview + a real
      // top-ranked gap question in the LLM context the opening turn runs
      // against (lifecycle is owned by the origination-kick-live oracle).
      const llmContext = buildSessionContext(entries as never);
      const contextText = JSON.stringify(llmContext.messages);
      expect(contextText).toContain('Context seeded for spec');
      expect(contextText).toContain('Open elicitation gaps');
      const rankedQuestions = gaps.filter((gap) => !gap.answered && gap.disposition === 'open');
      expect(rankedQuestions.some((gap) => contextText.includes(gap.question))).toBe(true);
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('resume kick uses the pre-reconcile tail so a user tail still earns a kick after continuity notices', async () => {
    const faux = createTier2FauxAgentServices();
    try {
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
    } finally {
      faux.unregister();
    }
  });

  it('request_* and system leaves stay idle on resume', async () => {
    const faux = createTier2FauxAgentServices();
    try {
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
    } finally {
      faux.unregister();
    }
  });

  it('crash-after-notice-before-provider still kicks when the underlying debt is unanswered', async () => {
    // Reconciler-inserted seed/notices landed, then the process died before the
    // provider call; reboot must still answer the user's unresolved debt and
    // must not duplicate the already-written seed.
    const faux = createTier2FauxAgentServices();
    try {
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
    } finally {
      faux.unregister();
    }
  });

  it('trailing side-task or reviewer drains are continuity-only and do not manufacture or mask debt', async () => {
    const faux = createTier2FauxAgentServices();
    try {
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
    } finally {
      faux.unregister();
    }
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

async function readSessionContextDetails(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}) {
  const tool = session.getToolDefinition('read_session_context');
  if (!tool) throw new Error('read_session_context tool is not registered');
  const result = await tool.execute('boot-session-context', {}, undefined, undefined, {
    sessionManager: session.sessionManager,
  } as never);
  return result.details;
}

async function readSessionContextSpecId(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}): Promise<number> {
  const details = await readSessionContextDetails(session);
  if (!isRecord(details) || typeof details.specId !== 'number') {
    throw new Error('read_session_context did not return a numeric specId');
  }
  return details.specId;
}

async function executeReadGraph(
  session: { getToolDefinition(name: string): ToolDefinition | undefined; sessionManager: unknown },
  params: Record<string, unknown>,
): Promise<unknown> {
  const tool = session.getToolDefinition('read_graph');
  if (!tool) throw new Error('read_graph tool is not registered');
  return tool.execute('tier-2-read-graph', params, undefined, undefined, {
    sessionManager: session.sessionManager,
  } as never);
}

function messagesByRole(entries: readonly unknown[], role: string): readonly Record<string, unknown>[] {
  return entries.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const message = (entry as { message?: unknown }).message;
    if (typeof message !== 'object' || message === null) return [];
    return (message as { role?: unknown }).role === role ? [message as Record<string, unknown>] : [];
  });
}

function expectProviderLegalToolPairs(messages: readonly unknown[]): void {
  const seenToolCallIds = new Set<string>();
  for (const message of messages) {
    if (!isRecord(message)) continue;
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isRecord(block) && block.type === 'toolCall' && typeof block.id === 'string') {
          expect(block.id).toMatch(/^[a-zA-Z0-9_-]+$/);
          seenToolCallIds.add(block.id);
        }
      }
    }
    if (message.role === 'toolResult' && typeof message.toolCallId === 'string') {
      expect(message.toolCallId).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(seenToolCallIds.has(message.toolCallId)).toBe(true);
    }
  }
}

function presentToolResults(entries: readonly unknown[]): readonly Record<string, unknown>[] {
  return messagesByRole(entries, 'toolResult').filter(
    (message) => typeof message.toolName === 'string' && message.toolName.startsWith('present_'),
  );
}

function userMessages(entries: readonly unknown[]): readonly Record<string, unknown>[] {
  return messagesByRole(entries, 'user');
}

/**
 * A request_* tool result exactly as the exchanges extension writes it: the
 * details envelope comes from the real projection (answered/cancelled/
 * unavailable key presence), not a hand-built status field — this fixture IS
 * the test of the resume-debt classifier's envelope reading.
 */
function requestChoicesResultMessage(status: 'answered' | 'cancelled' | 'unavailable') {
  const details = projectRequestChoices({
    exchangeId: 'ex-resume-1',
    status,
    ...(status === 'answered'
      ? { choices: [{ id: 'choice-1', label: 'Choice 1', kind: 'listed' as const }] }
      : {}),
    ...(status === 'unavailable' ? { message: 'request_choices unavailable' } : {}),
  });
  return {
    role: 'toolResult' as const,
    toolCallId: 'ex-resume-1__request_choices',
    toolName: 'request_choices',
    content: [{ type: 'text' as const, text: `request_choices ${status}` }],
    details,
    isError: false as const,
    timestamp: 0 as const,
  };
}

/**
 * Continuity entries by customType, payload-normalized: ledger entries carry
 * `data`, provider-visible message entries carry `details` (carrier migration,
 * FE-857 card 1). Assertions read the normalized `data` regardless of carrier.
 */
function customEntries(entries: readonly unknown[], customType: string): ReadonlyArray<{ data: unknown }> {
  return entries
    .filter(
      (entry): entry is { customType: string; data?: unknown; details?: unknown } =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as { customType?: unknown }).customType === customType,
    )
    .map((entry) => ({ ...entry, data: entry.data ?? entry.details }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readWorkspaceContextMarkdownFiles(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}): Promise<string[]> {
  const tool = session.getToolDefinition('read_workspace_context');
  if (!tool) throw new Error('read_workspace_context tool is not registered');
  const result = (await tool.execute(
    'boot-workspace-context',
    { mode: 'cwd_inventory' },
    undefined,
    undefined,
    { sessionManager: session.sessionManager } as never,
  )) as { details: { markdownFiles: Array<{ path: string }> } };
  return result.details.markdownFiles.map((file) => file.path);
}
