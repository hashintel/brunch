import { spawn, type ChildProcess } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Locator, type Page } from 'playwright-core';

import type {
  PetrinautMechanicalAddress,
  PetrinautOptimizationExecutionCasePublicContract,
} from '../case-contract.js';
import type { PetrinautOptimizationControllerOracleManifest } from '../oracle-pack.js';
import { requirePetrinautFocusedObservation } from './claims.js';
import { startDeterministicFakeOptimizer } from './fake-optimizer.js';
import type { PetrinautOptimizationOracleCheck } from './types.js';

const SEMANTIC_ACTION_TIMEOUT_MS = 5_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const CALIBRATION_SEED_PATH = fileURLToPath(new URL('./calibration-seed.json', import.meta.url));

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
  const calibrationSeed = JSON.parse(await readFile(CALIBRATION_SEED_PATH, 'utf8')) as unknown;
  const calibration = parseCalibrationInputs(calibrationSeed);
  try {
    await waitForRoute(
      `${candidateOrigin}${input.contract.acceptance.publicRoute}`,
      candidate,
      processEvidence,
    );
    browser = await chromium.launch({ executablePath: await resolveChromeExecutable(), headless: true });
    const definitions = checkDefinitions({
      contract: input.contract,
      calibration,
      candidateOrigin,
      fakeOrigin: fake.origin,
      requests: fake.requests,
    });
    const checks: PetrinautOptimizationOracleCheck[] = [];
    for (const declared of input.manifest.checks) {
      const definition = definitions.get(declared.id);
      if (definition === undefined) throw new Error(`missing Petrinaut check implementation: ${declared.id}`);
      const context = await browser.newContext();
      await context.addInitScript((seed) => {
        localStorage.setItem('petrinaut-sdcpn', JSON.stringify({ [(seed as { id: string }).id]: seed }));
      }, calibrationSeed);
      const page = await context.newPage();
      page.setDefaultTimeout(SEMANTIC_ACTION_TIMEOUT_MS);
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
          waitUntil: 'domcontentloaded',
          timeout: NAVIGATION_TIMEOUT_MS,
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

interface CalibrationInputs {
  readonly primaryScenarioName: string;
  readonly resetScenarioName: string;
  readonly optimizeParameterAddress: PetrinautMechanicalAddress;
  readonly savedMetricName: string;
}

function checkDefinitions(input: {
  readonly contract: PetrinautOptimizationExecutionCasePublicContract;
  readonly calibration: CalibrationInputs;
  readonly candidateOrigin: string;
  readonly fakeOrigin: string;
  readonly requests: { readonly body: unknown; readonly aborted: boolean }[];
}): ReadonlyMap<PetrinautOptimizationOracleCheck['id'], CheckDefinition> {
  const addresses = input.contract.mechanicalAddresses;
  return new Map([
    [
      'route-and-accessibility',
      async (page) => {
        await navigateToOptimizations(page, addresses);
        await requireCount(locate(page, addresses.viewTitle), 1, 'viewTitle');
        await requireCount(locate(page, addresses.create), 1, 'create');
        await openCreateDrawer(page, addresses);
        await requireCount(locate(page, addresses.createDrawer), 1, 'createDrawer');
        await requireCount(locate(page, addresses.scenario), 1, 'scenario');
        await selectScenarioOption(page, addresses, input.calibration.primaryScenarioName);
        await requireCount(locate(page, addresses.metric), 1, 'metric');
        await requireCount(locate(page, addresses.directionMaximize), 1, 'directionMaximize');
        await requireCount(locate(page, addresses.run), 1, 'run');
        requirePetrinautFocusedObservation({
          check: 'route-and-accessibility',
          pathname: new URL(page.url()).pathname,
          expectedPathname: input.contract.acceptance.publicRoute,
        });
        return [
          'public /optimization route ready',
          'required controls resolve through declared mechanical addresses',
        ];
      },
    ],
    [
      'scenario-configuration',
      async (page) => {
        await openConfiguration(page, addresses, input.calibration);
        const optimize = locate(page, input.calibration.optimizeParameterAddress);
        await optimize.click({ force: true });
        assert(await optimize.isChecked(), 'optimize toggle did not enable');
        await locate(page, addresses.directionMinimize).click({ force: true });
        await selectComboboxOption(
          page,
          addresses.scenarioSelected,
          optionAddress(input.calibration.resetScenarioName),
        );
        assert(
          !(await locate(page, input.calibration.optimizeParameterAddress).isChecked()),
          'scenario change retained optimized binding',
        );
        assert(
          !(await locate(page, addresses.directionMinimize).isChecked()),
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
        await openConfiguration(page, addresses, input.calibration);
        const savedRequestIndex = input.requests.length;
        await locate(page, input.calibration.optimizeParameterAddress).click({ force: true });
        await selectComboboxOption(page, addresses.metric, optionAddress(input.calibration.savedMetricName));
        await locate(page, addresses.directionMaximize).click({ force: true });
        await setOptimizationName(page, addresses, 'saved metric proof');
        await locate(page, addresses.run).click();
        await waitForAddress(page, addresses.statusComplete);
        const savedBody = input.requests[savedRequestIndex]?.body;
        assert(record(savedBody), 'fake optimizer did not capture the saved-metric request');
        const savedObjective = savedBody['objective'];
        assert(
          record(savedObjective) &&
            savedObjective['direction'] === 'maximize' &&
            typeof savedObjective['metricId'] === 'string',
          'saved objective missing',
        );

        await dismissOverlayDrawers(page);
        await openCreateDrawer(page, addresses);
        await selectScenarioOption(page, addresses, input.calibration.primaryScenarioName);
        const customRequestIndex = input.requests.length;
        await locate(page, input.calibration.optimizeParameterAddress).click({ force: true });
        await selectComboboxOption(page, addresses.metric, addresses.metricCustomOption);
        await locate(page, addresses.metricCode).fill('return 42;');
        await locate(page, addresses.directionMinimize).click({ force: true });
        await setOptimizationName(page, addresses, 'custom metric proof');
        await locate(page, addresses.run).click();
        await waitForAddress(page, addresses.statusComplete);
        const body = input.requests[customRequestIndex]?.body;
        assert(record(body), 'fake optimizer did not capture a JSON request');
        assert(
          record(body['scenario']) && typeof body['scenario']['id'] === 'string',
          'scenario missing from request',
        );
        const bindings = record(body['scenario']) ? body['scenario']['parameterBindings'] : undefined;
        assert(record(bindings), 'parameter bindings missing from request');
        assert(
          Object.values(bindings).some((binding) => record(binding) && binding['kind'] === 'optimize'),
          'optimized binding missing',
        );
        assert(
          Object.values(bindings).some((binding) => record(binding) && binding['kind'] === 'fixed'),
          'fixed binding missing',
        );
        const objective = body['objective'];
        assert(record(objective) && objective['direction'] === 'minimize', 'objective direction missing');
        assert(record(objective) && typeof objective['metricId'] === 'string', 'custom objective missing');
        const model = body['model'];
        assert(
          record(model) &&
            record(model['definition']) &&
            Array.isArray(model['definition']['metrics']) &&
            model['definition']['metrics'].some(
              (metric) => record(metric) && metric['code'] === 'return 42;',
            ),
          'custom metric code missing from request model',
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
        await openConfiguration(page, addresses, input.calibration);
        await locate(page, input.calibration.optimizeParameterAddress).click({ force: true });
        await selectComboboxOption(page, addresses.metric, optionAddress(input.calibration.savedMetricName));
        await locate(page, addresses.directionMaximize).click({ force: true });
        await setOptimizationName(page, addresses, 'progress proof');
        await locate(page, addresses.run).click();
        await waitForAddress(page, addresses.statusComplete);
        const progressiveTrialCount = await page.getByText(/^\d+$/u).count();
        const bestSoFarVisible = (await page.getByText('Best', { exact: true }).count()) > 0;
        const completionVisible = (await locate(page, addresses.statusComplete).count()) > 0;
        requirePetrinautFocusedObservation({
          check: 'progress-and-completion',
          progressiveTrialCount,
          bestSoFarVisible,
          completionVisible,
        });
        return ['progressive trial rendered', 'best-so-far rendered', 'completion rendered'];
      },
    ],
    [
      'service-error',
      async (page) => {
        await openConfiguration(page, addresses, input.calibration);
        await locate(page, input.calibration.optimizeParameterAddress).click({ force: true });
        await selectComboboxOption(page, addresses.metric, optionAddress(input.calibration.savedMetricName));
        await locate(page, addresses.directionMaximize).click({ force: true });
        await setOptimizationName(page, addresses, 'service failure');
        await locate(page, addresses.run).click();
        await waitForAddress(page, addresses.statusError);
        return ['service error rendered distinctly'];
      },
    ],
    [
      'cancel-and-abort',
      async (page) => {
        const requestIndex = input.requests.length;
        await openConfiguration(page, addresses, input.calibration);
        await locate(page, input.calibration.optimizeParameterAddress).click({ force: true });
        await selectComboboxOption(page, addresses.metric, optionAddress(input.calibration.savedMetricName));
        await locate(page, addresses.directionMaximize).click({ force: true });
        await setOptimizationName(page, addresses, 'cancel proof');
        await locate(page, addresses.run).click();
        // Create closes and the view drawer opens on the active record (initializing/running).
        await page
          .getByText('Running', { exact: true })
          .filter({ visible: true })
          .or(page.getByText('Initializing', { exact: true }).filter({ visible: true }))
          .first()
          .waitFor();
        const cancel = locate(page, addresses.cancel);
        await cancel.waitFor();
        await cancel.focus();
        assert(
          await cancel.evaluate((element) => {
            const active = document.activeElement;
            return active === element || (active !== null && element.contains(active));
          }),
          'cancel is not focusable',
        );
        await cancel.press('Enter');
        await waitForAddress(page, addresses.statusCancelled);
        await waitFor(
          () => input.requests[requestIndex]?.aborted === true,
          'upstream request was not aborted',
        );
        requirePetrinautFocusedObservation({
          check: 'cancel-and-abort',
          cancelControlVisible: true,
          hostRequestAborted: input.requests[requestIndex]?.aborted === true,
          cancelledVisible: (await locate(page, addresses.statusCancelled).count()) > 0,
        });
        return ['cancel keyboard control rendered', 'host request aborted', 'cancelled state rendered'];
      },
    ],
    [
      'private-origin-secrecy',
      async (page) => {
        const browserRequests: string[] = [];
        page.on('request', (request) => browserRequests.push(request.url()));
        await openConfiguration(page, addresses, input.calibration);
        await locate(page, input.calibration.optimizeParameterAddress).click({ force: true });
        await selectComboboxOption(page, addresses.metric, optionAddress(input.calibration.savedMetricName));
        await locate(page, addresses.directionMaximize).click({ force: true });
        await setOptimizationName(page, addresses, 'secrecy proof');
        await locate(page, addresses.run).click();
        await waitForAddress(page, addresses.statusComplete);
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

async function navigateToOptimizations(
  page: Page,
  addresses: PetrinautOptimizationExecutionCasePublicContract['mechanicalAddresses'],
): Promise<void> {
  const skip = locate(page, addresses.skipTour);
  if ((await skip.count()) > 0) await skip.click({ force: true });
  const dismiss = locate(page, addresses.dismissAssistant);
  if ((await dismiss.count()) > 0) await dismiss.click({ force: true });
  await locate(page, addresses.simulateMode).click({ force: true });
  await locate(page, addresses.optimizationsNav).click({ force: true });
  await locate(page, addresses.viewTitle).waitFor();
}

async function openConfiguration(
  page: Page,
  addresses: PetrinautOptimizationExecutionCasePublicContract['mechanicalAddresses'],
  calibration: CalibrationInputs,
): Promise<void> {
  await navigateToOptimizations(page, addresses);
  await openCreateDrawer(page, addresses);
  assert(
    (await locate(page, calibration.optimizeParameterAddress).count()) === 0,
    'configuration appeared before scenario selection',
  );
  await selectScenarioOption(page, addresses, calibration.primaryScenarioName);
}

async function openCreateDrawer(
  page: Page,
  addresses: PetrinautOptimizationExecutionCasePublicContract['mechanicalAddresses'],
): Promise<void> {
  if ((await locate(page, addresses.createDrawer).count()) === 0) {
    await dismissOverlayDrawers(page);
    await locate(page, addresses.create).click({ force: true });
  }
  await locate(page, addresses.createDrawer).waitFor();
  await locate(page, addresses.run).waitFor();
  assert((await locate(page, addresses.run).count()) === 1, 'create drawer did not expose Run control');
}

async function dismissOverlayDrawers(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await page.getByRole('dialog').count()) === 0) return;
    await page.keyboard.press('Escape');
    try {
      await page.getByRole('dialog').first().waitFor({ state: 'hidden', timeout: 500 });
    } catch {
      // Keep dismissing until no dialog remains or attempts exhaust.
    }
  }
}

function locate(page: Page, address: PetrinautMechanicalAddress): Locator {
  switch (address.kind) {
    case 'roleName':
      return page.getByRole(address.role as Parameters<Page['getByRole']>[0], {
        name: address.name,
        exact: true,
      });
    case 'roleValue':
      return page.locator(`${cssRoleSelector(address.role)}[value="${cssEscape(address.value)}"]`);
    case 'roleContents':
      return page.getByRole(address.role as Parameters<Page['getByRole']>[0]).filter({
        hasText: address.contents,
      });
    case 'exactText':
      // exactText never resolves role=tooltip nodes (nav tooltips reuse titles).
      return page
        .getByText(address.text, { exact: true })
        .and(page.locator(':not([role="tooltip"])'))
        .filter({ visible: true });
  }
}

async function selectScenarioOption(
  page: Page,
  addresses: PetrinautOptimizationExecutionCasePublicContract['mechanicalAddresses'],
  optionText: string,
): Promise<void> {
  const combobox = locate(page, addresses.scenario);
  await requireCount(combobox, 1, 'scenario');
  await selectComboboxLocatorOption(page, combobox, optionAddress(optionText));
}

async function selectComboboxLocatorOption(
  page: Page,
  combobox: Locator,
  option: PetrinautMechanicalAddress,
): Promise<void> {
  const tagName = await combobox.evaluate((element) => element.tagName);
  if (tagName === 'SELECT') {
    assert(
      option.kind === 'roleName' && option.role === 'option',
      'native select options require a roleName option address',
    );
    await combobox.selectOption({ label: option.name });
    return;
  }
  await combobox.click({ force: true });
  await locate(page, option).click();
}

function cssRoleSelector(role: string): string {
  if (role === 'radio') return 'input[type="radio"]';
  return `[role="${cssEscape(role)}"]`;
}

function cssEscape(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

async function selectComboboxOption(
  page: Page,
  address: PetrinautMechanicalAddress,
  option: PetrinautMechanicalAddress,
): Promise<void> {
  await selectComboboxLocatorOption(page, locate(page, address), option);
}

function optionAddress(name: string): PetrinautMechanicalAddress {
  return { kind: 'roleName', role: 'option', name };
}

async function setOptimizationName(
  page: Page,
  addresses: PetrinautOptimizationExecutionCasePublicContract['mechanicalAddresses'],
  name: string,
): Promise<void> {
  const nameField = locate(page, addresses.optimizationName);
  await requireCount(nameField, 1, 'optimizationName');
  await nameField.fill(name);
}

async function waitForAddress(page: Page, address: PetrinautMechanicalAddress): Promise<void> {
  await locate(page, address).first().waitFor();
}

async function requireCount(locator: Locator, expected: number, label: string): Promise<void> {
  const actual = await locator.count();
  assert(actual === expected, `${label}: expected ${expected}, received ${actual}`);
}

function parseCalibrationInputs(value: unknown): CalibrationInputs {
  assert(record(value), 'invalid Petrinaut calibration seed');
  const sdcpn = value['sdcpn'];
  assert(record(sdcpn), 'calibration seed is missing sdcpn');
  const primary = recordById(sdcpn['scenarios'], 'scenario__seasonal_flu', 'scenario');
  const reset = recordById(sdcpn['scenarios'], 'scenario__high_virulence', 'scenario');
  const metric = recordById(sdcpn['metrics'], 'metric__infected_fraction', 'metric');
  assert(typeof primary['name'] === 'string', 'primary calibration scenario is missing its name');
  assert(typeof reset['name'] === 'string', 'reset calibration scenario is missing its name');
  assert(typeof metric['name'] === 'string', 'calibration metric is missing its name');
  assert(Array.isArray(primary['scenarioParameters']), 'primary scenario is missing parameters');
  const parameter = primary['scenarioParameters'].find(
    (candidate) => record(candidate) && candidate['identifier'] === 'infected_ratio',
  );
  assert(record(parameter), 'primary scenario is missing the optimized calibration parameter');
  assert(
    typeof parameter['identifier'] === 'string',
    'optimized calibration parameter is missing its identifier',
  );
  return {
    primaryScenarioName: primary['name'],
    resetScenarioName: reset['name'],
    optimizeParameterAddress: {
      kind: 'roleName',
      role: 'checkbox',
      name: `Optimize ${parameter['identifier']}`,
    },
    savedMetricName: metric['name'],
  };
}

function recordById(value: unknown, id: string, label: string): Record<string, unknown> {
  assert(Array.isArray(value), `calibration seed is missing ${label} rows`);
  const found = value.find((candidate) => record(candidate) && candidate['id'] === id);
  assert(record(found), `calibration seed is missing ${label} ${id}`);
  return found;
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
