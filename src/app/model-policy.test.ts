import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AuthStorage,
  createAgentSessionFromServices,
  createAgentSessionServices,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BRUNCH_MODEL_ALLOWLIST,
  createBrunchModelRegistry,
  getBrunchNoAuthGuidanceCopy,
  getBrunchScopedModels,
  resolveBrunchModelPolicy,
} from './model-policy.js';

function registryWithAuth(auth: Record<string, { type: 'api_key'; key: string }>) {
  return createBrunchModelRegistry(ModelRegistry.inMemory(AuthStorage.inMemory(auth)));
}

describe('Brunch model policy', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    vi.stubEnv('OPENROUTER_API_KEY', undefined);
    vi.stubEnv('OPENAI_API_KEY', undefined);
  });

  it('falls through to the first allowlisted entry with configured auth', () => {
    const registry = registryWithAuth({ openrouter: { type: 'api_key', key: 'or-key' } });

    expect(resolveBrunchModelPolicy(registry)).toMatchObject({
      status: 'resolved',
      entry: BRUNCH_MODEL_ALLOWLIST[1],
      model: { provider: 'openrouter', id: 'anthropic/claude-sonnet-4.6' },
      thinkingLevel: 'low',
    });
  });

  it('chooses the earliest allowlisted entry when multiple providers have auth', () => {
    const registry = registryWithAuth({
      anthropic: { type: 'api_key', key: 'anthropic-key' },
      openrouter: { type: 'api_key', key: 'or-key' },
    });

    expect(resolveBrunchModelPolicy(registry)).toMatchObject({
      status: 'resolved',
      entry: BRUNCH_MODEL_ALLOWLIST[0],
      model: { provider: 'anthropic', id: 'claude-sonnet-4-6' },
    });
  });

  it('preserves the underlying registry instance so unwrapped methods keep their receiver identity', () => {
    const baseRegistry = ModelRegistry.inMemory(AuthStorage.inMemory({}));

    const registry = createBrunchModelRegistry(baseRegistry);

    expect(registry).toBe(baseRegistry);
  });

  it('contains the registry to allowlisted models even with auth for other providers', () => {
    const registry = registryWithAuth({
      anthropic: { type: 'api_key', key: 'anthropic-key' },
      openrouter: { type: 'api_key', key: 'or-key' },
      openai: { type: 'api_key', key: 'openai-key' },
    });

    const available = registry.getAvailable();

    expect(available.length).toBe(BRUNCH_MODEL_ALLOWLIST.length);
    expect(available.map((model) => `${model.provider}/${model.id}`)).toEqual(
      BRUNCH_MODEL_ALLOWLIST.map((entry) => `${entry.provider}/${entry.model}`),
    );
    expect(registry.find('openai', 'gpt-5.5')).toBeUndefined();
  });

  it('is empty and unresolved when no allowlisted auth is configured', () => {
    const registry = registryWithAuth({ openai: { type: 'api_key', key: 'openai-key' } });

    expect(registry.getAvailable()).toEqual([]);
    expect(resolveBrunchModelPolicy(registry)).toEqual({
      status: 'unresolved',
      reason: 'No configured auth for Brunch allowlisted models',
    });
  });

  it('treats stored OAuth credentials as configured auth', () => {
    const registry = createBrunchModelRegistry(
      ModelRegistry.inMemory(
        AuthStorage.inMemory({
          anthropic: {
            type: 'oauth',
            access: 'access',
            refresh: 'refresh',
            expires: Date.now() + 60_000,
          },
        }),
      ),
    );

    expect(resolveBrunchModelPolicy(registry)).toMatchObject({
      status: 'resolved',
      model: { provider: 'anthropic', id: 'claude-sonnet-4-6' },
    });
  });

  it('formats short no-auth guidance without exposing model policy internals', () => {
    const copy = getBrunchNoAuthGuidanceCopy();

    expect(copy.title).toContain('No model auth');
    expect(copy.body).toContain('/login');
    expect(copy.body).toContain('brunch login');
    for (const entry of BRUNCH_MODEL_ALLOWLIST) {
      expect(copy.body).not.toContain(entry.displayName);
      expect(copy.body).not.toContain(entry.model);
    }
    expect(copy.lines.join('\n')).not.toContain('allowlist');
  });

  it('boots a Pi session on the resolved allowlisted model and scoped cycle list', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-model-policy-'));
    const authStorage = AuthStorage.inMemory({
      anthropic: { type: 'api_key', key: 'anthropic-key' },
      openrouter: { type: 'api_key', key: 'or-key' },
    });
    const registry = createBrunchModelRegistry(ModelRegistry.inMemory(authStorage));
    const resolution = resolveBrunchModelPolicy(registry);
    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;

    const services = await createAgentSessionServices({
      cwd,
      authStorage,
      modelRegistry: registry,
      settingsManager: SettingsManager.inMemory({}),
    });
    const { session } = await createAgentSessionFromServices({
      services,
      sessionManager: SessionManager.inMemory(cwd),
      model: resolution.model,
      thinkingLevel: resolution.thinkingLevel,
      scopedModels: getBrunchScopedModels(registry),
      noTools: 'all',
    });

    expect(session.model).toMatchObject({ provider: 'anthropic', id: 'claude-sonnet-4-6' });
    expect(session.thinkingLevel).toBe('low');
    await expect(session.cycleModel()).resolves.toMatchObject({
      isScoped: true,
      model: { provider: 'openrouter', id: 'anthropic/claude-sonnet-4.6' },
      thinkingLevel: 'low',
    });
    session.dispose();
  });

  it('boots Pi services without a model when no allowlisted auth resolves', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-model-policy-empty-'));
    const authStorage = AuthStorage.inMemory({});
    const registry = createBrunchModelRegistry(ModelRegistry.inMemory(authStorage));

    const services = await createAgentSessionServices({
      cwd,
      authStorage,
      modelRegistry: registry,
      settingsManager: SettingsManager.inMemory({}),
    });
    const { session } = await createAgentSessionFromServices({
      services,
      sessionManager: SessionManager.inMemory(cwd),
      thinkingLevel: 'low',
      scopedModels: getBrunchScopedModels(registry),
      noTools: 'all',
    });

    expect(registry.getAvailable()).toEqual([]);
    expect(session.model).toMatchObject({ provider: 'unknown', id: 'unknown' });
    session.dispose();
  });
});
