import { spawn } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import type { OAuthLoginCallbacks, OAuthProviderInterface } from '@earendil-works/pi-ai/compat';
import {
  AuthStorage,
  getAgentDir,
  ModelRegistry,
  type AuthCredential,
} from '@earendil-works/pi-coding-agent';

import {
  BRUNCH_MODEL_ALLOWLIST,
  createBrunchModelRegistry,
  resolveBrunchModelPolicy,
} from './model-policy.js';

export interface BrunchLoginAuthStorage {
  getOAuthProviders(): OAuthProviderInterface[];
  set(provider: string, credential: AuthCredential): void;
  login(provider: string, callbacks: OAuthLoginCallbacks): Promise<void>;
}

export interface BrunchLoginOptions {
  stdin?: Readable | undefined;
  stdout?: Writable | ((chunk: string) => void) | undefined;
  stderr?: Writable | ((chunk: string) => void) | undefined;
  authStorage?: BrunchLoginAuthStorage | undefined;
  modelRegistry?: ModelRegistry | undefined;
  openUrl?: ((url: string) => void) | undefined;
}

type ProviderChoice = {
  readonly provider: string;
  readonly providerName: string;
  readonly displayName: string;
  readonly oauthProvider?: OAuthProviderInterface | undefined;
};

type AuthMethod = 'oauth' | 'api_key';

class BrunchLoginAbort extends Error {
  constructor(message = 'Login cancelled') {
    super(message);
  }
}

export function formatBrunchLoginUsage(): string {
  return `Usage: brunch login\n\nConfigure provider auth for Brunch's allowlisted models.\n`;
}

export async function runBrunchLogin(options: BrunchLoginOptions = {}): Promise<number> {
  const defaultAuthStorage = options.authStorage
    ? undefined
    : AuthStorage.create(join(getAgentDir(), 'auth.json'));
  const authStorage = options.authStorage ?? defaultAuthStorage!;
  if (!options.modelRegistry && !defaultAuthStorage) {
    throw new Error('runBrunchLogin requires modelRegistry when authStorage is injected');
  }
  const modelRegistry =
    // inMemory, not create(): the exit report must resolve exactly like a session boot,
    // which seals out ambient ~/.pi/agent/models.json (D39-L; see model-policy.ts).
    options.modelRegistry ?? createBrunchModelRegistry(ModelRegistry.inMemory(defaultAuthStorage!));
  const session = createLineSession(options.stdin ?? process.stdin, options.stdout);

  try {
    const providers = buildProviderChoices(authStorage.getOAuthProviders());
    writeLine(options.stdout, 'Configure auth for a Brunch allowlisted provider:');
    writeLine(options.stdout, '');
    providers.forEach((provider, index) => {
      writeLine(options.stdout, `${index + 1}) ${provider.providerName} — ${provider.displayName}`);
    });
    writeLine(options.stdout, '');

    const provider = await chooseProvider(session, providers);
    const method = await chooseAuthMethod(session, provider);

    if (method === 'oauth') {
      await runOAuthLogin({
        authStorage,
        provider,
        session,
        stdout: options.stdout,
        openUrl: options.openUrl,
      });
    } else {
      await runApiKeyLogin({ authStorage, provider, session, stdout: options.stdout });
    }

    reportResolvedPolicy(modelRegistry, options.stdout);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeLine(options.stderr ?? options.stdout, message);
    return 1;
  } finally {
    session.close();
  }
}

function buildProviderChoices(oauthProviders: readonly OAuthProviderInterface[]): ProviderChoice[] {
  const oauthById = new Map(oauthProviders.map((provider) => [provider.id, provider]));
  const seen = new Set<string>();
  const choices: ProviderChoice[] = [];

  for (const entry of BRUNCH_MODEL_ALLOWLIST) {
    if (seen.has(entry.provider)) continue;
    seen.add(entry.provider);
    choices.push({
      provider: entry.provider,
      providerName: formatProviderName(entry.provider),
      displayName: entry.displayName,
      oauthProvider: oauthById.get(entry.provider),
    });
  }

  return choices;
}

function formatProviderName(provider: string): string {
  if (provider === 'openrouter') return 'OpenRouter';
  return provider
    .split(/[-_]/u)
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
}

async function chooseProvider(
  session: LineSession,
  providers: readonly ProviderChoice[],
): Promise<ProviderChoice> {
  const choice = await session.ask('Provider number (or q to cancel): ');
  if (choice.toLowerCase() === 'q') throw new BrunchLoginAbort();
  const index = Number.parseInt(choice, 10) - 1;
  const provider = providers[index];
  if (!provider) throw new Error(`Invalid provider choice: ${choice}`);
  return provider;
}

async function chooseAuthMethod(session: LineSession, provider: ProviderChoice): Promise<AuthMethod> {
  if (!provider.oauthProvider) return 'api_key';

  writeLine(session.stdout, '');
  writeLine(session.stdout, `Configure ${provider.providerName}:`);
  writeLine(session.stdout, `1) OAuth (${provider.oauthProvider.name})`);
  writeLine(session.stdout, '2) API key');
  const choice = await session.ask('Auth method number (or q to cancel): ');
  if (choice.toLowerCase() === 'q') throw new BrunchLoginAbort();
  if (choice === '1') return 'oauth';
  if (choice === '2') return 'api_key';
  throw new Error(`Invalid auth method choice: ${choice}`);
}

async function runApiKeyLogin(options: {
  authStorage: BrunchLoginAuthStorage;
  provider: ProviderChoice;
  session: LineSession;
  stdout?: Writable | ((chunk: string) => void) | undefined;
}): Promise<void> {
  writeLine(options.stdout, '');
  const key = await options.session.ask(`Paste ${options.provider.providerName} API key (or q to cancel): `);
  if (key.toLowerCase() === 'q' || key.trim() === '') throw new BrunchLoginAbort();
  options.authStorage.set(options.provider.provider, { type: 'api_key', key: key.trim() });
}

async function runOAuthLogin(options: {
  authStorage: BrunchLoginAuthStorage;
  provider: ProviderChoice;
  session: LineSession;
  stdout?: Writable | ((chunk: string) => void) | undefined;
  openUrl?: ((url: string) => void) | undefined;
}): Promise<void> {
  if (!options.provider.oauthProvider)
    throw new Error(`${options.provider.providerName} does not support OAuth login`);

  await options.authStorage.login(options.provider.provider, {
    onAuth: (info) => {
      writeLine(options.stdout, '');
      writeLine(options.stdout, `Open this URL to authenticate:\n${info.url}`);
      if (info.instructions) writeLine(options.stdout, info.instructions);
      (options.openUrl ?? openUrlBestEffort)(info.url);
    },
    onDeviceCode: (info) => {
      writeLine(options.stdout, '');
      writeLine(options.stdout, `Open ${info.verificationUri}`);
      writeLine(options.stdout, `Enter code: ${info.userCode}`);
    },
    onPrompt: async (prompt) => {
      while (true) {
        const value = await options.session.ask(`${prompt.message}: `);
        if (value.toLowerCase() === 'q') throw new BrunchLoginAbort();
        if (prompt.allowEmpty || value.trim() !== '') return value.trim();
        writeLine(options.stdout, 'A value is required.');
      }
    },
    onManualCodeInput: async () => {
      const value = await options.session.ask('Paste the redirect URL or code (or q to cancel): ');
      if (value.toLowerCase() === 'q' || value.trim() === '') throw new BrunchLoginAbort();
      return value.trim();
    },
    onProgress: (message) => writeLine(options.stdout, message),
    onSelect: async (prompt) => {
      writeLine(options.stdout, prompt.message);
      prompt.options.forEach((option, index) => writeLine(options.stdout, `${index + 1}) ${option.label}`));
      const choice = await options.session.ask('Choice number (or q to cancel): ');
      if (choice.toLowerCase() === 'q') throw new BrunchLoginAbort();
      const option = prompt.options[Number.parseInt(choice, 10) - 1];
      if (!option) throw new Error(`Invalid OAuth choice: ${choice}`);
      return option.id;
    },
  });
}

function reportResolvedPolicy(
  modelRegistry: ModelRegistry,
  stdout: Writable | ((chunk: string) => void) | undefined,
): void {
  const resolution = resolveBrunchModelPolicy(modelRegistry);
  writeLine(stdout, '');
  if (resolution.status === 'resolved') {
    writeLine(
      stdout,
      `Brunch will use ${resolution.entry.displayName} with ${resolution.thinkingLevel} thinking.`,
    );
  } else {
    writeLine(
      stdout,
      `Auth saved, but Brunch still cannot resolve an allowlisted model: ${resolution.reason}.`,
    );
  }
}

function openUrlBestEffort(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

type LineSession = {
  readonly stdout: Writable | ((chunk: string) => void) | undefined;
  ask(prompt: string): Promise<string>;
  close(): void;
};

function createLineSession(
  stdin: Readable,
  stdout: Writable | ((chunk: string) => void) | undefined,
): LineSession {
  const readline = createInterface({ input: stdin, terminal: false });
  const lines = readline[Symbol.asyncIterator]();

  return {
    stdout,
    async ask(prompt: string) {
      write(stdout, prompt);
      const next = await lines.next();
      if (next.done) throw new BrunchLoginAbort('Login cancelled before input was provided');
      return String(next.value).trim();
    },
    close() {
      readline.close();
    },
  };
}

function writeLine(stdout: Writable | ((chunk: string) => void) | undefined, line: string): void {
  write(stdout, `${line}\n`);
}

function write(stdout: Writable | ((chunk: string) => void) | undefined, chunk: string): void {
  if (!stdout) {
    process.stdout.write(chunk);
  } else if (typeof stdout === 'function') {
    stdout(chunk);
  } else {
    stdout.write(chunk);
  }
}
