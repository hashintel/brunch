import { spawn, type ChildProcess } from 'node:child_process';
import { access, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

import type { ProspectResearchWorkspaceOracleCheck } from './types.js';

const START_TIMEOUT_MS = 10_000;
const MAX_PROCESS_EVIDENCE_BYTES = 64 * 1024;

export interface ProspectJourneyEnvironment {
  readonly candidateRoot: string;
  readonly databasePath: string;
  readonly fixturePath: string;
  readonly evidence: ProspectResearchWorkspaceOracleCheck['evidence'][number][];
  readonly externalRuntimeRequests: string[];
  readonly cleanup: { processStopped: boolean; browserClosed: boolean };
  origin: string;
  page: Page;
  restart: () => Promise<void>;
  close: () => Promise<void>;
}

export async function openProspectJourneyEnvironment(input: {
  readonly candidateRoot: string;
  readonly fixtureSource: string;
}): Promise<ProspectJourneyEnvironment> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'brunch-prospect-oracle-'));
  const databasePath = join(temporaryRoot, 'workspace.sqlite');
  const fixturePath = join(temporaryRoot, 'research-fixture.json');
  await copyFile(input.fixtureSource, fixturePath);
  const evidence: ProspectResearchWorkspaceOracleCheck['evidence'][number][] = [];
  const externalRuntimeRequests: string[] = [];
  const cleanup = { processStopped: true, browserClosed: true };
  let candidate: ChildProcess | undefined;
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let origin = '';
  let closed = false;

  const stop = async (): Promise<void> => {
    if (context !== undefined) {
      try {
        await context.close();
      } finally {
        context = undefined;
      }
    }
    if (browser !== undefined) {
      try {
        await browser.close();
      } finally {
        browser = undefined;
        cleanup.browserClosed = true;
      }
    }
    if (candidate !== undefined) {
      cleanup.processStopped = await stopChild(candidate);
      candidate = undefined;
    }
  };

  const start = async (): Promise<void> => {
    const port = await availablePort();
    origin = `http://127.0.0.1:${port}`;
    const processChunks: string[] = [];
    cleanup.processStopped = false;
    evidence.push({
      source: 'process',
      detail: 'exact npm start launched with fresh PORT, DATABASE_PATH, and RESEARCH_FIXTURE_PATH',
    });
    candidate = spawn('npm', ['start'], {
      cwd: input.candidateRoot,
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_PATH: databasePath,
        RESEARCH_FIXTURE_PATH: fixturePath,
      },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const retainProcessChunk = (chunk: Buffer): void => {
      const retained = processChunks.join('').length;
      if (retained < MAX_PROCESS_EVIDENCE_BYTES) {
        processChunks.push(chunk.toString('utf8').slice(0, MAX_PROCESS_EVIDENCE_BYTES - retained));
      }
    };
    candidate.stdout?.on('data', retainProcessChunk);
    candidate.stderr?.on('data', retainProcessChunk);
    await waitForHealth(`${origin}/api/health`, candidate, processChunks);
    evidence.push({ source: 'http', detail: `GET /api/health returned ready on fresh PORT ${port}` });

    browser = await chromium.launch({ executablePath: await resolveChromeExecutable(), headless: true });
    cleanup.browserClosed = false;
    context = await browser.newContext({ acceptDownloads: true });
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin) {
        externalRuntimeRequests.push(url);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.goto(origin, { waitUntil: 'networkidle' });
  };

  try {
    await start();
  } catch (error) {
    await stop();
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }

  const environment: ProspectJourneyEnvironment = {
    candidateRoot: input.candidateRoot,
    databasePath,
    fixturePath,
    evidence,
    externalRuntimeRequests,
    cleanup,
    origin,
    page: page!,
    restart: async () => {
      await stop();
      await start();
      environment.origin = origin;
      environment.page = page!;
    },
    close: async () => {
      if (closed) return;
      closed = true;
      try {
        await stop();
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
      }
    },
  };
  return environment;
}

async function waitForHealth(url: string, child: ChildProcess, output: readonly string[]): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < START_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`npm start exited ${child.exitCode}: ${output.join('')}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) {
        const value = (await response.json()) as unknown;
        if (record(value) && value['status'] === 'ready') return;
      }
    } catch {
      // The exact public start command is still becoming ready.
    }
    await delay(50);
  }
  throw new Error(`npm start health timeout: ${output.join('')}`);
}

async function stopChild(child: ChildProcess): Promise<boolean> {
  if (child.exitCode !== null) return true;
  signalChildTree(child, 'SIGTERM');
  await Promise.race([onceExit(child), delay(2_000)]);
  if (child.exitCode === null) {
    signalChildTree(child, 'SIGKILL');
    await Promise.race([onceExit(child), delay(2_000)]);
  }
  return child.exitCode !== null || child.signalCode !== null;
}

function signalChildTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The detached process group may already be gone.
    }
  }
  child.kill(signal);
}

async function onceExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => child.once('exit', () => resolve()));
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('fresh PORT reservation failed');
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  return address.port;
}

async function resolveChromeExecutable(): Promise<string> {
  const candidates = [
    process.env['BRUNCH_CHROME_PATH'],
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ].filter((candidate): candidate is string => candidate !== undefined && candidate.length > 0);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through the closed platform candidates.
    }
  }
  throw new Error('no Chrome executable found; set BRUNCH_CHROME_PATH');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
