import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Interface } from 'node:readline';
import { PassThrough, Readable } from 'node:stream';

import type { OAuthLoginCallbacks, OAuthProviderInterface } from '@earendil-works/pi-ai/compat';
import { AuthStorage, ModelRegistry, type AuthCredential } from '@earendil-works/pi-coding-agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runBrunchLogin, type BrunchLoginAuthStorage } from '../brunch-login.js';
import { runBrunchCli } from '../brunch.js';
import { createBrunchModelRegistry } from '../model-policy.js';

function stdinFrom(text: string): Readable {
  return Readable.from([text]);
}

function collectStream(stream: PassThrough): string[] {
  const chunks: string[] = [];
  stream.on('data', (chunk) => chunks.push(String(chunk)));
  return chunks;
}

function registryFor(authStorage: AuthStorage): ModelRegistry {
  return createBrunchModelRegistry(ModelRegistry.inMemory(authStorage));
}

class FakeOAuthAuthStorage implements BrunchLoginAuthStorage {
  readonly credentials = new Map<string, AuthCredential>();
  readonly callbacks: OAuthLoginCallbacks[] = [];

  getOAuthProviders(): OAuthProviderInterface[] {
    return [
      {
        id: 'anthropic',
        name: 'Anthropic Test OAuth',
        usesCallbackServer: true,
        async login() {
          throw new Error('runBrunchLogin should call authStorage.login, not provider.login directly');
        },
        async refreshToken(credentials) {
          return credentials;
        },
        getApiKey(credentials) {
          return credentials.access;
        },
      },
    ];
  }

  set(provider: string, credential: AuthCredential): void {
    this.credentials.set(provider, credential);
  }

  async login(provider: string, callbacks: OAuthLoginCallbacks): Promise<void> {
    this.callbacks.push(callbacks);
    callbacks.onAuth({ url: 'https://auth.example/start', instructions: 'Paste the final redirect URL.' });
    const redirectUrl = await callbacks.onPrompt({ message: 'Redirect URL' });
    this.set(provider, {
      type: 'oauth',
      access: redirectUrl,
      refresh: 'refresh-token',
      expires: Date.now() + 60_000,
    });
  }
}

describe('brunch login', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    vi.stubEnv('OPENROUTER_API_KEY', undefined);
    vi.stubEnv('OPENAI_API_KEY', undefined);
  });

  it('lists allowlisted providers in policy order and persists an API key without deleting other credentials', async () => {
    const authStorage = AuthStorage.inMemory({ openai: { type: 'api_key', key: 'keep-me' } });
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);

    const code = await runBrunchLogin({
      stdin: stdinFrom('2\nor-key\n'),
      stdout,
      authStorage,
      modelRegistry: registryFor(authStorage),
    });

    expect(code).toBe(0);
    expect(authStorage.get('openrouter')).toEqual({ type: 'api_key', key: 'or-key' });
    expect(authStorage.get('openai')).toEqual({ type: 'api_key', key: 'keep-me' });
    expect(chunks.join('')).toContain('1) Anthropic — Claude Sonnet 4.6 (Anthropic)');
    expect(chunks.join('')).toContain('2) OpenRouter — Claude Sonnet 4.6 (OpenRouter)');
    expect(chunks.join('')).toContain('API key (input hidden; or q to cancel)');
    expect(chunks.join('')).not.toContain('or-key');
    expect(chunks.join('')).toContain('Brunch will use Claude Sonnet 4.6 (OpenRouter)');
  });

  it('runs OAuth through CLI callbacks and persists the returned OAuth credentials', async () => {
    const authStorage = new FakeOAuthAuthStorage();
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);

    const code = await runBrunchLogin({
      stdin: stdinFrom('1\n1\nhttps://callback.example/done\n'),
      stdout,
      openUrl: () => {},
      authStorage,
      modelRegistry: {
        find: () => ({ provider: 'anthropic', id: 'claude-sonnet-4-6' }),
        hasConfiguredAuth: () => true,
      } as unknown as ModelRegistry,
    });

    expect(code).toBe(0);
    expect(authStorage.credentials.get('anthropic')).toMatchObject({
      type: 'oauth',
      access: 'https://callback.example/done',
    });
    expect(authStorage.callbacks).toHaveLength(1);
    expect(chunks.join('')).toContain('https://auth.example/start');
    expect(chunks.join('')).toContain('Redirect URL');
  });

  it('routes the login subcommand before workspace mode dispatch and writes Pi auth.json under PI_CODING_AGENT_DIR', async () => {
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-login-agent-'));
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);
    vi.stubEnv('PI_CODING_AGENT_DIR', agentDir);

    const code = await runBrunchCli({
      argv: ['login'],
      stdin: stdinFrom('2\nor-key\n'),
      stdout,
      coordinator: {
        async openDefaultWorkspace() {
          throw new Error('login must not open a Brunch workspace');
        },
      } as never,
    });

    const authJson = JSON.parse(await readFile(join(agentDir, 'auth.json'), 'utf8')) as unknown;
    expect(code).toBe(0);
    expect(authJson).toMatchObject({ openrouter: { type: 'api_key', key: 'or-key' } });
    expect(chunks.join('')).toContain('Brunch will use Claude Sonnet 4.6 (OpenRouter)');
  });

  it('fails closed before consuming or persisting a TTY secret when masking is unavailable', async () => {
    const authStorage = AuthStorage.inMemory({});
    const stdin = stdinFrom('2\nsecret-that-must-not-be-consumed\n');
    Object.defineProperty(stdin, 'isTTY', { value: true });
    const stdout = new PassThrough();
    Object.defineProperty(stdout, 'isTTY', { value: true });
    const chunks = collectStream(stdout);
    const maskablePrototype = Interface.prototype as Interface & {
      _writeToOutput?: (text: string) => void;
    };
    const originalWriteToOutput = maskablePrototype._writeToOutput;
    delete maskablePrototype._writeToOutput;

    try {
      const code = await runBrunchLogin({
        stdin,
        stdout,
        authStorage,
        modelRegistry: registryFor(authStorage),
      });

      expect(code).toBe(1);
      expect(authStorage.get('openrouter')).toBeUndefined();
      expect(chunks.join('')).toContain('Cannot safely hide API key input');
      expect(chunks.join('')).not.toContain('secret-that-must-not-be-consumed');
    } finally {
      Object.defineProperty(Interface.prototype, '_writeToOutput', {
        configurable: true,
        value: originalWriteToOutput,
        writable: true,
      });
    }
  });

  it('returns nonzero with a readable message when the user cancels', async () => {
    const authStorage = AuthStorage.inMemory({});
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);

    const code = await runBrunchLogin({
      stdin: stdinFrom('q\n'),
      stdout,
      authStorage,
      modelRegistry: registryFor(authStorage),
    });

    expect(code).toBe(1);
    expect(chunks.join('')).toContain('Login cancelled');
  });

  it('prints usage for login help without launching the app', async () => {
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);

    const code = await runBrunchCli({
      argv: ['login', '--help'],
      stdout,
      coordinator: {
        async openDefaultWorkspace() {
          throw new Error('login help must not open a Brunch workspace');
        },
      } as never,
    });

    expect(code).toBe(0);
    expect(chunks.join('')).toContain('Usage: brunch login');
  });
});
