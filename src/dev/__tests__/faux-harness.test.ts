import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { DefaultResourceLoader } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  BRUNCH_SESSION_QUERY_TOOL,
  chromeStateForWorkspace,
  createBrunchPiExtensions,
  createInMemoryBrunchIntrospectionStore,
} from '../../app/pi-extensions.js';
import { createBrunchPiSettings } from '../../app/pi-settings.js';
import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  BRUNCH_FAUX_HARNESS_ENV_API_KEY,
  brunchFauxProviderConfig,
  createBrunchFauxHarness,
  defaultBrunchFauxModel,
} from '../index.js';

describe('createBrunchFauxHarness', () => {
  it('boots an in-memory AgentSession over a registered faux provider without mutating process env', async () => {
    const previousApiKey = process.env.BRUNCH_FAUX_HARNESS_API_KEY;
    delete process.env.BRUNCH_FAUX_HARNESS_API_KEY;
    const harness = await createBrunchFauxHarness({
      responses: [fauxAssistantMessage('factory boot complete')],
    });

    try {
      expect(harness.session.model?.provider).toBe(harness.model.provider);
      expect(harness.session.model?.id).toBe(harness.model.modelId);
      expect(harness.session.sessionFile).toBeUndefined();
      expect(harness.session.getActiveToolNames()).toEqual([]);
      expect(harness.provider.getPendingResponseCount()).toBe(1);
      expect(harness.providerContexts).toEqual([]);
      expect(process.env.BRUNCH_FAUX_HARNESS_API_KEY).toBeUndefined();
    } finally {
      harness.dispose();
      if (previousApiKey === undefined) {
        delete process.env.BRUNCH_FAUX_HARNESS_API_KEY;
      } else {
        process.env.BRUNCH_FAUX_HARNESS_API_KEY = previousApiKey;
      }
    }
  });

  it('captures provider contexts and active tools as a Tier-1 faux-session oracle', async () => {
    const harness = await createBrunchFauxHarness({
      responses: [fauxAssistantMessage('captured')],
      customTools: [
        {
          name: 'probe_tool',
          label: 'Probe tool',
          description: 'Probe tool',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          execute: async () => ({
            content: [{ type: 'text', text: 'ok' }],
            details: { ok: true },
            isError: false,
          }),
        },
      ],
    });

    try {
      await harness.session.prompt('capture this', { expandPromptTemplates: false, source: 'rpc' });

      expect(harness.providerContexts).toHaveLength(1);
      expect(harness.providerContexts[0]?.activeToolNames).toEqual(['probe_tool']);
      expect(JSON.stringify(harness.providerContexts[0]?.messages)).toContain('capture this');
    } finally {
      harness.dispose();
    }
  });

  it('captures Brunch-composed provider payloads through the Tier-1 faux-session seam', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tier-1-faux-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-tier-1-agent-'));
    const store = createInMemoryBrunchIntrospectionStore();
    const profile = createBrunchPiSettings({
      cwd,
      agentDir,
      extensionFactories: [
        createBrunchPiExtensions(
          chromeStateForWorkspace(
            {
              status: 'ready',
              cwd,
              spec: { id: 1, title: 'Tier-1 faux spec' },
              session: { id: 'session-1', file: join(cwd, 'session.jsonl'), manager: {} as never },
              chrome: {
                cwd,
                spec: { id: 1, title: 'Tier-1 faux spec' },
              },
            },
            {},
          ),
          undefined,
          {
            coordinator: {} as never,
            graphMentionSource: { listMentionCandidates: () => [] },
            promptContext: () => ({
              spec: { id: 1, name: 'Tier-1 faux spec' },
              workspace: { cwd },
              session: { id: 'session-1', label: 'Tier-1 session' },
              graphReads: {
                queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }),
                getNodes: () => [],
                resolveNodeCode: () => undefined,
                getElicitationGaps: () =>
                  (['context', 'thesis', 'goal', 'constraint'] as const).map((kind) => ({
                    id: `${kind}:test`,
                    specId: 1,
                    refersTo: kind,
                    question: `${kind}?`,
                    rationale: `${kind} rationale`,
                    basis: 'explicit' as const,
                    band: 'grounding' as const,
                    predicate: { kind: 'presence' as const, nodeKind: kind, minimum: 1 },
                    importance: 1,
                    coverage: 1,
                    answered: true,
                    disposition: 'answered' as const,
                    createdAtLsn: 1,
                  })),
                getOpenReconciliationNeeds: () => [],
                latestLsn: () => 1,
              },
            }),
            introspection: { queryTools: true, store },
          },
        ),
      ],
    });
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager: profile.settingsManager,
      ...profile.resourceLoaderOptions,
    });
    await resourceLoader.reload();
    const harness = await createBrunchFauxHarness({
      cwd,
      responses: [fauxAssistantMessage('captured brunch payload')],
      resourceLoader,
      settingsManager: profile.settingsManager,
    });

    try {
      await harness.session.prompt('capture the real Brunch payload', {
        expandPromptTemplates: false,
        source: 'rpc',
      });

      const systemPrompt = harness.providerContexts[0]?.systemPrompt;
      const activeToolsLine = systemPrompt?.split('\n').find((line) => line.startsWith('- active tools:'));
      expect(harness.providerContexts).toHaveLength(1);
      expect(systemPrompt).toContain('[Brunch live elicitor control]');
      expect(systemPrompt).toContain(
        '- prompt resources: code-owned live skill list only; no runtime axis negotiation',
      );
      expect(systemPrompt).toContain('<brunch-skills>');
      expect(activeToolsLine).toContain('read');
      expect(activeToolsLine).toContain('grep');
      expect(activeToolsLine).toContain('find');
      expect(activeToolsLine).toContain('ls');
      expect(activeToolsLine).toContain(BRUNCH_SESSION_QUERY_TOOL);
      expect(activeToolsLine).toContain(BRUNCH_INTROSPECT_QUERY_TOOL);
      expect(activeToolsLine).not.toContain('bash');
      expect(activeToolsLine).not.toContain('edit');
      expect(activeToolsLine).not.toContain('write');
      expect(JSON.stringify(harness.providerContexts[0]?.messages)).toContain(
        'capture the real Brunch payload',
      );
    } finally {
      harness.dispose();
      await Promise.all([
        rm(cwd, { recursive: true, force: true }),
        rm(agentDir, { recursive: true, force: true }),
      ]);
    }
  });

  it('uses the literal dev key for the in-process provider config by default', () => {
    expect(brunchFauxProviderConfig(defaultBrunchFauxModel()).apiKey).toBe(BRUNCH_FAUX_HARNESS_API_KEY);
  });

  it('uses the pi 0.79 $ENV api-key form only when a subprocess call site asks for it', () => {
    expect(
      brunchFauxProviderConfig(defaultBrunchFauxModel(), undefined, BRUNCH_FAUX_HARNESS_ENV_API_KEY).apiKey,
    ).toBe('$BRUNCH_FAUX_HARNESS_API_KEY');
  });
});
