import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, type Browser, type Page } from 'playwright-core';

import type { PetrinautOptimizationExecutionCasePublicContract } from '../case-contract.js';
import type { PetrinautOptimizationControllerOracleManifest } from '../oracle-pack.js';
import { requirePetrinautFocusedObservation } from './claims.js';
import { startDeterministicFakeOptimizer } from './fake-optimizer.js';
import type { PetrinautOptimizationOracleCheck } from './types.js';

export async function runPetrinautBrowserChecks(input: {
  readonly candidateRoot: string;
  readonly contract: PetrinautOptimizationExecutionCasePublicContract;
  readonly manifest: PetrinautOptimizationControllerOracleManifest;
}): Promise<{
  readonly checks: readonly PetrinautOptimizationOracleCheck[];
  readonly consoleErrors: readonly string[];
  readonly failedRequests: readonly string[];
}> {
  const fake = await startDeterministicFakeOptimizer();
  const port = await availablePort();
  const candidateOrigin = `http://127.0.0.1:${port}`;
  const processEvidence: string[] = [];
  const candidate = spawn(
    'yarn',
    ['workspace', '@apps/petrinaut-website', 'dev', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: input.candidateRoot,
      env: {
        ...process.env,
        PETRINAUT_OPT_ORIGIN: fake.origin,
        VITE_PETRINAUT_OPT_PROVIDER: 'service',
      },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  candidate.stdout?.on('data', (chunk: Buffer) => processEvidence.push(chunk.toString('utf8')));
  candidate.stderr?.on('data', (chunk: Buffer) => processEvidence.push(chunk.toString('utf8')));
  let browser: Browser | undefined;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  try {
    await waitForRoute(
      `${candidateOrigin}${input.contract.acceptance.publicRoute}`,
      candidate,
      processEvidence,
    );
    browser = await chromium.launch({ executablePath: await resolveChromeExecutable(), headless: true });
    const definitions = checkDefinitions({
      contract: input.contract,
      candidateOrigin,
      fakeOrigin: fake.origin,
      requests: fake.requests,
    });
    const checks: PetrinautOptimizationOracleCheck[] = [];
    for (const declared of input.manifest.checks) {
      const definition = definitions.get(declared.id);
      if (definition === undefined) throw new Error(`missing Petrinaut check implementation: ${declared.id}`);
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(5_000);
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));
      page.on('requestfailed', (request) =>
        declared.id === 'cancel-and-abort' && request.failure()?.errorText === 'net::ERR_ABORTED'
          ? undefined
          : failedRequests.push(
              `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
            ),
      );
      try {
        await page.goto(`${candidateOrigin}${input.contract.acceptance.publicRoute}`, {
          waitUntil: 'networkidle',
        });
        const evidence = await definition(page);
        checks.push({ id: declared.id, claims: declared.claims, status: 'passed', evidence });
      } catch (error) {
        checks.push({
          id: declared.id,
          claims: declared.claims,
          status: 'failed',
          evidence: [error instanceof Error ? error.message : String(error)],
        });
      } finally {
        await context.close();
      }
    }
    return { checks, consoleErrors, failedRequests };
  } finally {
    await browser?.close();
    await stopChild(candidate);
    await fake.close();
  }
}

type CheckDefinition = (page: Page) => Promise<readonly string[]>;

function checkDefinitions(input: {
  readonly contract: PetrinautOptimizationExecutionCasePublicContract;
  readonly candidateOrigin: string;
  readonly fakeOrigin: string;
  readonly requests: { readonly body: unknown; readonly aborted: boolean }[];
}): ReadonlyMap<PetrinautOptimizationOracleCheck['id'], CheckDefinition> {
  return new Map([
    [
      'route-and-accessibility',
      async (page) => {
        await requireCount(page.getByRole('heading', { name: 'Optimizations', exact: true }), 1, 'view');
        await requireCount(page.getByRole('tab', { name: 'Optimizations', exact: true }), 1, 'tab');
        await page.getByRole('button', { name: 'Create optimization', exact: true }).click();
        await requireCount(page.getByRole('combobox', { name: 'Scenario', exact: true }), 1, 'scenario');
        await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('baseline');
        let controlsReachable = true;
        for (const [role, name] of [
          ['combobox', 'Objective metric'],
          ['combobox', 'Objective direction'],
          ['button', 'Run optimization'],
        ] as const) {
          const locator = page.getByRole(role, { name, exact: true });
          await locator.focus();
          controlsReachable &&= await locator.evaluate((element) => element === document.activeElement);
        }
        requirePetrinautFocusedObservation({
          check: 'route-and-accessibility',
          pathname: new URL(page.url()).pathname,
          expectedPathname: input.contract.acceptance.publicRoute,
          controlsReachable,
        });
        return [
          'public /optimization route ready',
          'required controls expose stable roles and keyboard focus',
        ];
      },
    ],
    [
      'scenario-configuration',
      async (page) => {
        await openConfiguration(page);
        const optimize = page.getByRole('checkbox', { name: 'Optimize rate', exact: true });
        await optimize.check();
        await page.getByRole('spinbutton', { name: 'rate minimum', exact: true }).fill('2');
        await page
          .getByRole('combobox', { name: 'Objective direction', exact: true })
          .selectOption('minimize');
        await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('surge');
        assert(!(await optimize.isChecked()), 'scenario change retained optimized binding');
        assert(
          (await page.getByRole('spinbutton', { name: 'rate fixed value', exact: true }).inputValue()) ===
            '8',
          'scenario change did not reset fixed value',
        );
        assert(
          (await page.getByRole('combobox', { name: 'Objective direction', exact: true }).inputValue()) ===
            'maximize',
          'scenario change retained metric direction',
        );
        return [
          'configuration hidden until scenario selection',
          'scenario change reset bindings and objective',
        ];
      },
    ],
    [
      'request-contract',
      async (page) => {
        await openConfiguration(page);
        const savedRequestIndex = input.requests.length;
        await page.getByRole('button', { name: 'Run optimization', exact: true }).click();
        await status(page, /Complete/u);
        const savedBody = input.requests[savedRequestIndex]?.body;
        assert(record(savedBody), 'fake optimizer did not capture the saved-metric request');
        const savedObjective = savedBody['objective'];
        assert(
          record(savedObjective) &&
            savedObjective['direction'] === 'maximize' &&
            record(savedObjective['metric']) &&
            savedObjective['metric']['source'] === 'saved',
          'saved objective missing',
        );

        const customRequestIndex = input.requests.length;
        await page.getByRole('textbox', { name: 'Optimization name', exact: true }).fill('request proof');
        await page.getByRole('checkbox', { name: 'Optimize rate', exact: true }).check();
        await page.getByRole('spinbutton', { name: 'rate minimum', exact: true }).fill('2');
        await page.getByRole('spinbutton', { name: 'rate maximum', exact: true }).fill('9');
        await page.getByRole('spinbutton', { name: 'demand fixed value', exact: true }).fill('7');
        await page.getByRole('combobox', { name: 'Objective metric', exact: true }).selectOption('custom');
        await page.getByRole('textbox', { name: 'Custom metric code', exact: true }).fill('return 42;');
        await page
          .getByRole('combobox', { name: 'Objective direction', exact: true })
          .selectOption('minimize');
        await page.getByRole('button', { name: 'Run optimization', exact: true }).click();
        await status(page, /Complete/u);
        const body = input.requests[customRequestIndex]?.body;
        assert(record(body), 'fake optimizer did not capture a JSON request');
        assert(
          record(body['scenario']) && body['scenario']['id'] === 'baseline',
          'scenario missing from request',
        );
        const bindings = record(body['scenario']) ? body['scenario']['parameterBindings'] : undefined;
        assert(record(bindings), 'parameter bindings missing from request');
        assert(
          record(bindings['rate']) && bindings['rate']['kind'] === 'optimize',
          'optimized binding missing',
        );
        assert(record(bindings['demand']) && bindings['demand']['value'] === 7, 'fixed binding missing');
        const objective = body['objective'];
        assert(record(objective) && objective['direction'] === 'minimize', 'objective direction missing');
        assert(
          record(objective['metric']) &&
            objective['metric']['source'] === 'custom' &&
            objective['metric']['code'] === 'return 42;',
          'custom objective missing',
        );
        return [
          'captured flat fixed/optimized bindings',
          'captured saved and custom objectives with direction',
        ];
      },
    ],
    [
      'progress-and-completion',
      async (page) => {
        await openConfiguration(page);
        await page.getByRole('button', { name: 'Run optimization', exact: true }).click();
        await page.getByText('Trial 1: 12', { exact: true }).waitFor();
        await page.getByText('Best so far: 12', { exact: true }).first().waitFor();
        await status(page, /Complete/u);
        requirePetrinautFocusedObservation({
          check: 'progress-and-completion',
          progressiveTrialCount: await page.getByText(/^Trial \d+: /u).count(),
          bestSoFarVisible: (await page.getByText(/^Best so far: /u).count()) > 0,
          completionVisible: await page
            .getByRole('status', { name: 'Optimization status', exact: true })
            .filter({ hasText: /Complete/u })
            .isVisible(),
        });
        return ['progressive trial rendered', 'best-so-far rendered', 'completion rendered'];
      },
    ],
    [
      'service-error',
      async (page) => {
        await openConfiguration(page);
        await page.getByRole('textbox', { name: 'Optimization name', exact: true }).fill('service failure');
        await page.getByRole('button', { name: 'Run optimization', exact: true }).click();
        await status(page, /Error: Deterministic optimizer failure/u);
        return ['service error rendered distinctly'];
      },
    ],
    [
      'cancel-and-abort',
      async (page) => {
        const requestIndex = input.requests.length;
        await openConfiguration(page);
        await page.getByRole('textbox', { name: 'Optimization name', exact: true }).fill('cancel proof');
        await page.getByRole('button', { name: 'Run optimization', exact: true }).click();
        const cancel = page.getByRole('button', { name: 'Cancel optimization', exact: true });
        await cancel.waitFor();
        await cancel.focus();
        assert(
          await cancel.evaluate((element) => element === document.activeElement),
          'cancel is not focusable',
        );
        await cancel.press('Enter');
        await status(page, /Cancelled/u);
        await waitFor(
          () => input.requests[requestIndex]?.aborted === true,
          'upstream request was not aborted',
        );
        requirePetrinautFocusedObservation({
          check: 'cancel-and-abort',
          cancelControlVisible: true,
          hostRequestAborted: input.requests[requestIndex]?.aborted === true,
          cancelledVisible: await page
            .getByRole('status', { name: 'Optimization status', exact: true })
            .filter({ hasText: /Cancelled/u })
            .isVisible(),
        });
        return ['cancel keyboard control rendered', 'host request aborted', 'cancelled state rendered'];
      },
    ],
    [
      'private-origin-secrecy',
      async (page) => {
        const browserRequests: string[] = [];
        page.on('request', (request) => browserRequests.push(request.url()));
        await openConfiguration(page);
        await page.getByRole('button', { name: 'Run optimization', exact: true }).click();
        await status(page, /Complete/u);
        requirePetrinautFocusedObservation({
          check: 'private-origin-secrecy',
          candidateOrigin: input.candidateOrigin,
          browserRequestUrls: browserRequests,
          domText: await page.locator('body').innerText(),
          privateOrigin: input.fakeOrigin,
        });
        return ['browser traffic remained same-origin', 'DOM omitted private optimizer origin'];
      },
    ],
  ]);
}

async function openConfiguration(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Create optimization', exact: true }).click();
  const scenario = page.getByRole('combobox', { name: 'Scenario', exact: true });
  assert(
    (await page.getByRole('button', { name: 'Run optimization', exact: true }).count()) === 0,
    'configuration appeared before scenario selection',
  );
  await scenario.selectOption('baseline');
}

async function status(page: Page, pattern: RegExp): Promise<void> {
  await page
    .getByRole('status', { name: 'Optimization status', exact: true })
    .filter({ hasText: pattern })
    .waitFor();
}

async function requireCount(
  locator: ReturnType<Page['getByRole']>,
  expected: number,
  label: string,
): Promise<void> {
  const actual = await locator.count();
  assert(actual === expected, `${label}: expected ${expected}, received ${actual}`);
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
  if (address === null || typeof address === 'string') throw new Error('port reservation failed');
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error === undefined ? resolveClose() : reject(error)));
  });
  return port;
}

async function waitForRoute(url: string, child: ChildProcess, evidence: readonly string[]): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`candidate process exited ${child.exitCode}: ${evidence.join('')}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Candidate is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`candidate /optimization route did not become ready: ${evidence.join('')}`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  signalChildTree(child, 'SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) signalChildTree(child, 'SIGKILL');
}

function signalChildTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The process group may already have exited.
    }
  }
  child.kill(signal);
}

async function resolveChromeExecutable(): Promise<string> {
  const candidates = [
    process.env['BRUNCH_CHROME_PATH'],
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter((candidate): candidate is string => candidate !== undefined && candidate.length > 0);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through closed platform candidates.
    }
  }
  throw new Error('no Chrome executable found; set BRUNCH_CHROME_PATH');
}

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(message);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
