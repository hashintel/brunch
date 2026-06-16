/**
 * Kick/boot-path suites over the tier-2 real-boot harness: origination-kick-live,
 * the FE-847 real boot harness, and FE-844/FE-847 live gap legality. The
 * coverage-first scaffold suites (I45/I46/I47) live in tier-2-scaffold.test.ts.
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { openWorkspaceGraphRuntime } from '../../graph/index.js';
import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import { projectBrunchAgentState } from '../../projections/session/runtime-state.js';
import { BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE } from '../../session/runtime-state.js';
import {
  bootTier2ProductOriginatedTurn,
  bootTier2RuntimeFromFixture,
  bootTier2RuntimeThroughRunBrunchTui,
  rebootTier2Runtime,
  resumeTier2Fixture,
  runTier2RealBootFauxTurn,
  withTier2FauxAgentServices,
} from '../tier-2-harness.js';
import {
  customEntries,
  expectNoKick,
  expectProviderLegalToolPairs,
  messagesByRole,
  presentToolResults,
  readSessionContextDetails,
  readSessionContextSpecId,
  readWorkspaceContextMarkdownFiles,
  userMessages,
  waitForKick,
} from './support/tier-2-test-support.js';

async function readOriginationDebug(cwd: string, expected: string): Promise<string> {
  const deadline = Date.now() + 2000;
  let text = '';
  while (Date.now() <= deadline) {
    try {
      text = await readFile(`${cwd}/.brunch/debug/origination.md`, 'utf8');
      if (text.includes(expected)) return text;
    } catch {
      // File may not exist until the fire-and-forget debug append finishes.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `Timed out waiting for origination debug record containing ${expected}. Last text: ${text}`,
  );
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

  it('picker path parity: continue an existing spec into a new session also kicks, with the full graph overview in the payload', async () => {
    const boot = await bootTier2ProductOriginatedTurn({
      activation: 'pickerNewSession',
      seedGraph: (executor, specId) => {
        const result = executor.mutateGraph({
          specId,
          createBasis: 'explicit',
          ops: [
            { op: 'create_node', ref: 'g', plane: 'intent', kind: 'goal', title: 'Orient the user' },
            { op: 'create_node', ref: 'c', plane: 'intent', kind: 'context', title: 'Multi-spec workspace' },
            { op: 'create_edge', category: 'support', support: 'c', claim: 'g', stance: 'for' },
          ],
        });
        if (result.status !== 'success') throw new Error('Tier-2 graph seed failed');
      },
    });
    try {
      expect(boot.providerContexts.length).toBeGreaterThan(0);
      const entries = boot.runtime.session.sessionManager.getEntries();
      expect(presentToolResults(entries)).toHaveLength(0);
      expect(userMessages(entries)).toHaveLength(0);

      // D78-L revised: the seed carries the FULL graph overview — node codes,
      // titles, and edges — plus a workspace section, so the opening turn
      // needs no read tool call.
      const contextText = JSON.stringify(boot.providerContexts[0]!.messages);
      expect(contextText).toContain('[G1]');
      expect(contextText).toContain('Orient the user');
      expect(contextText).toContain('[CTX1]');
      expect(contextText).toContain('support (for)');
      expect(contextText).toContain('Workspace');
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

  it('records the origination decision and outcome for new-session, resume, idle, and no-model boots', async () => {
    const newSession = await bootTier2ProductOriginatedTurn({ dev: true });
    try {
      const debug = await readOriginationDebug(newSession.cwd, '"status": "fired"');
      expect(debug).toContain('"action": "start"');
      expect(debug).toContain('"origin": "new_session"');
    } finally {
      await newSession.dispose();
    }

    await withTier2FauxAgentServices(async (faux) => {
      const resumeDebt = await bootTier2RuntimeFromFixture({
        dev: true,
        agentServices: faux.agentServices,
        fixtureEntries: () => [{ type: 'message', message: userMessage('Resume with an answer.') }],
      });
      try {
        await waitForKick(resumeDebt.runtime);
        const debug = await readOriginationDebug(resumeDebt.cwd, '"status": "fired"');
        expect(debug).toContain('"origin": "resume_debt"');
      } finally {
        await resumeDebt.runtime.dispose();
        resumeDebt.restoreEnv();
      }

      const noDebt = await bootTier2RuntimeFromFixture({
        dev: true,
        agentServices: faux.agentServices,
        fixtureEntries: () => [
          { type: 'message', message: userMessage('Earlier question') },
          { type: 'message', message: assistantMessage('Already answered.') },
        ],
      });
      try {
        await expectNoKick(noDebt.runtime);
        const debug = await readOriginationDebug(noDebt.cwd, '"reason": "idle_no_unresolved_debt"');
        expect(debug).toContain('"reason": "no_unresolved_debt"');
      } finally {
        await noDebt.runtime.dispose();
        noDebt.restoreEnv();
      }
    });

    const noModel = await bootTier2RuntimeThroughRunBrunchTui({ dev: true });
    try {
      const debug = await readOriginationDebug(noModel.cwd, '"reason": "no_model_available"');
      expect(debug).toContain('"action": "start"');
      expect(debug).toContain('"origin": "new_session"');
    } finally {
      await noModel.runtime.dispose();
      noModel.restoreEnv();
    }
  });

  it('records explicit freestyle as an idle origination reason', async () => {
    await withTier2FauxAgentServices(async (faux) => {
      const boot = await bootTier2RuntimeFromFixture({
        dev: true,
        agentServices: faux.agentServices,
        fixtureEntries: () => [
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
                agentGoal: 'grounding-advance',
              },
            },
          },
          { type: 'message', message: userMessage('Let me type freely first.') },
        ],
      });
      try {
        await expectNoKick(boot.runtime);
        const debug = await readOriginationDebug(boot.cwd, '"reason": "idle_explicit_freestyle"');
        expect(debug).toContain('"reason": "explicit_freestyle"');
      } finally {
        await boot.runtime.dispose();
        boot.restoreEnv();
      }
    });
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
