import { access, readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

import { chromium, type Locator, type Page } from 'playwright-core';

import { runCommand } from '../../app/command-runner.js';
import { loadPublicCasePacket, type ExecutionCasePublicContract } from './case-contract.js';

type AriaRole = Parameters<Page['getByRole']>[0];

export interface BrowserOracleReport {
  readonly status: 'passed' | 'failed';
  readonly commands: readonly {
    readonly id: 'test' | 'build';
    readonly status: 'passed' | 'failed';
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
  }[];
  readonly checks: readonly {
    readonly id: string;
    readonly status: 'passed' | 'failed';
    readonly message: string;
  }[];
  readonly startupConsoleErrors: readonly string[];
  readonly failedModuleLoads: readonly string[];
  readonly externalRuntimeRequests: readonly string[];
}

export async function runPetriEditorBrowserOracle(input: {
  readonly appDir: string;
  readonly caseDir: string;
}): Promise<BrowserOracleReport> {
  const packet = await loadPublicCasePacket(input.caseDir);
  const commands: BrowserOracleReport['commands'][number][] = [];
  for (const [id, command] of [
    ['test', packet.contract.delivery.test],
    ['build', packet.contract.delivery.build],
  ] as const) {
    const result = await runCommand(command.command, command.args, {
      cwd: input.appDir,
      timeoutMs: 10 * 60_000,
      maxOutputBytes: 256 * 1024,
    });
    commands.push({
      id,
      status: result.exitCode === 0 ? 'passed' : 'failed',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    if (result.exitCode !== 0) return emptyFailedReport(commands);
  }

  const distDir = resolve(input.appDir, packet.contract.delivery.staticOutput);
  const server = await startStaticServer(distDir);
  const browser = await chromium.launch({
    executablePath: await resolveChromeExecutable(),
    headless: true,
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const startupConsoleErrors: string[] = [];
  const failedModuleLoads: string[] = [];
  const externalRuntimeRequests: string[] = [];
  const checks: BrowserOracleReport['checks'][number][] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') startupConsoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => startupConsoleErrors.push(error.message));
  page.on('response', (response) => {
    const resourceType = response.request().resourceType();
    if (
      response.status() >= 400 &&
      (resourceType === 'document' || resourceType === 'script' || resourceType === 'stylesheet')
    ) {
      failedModuleLoads.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (new URL(url).origin !== new URL(server.url).origin) externalRuntimeRequests.push(url);
  });

  try {
    await page.goto(server.url, { waitUntil: 'networkidle' });
    await runCheck(checks, 'mount', async () => {
      await assertBaseAccessibility(page, packet.contract.accessibility);
      await assertCounts(page, { places: 0, transitions: 0, arcs: 0 });
      assert(startupConsoleErrors.length === 0, `startup console errors: ${startupConsoleErrors.join('; ')}`);
      assert(failedModuleLoads.length === 0, `failed module loads: ${failedModuleLoads.join('; ')}`);
      assert(
        externalRuntimeRequests.length === 0,
        `runtime network requests: ${externalRuntimeRequests.join('; ')}`,
      );
    });

    await runCheck(checks, 'node-lifecycle', async () => {
      await button(page, 'Add place').click();
      await setField(page, 'textbox', 'Label', 'Input');
      await setField(page, 'spinbutton', 'Initial tokens', '2');
      const inputPlace = page.getByRole('button', { name: 'Place: Input', exact: true });
      await assertCount(inputPlace, 1, 'one created Input place');
      await assertCleanDrag(page, inputPlace, { x: 80, y: 90 });

      await button(page, 'Add transition').click();
      await setField(page, 'textbox', 'Label', 'Fire');
      const fire = transition(page, 'Fire', 'enabled');
      await assertCount(fire, 1, 'one created Fire transition');
      await assertCleanDrag(page, fire, { x: 140, y: 20 });

      await button(page, 'Add place').click();
      await setField(page, 'textbox', 'Label', 'Output');
      const output = page.getByRole('button', { name: 'Place: Output', exact: true });
      await assertCount(output, 1, 'one created Output place');
      await assertCleanDrag(page, output, { x: 210, y: 100 });
      await assertCounts(page, { places: 2, transitions: 1, arcs: 0 });
    });

    await runCheck(checks, 'weighted-fire-reset-reload', async () => {
      await createArc(page, place(page, 'Input'), transition(page, 'Fire', 'enabled'));
      await setField(page, 'spinbutton', 'Arc weight', '2');
      await createArc(page, transition(page, 'Fire', 'enabled'), place(page, 'Output'));
      await setField(page, 'spinbutton', 'Arc weight', '3');
      await assertCounts(page, { places: 2, transitions: 1, arcs: 2 });

      await transition(page, 'Fire', 'enabled').click();
      await button(page, 'Fire selected transition').click();
      await assertCurrentTokens(page, 'Input', 0);
      await assertCurrentTokens(page, 'Output', 3);
      await assertCount(transition(page, 'Fire', 'disabled'), 1, 'disabled transition after firing');

      await transition(page, 'Fire', 'disabled').click();
      await button(page, 'Fire selected transition').click();
      await assertCurrentTokens(page, 'Output', 3);

      await button(page, 'Reset marking').click();
      await assertCurrentTokens(page, 'Input', 2);
      await assertCurrentTokens(page, 'Output', 0);
      await assertCount(transition(page, 'Fire', 'enabled'), 1, 'enabled transition after reset');

      await transition(page, 'Fire', 'enabled').click();
      await button(page, 'Fire selected transition').click();
      await page.reload({ waitUntil: 'networkidle' });
      await assertCurrentTokens(page, 'Input', 2);
      await assertCurrentTokens(page, 'Output', 0);
      await assertCounts(page, { places: 2, transitions: 1, arcs: 2 });
    });

    await runCheck(checks, 'invalid-and-cascade', async () => {
      await place(page, 'Input').click();
      await setField(page, 'spinbutton', 'Initial tokens', '-1');
      await assertFieldValue(page, 'spinbutton', 'Initial tokens', '2');
      await setField(page, 'spinbutton', 'Initial tokens', '1.5');
      await assertFieldValue(page, 'spinbutton', 'Initial tokens', '2');

      await arc(page, 'Input', 'Fire').click();
      await setField(page, 'spinbutton', 'Arc weight', '0');
      await assertFieldValue(page, 'spinbutton', 'Arc weight', '2');
      await setField(page, 'spinbutton', 'Arc weight', '1.5');
      await assertFieldValue(page, 'spinbutton', 'Arc weight', '2');

      await button(page, 'Add place').click();
      await setField(page, 'textbox', 'Label', 'Extra');
      await createInvalidArc(page, place(page, 'Input'), place(page, 'Extra'));
      await button(page, 'Delete selection').click();

      await button(page, 'Add transition').click();
      await setField(page, 'textbox', 'Label', 'Extra transition');
      await createInvalidArc(
        page,
        transition(page, 'Fire', 'enabled'),
        transition(page, 'Extra transition', 'enabled'),
      );
      await button(page, 'Delete selection').click();

      const nonJson = join(input.caseDir, 'controller', 'fixtures', 'invalid', 'not-json.txt');
      const schemaInvalid = join(input.caseDir, 'controller', 'fixtures', 'invalid', 'schema-invalid.json');
      const before = await dynamicCounts(page);
      await importFile(page, nonJson);
      assert(await feedbackText(page).then((text) => /invalid|rejected/iu.test(text)), 'non-JSON feedback');
      assertCountsEqual(await dynamicCounts(page), before, 'non-JSON import changed the net');
      await importFile(page, schemaInvalid);
      assert(
        await feedbackText(page).then((text) => /invalid|rejected/iu.test(text)),
        'schema-invalid feedback',
      );
      assertCountsEqual(await dynamicCounts(page), before, 'schema-invalid import changed the net');

      await place(page, 'Output').click();
      await button(page, 'Delete selection').click();
      await assertCount(arc(page, 'Fire', 'Output'), 0, 'cascade-deleted output arc');
      await assertCounts(page, { places: 1, transitions: 1, arcs: 1 });
    });

    await runCheck(checks, 'round-trip-and-clear', async () => {
      const exported = await exportJson(page);
      const exportedValue = JSON.parse(exported) as {
        places?: readonly { id?: string }[];
        transitions?: readonly { id?: string }[];
        arcs?: readonly { source?: string; target?: string }[];
      };
      const nodeIds = new Set(
        [...(exportedValue.places ?? []), ...(exportedValue.transitions ?? [])].map((node) => node.id),
      );
      assert(
        (exportedValue.arcs ?? []).every(
          (selectedArc) => nodeIds.has(selectedArc.source) && nodeIds.has(selectedArc.target),
        ),
        'export contains a dangling arc',
      );

      await button(page, 'New net').click();
      await assertCounts(page, { places: 0, transitions: 0, arcs: 0 });
      await importJsonText(page, exported);
      await assertCounts(page, { places: 1, transitions: 1, arcs: 1 });

      await button(page, 'New net').click();
      await page.reload({ waitUntil: 'networkidle' });
      await assertCounts(page, { places: 0, transitions: 0, arcs: 0 });
    });
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }

  return {
    status: checks.every((check) => check.status === 'passed') ? 'passed' : 'failed',
    commands,
    checks,
    startupConsoleErrors,
    failedModuleLoads,
    externalRuntimeRequests,
  };
}

async function runCheck(
  checks: BrowserOracleReport['checks'][number][],
  id: string,
  check: () => Promise<void>,
): Promise<void> {
  if (checks.some((existing) => existing.status === 'failed')) {
    checks.push({ id, status: 'failed', message: 'blocked by an earlier failed journey' });
    return;
  }
  try {
    await check();
    checks.push({ id, status: 'passed', message: 'all assertions passed' });
  } catch (error) {
    checks.push({
      id,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function assertBaseAccessibility(
  page: Page,
  contract: ExecutionCasePublicContract['accessibility'],
): Promise<void> {
  await requireExactlyOne(page, contract.application.role, contract.application.name);
  await requireExactlyOne(page, contract.canvas.role, contract.canvas.name);
  for (const control of contract.controls) {
    await requireExactlyOne(page, control.role, control.name);
  }
  const feedbackCount = await Promise.all(
    contract.feedbackRoles.map(async (role) => await page.getByRole(role).count()),
  );
  assert(feedbackCount.reduce((sum, count) => sum + count, 0) > 0, 'missing status or alert feedback');
}

async function requireExactlyOne(page: Page, role: string, name: string): Promise<void> {
  await assertCount(page.getByRole(role as AriaRole, { name, exact: true }), 1, `${role} ${name}`);
}

async function assertCleanDrag(
  page: Page,
  locator: Locator,
  offset: { readonly x: number; readonly y: number },
): Promise<void> {
  const before = await requiredBox(locator);
  await dragFromTo(page, locator, {
    x: before.x + before.width / 2 + offset.x,
    y: before.y + before.height / 2 + offset.y,
  });
  const after = await requiredBox(locator);
  assert(
    Math.abs(after.x - before.x - offset.x) < 3 && Math.abs(after.y - before.y - offset.y) < 3,
    'node did not move to the pointer drop position',
  );
  await page.mouse.move(after.x + after.width + 50, after.y + after.height + 50);
  await page.waitForTimeout(25);
  const released = await requiredBox(locator);
  assert(
    Math.abs(released.x - after.x) < 1 && Math.abs(released.y - after.y) < 1,
    'node still followed the pointer after release',
  );
}

async function createArc(page: Page, source: Locator, target: Locator): Promise<void> {
  await button(page, 'Draw arc').click();
  await dragToLocator(page, source, target);
}

async function createInvalidArc(page: Page, source: Locator, target: Locator): Promise<void> {
  const before = await page.getByRole('button', { name: /^Arc: .+ to .+$/u }).count();
  await createArc(page, source, target);
  const after = await page.getByRole('button', { name: /^Arc: .+ to .+$/u }).count();
  assert(after === before, 'invalid arc changed the arc count');
  assert(
    await feedbackText(page).then((text) => /place.+transition/iu.test(text)),
    'invalid arc did not expose place-to-transition feedback',
  );
}

async function dragToLocator(page: Page, source: Locator, target: Locator): Promise<void> {
  const targetBox = await requiredBox(target);
  await dragFromTo(page, source, {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  });
}

async function dragFromTo(
  page: Page,
  source: Locator,
  destination: { readonly x: number; readonly y: number },
): Promise<void> {
  const sourceBox = await requiredBox(source);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 8 });
  await page.mouse.up();
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('required accessible element has no rendered bounding box');
  return box;
}

async function setField(
  page: Page,
  role: 'textbox' | 'spinbutton',
  name: string,
  value: string,
): Promise<void> {
  const locator = page.getByRole(role, { name, exact: true });
  await assertCount(locator, 1, `${name} inspector field`);
  await locator.fill(value);
  await locator.press('Tab');
}

async function assertCurrentTokens(page: Page, label: string, expected: number): Promise<void> {
  await place(page, label).click();
  await assertFieldValue(page, 'spinbutton', 'Current tokens', String(expected));
}

async function assertFieldValue(
  page: Page,
  role: 'textbox' | 'spinbutton',
  name: string,
  expected: string,
): Promise<void> {
  const actual = await page.getByRole(role, { name, exact: true }).inputValue();
  assert(actual === expected, `${name}: expected ${expected}, received ${actual}`);
}

async function importFile(page: Page, path: string): Promise<void> {
  const input = page.getByRole('button', { name: 'Import JSON', exact: true });
  await input.setInputFiles(path);
  await feedback(page, /Import rejected/iu).waitFor();
}

async function importJsonText(page: Page, text: string): Promise<void> {
  const input = page.getByRole('button', { name: 'Import JSON', exact: true });
  await input.setInputFiles({
    name: 'round-trip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text, 'utf8'),
  });
  await feedback(page, 'Net imported.').waitFor();
}

function feedback(page: Page, hasText: string | RegExp): Locator {
  return page.getByRole('status').filter({ hasText }).or(page.getByRole('alert').filter({ hasText })).first();
}

async function exportJson(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await button(page, 'Export JSON').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

function place(page: Page, label: string): Locator {
  return page.getByRole('button', { name: `Place: ${label}`, exact: true });
}

function transition(page: Page, label: string, state: 'enabled' | 'disabled'): Locator {
  return page.getByRole('button', {
    name: `Transition: ${label} (${state})`,
    exact: true,
  });
}

function arc(page: Page, source: string, target: string): Locator {
  return page.getByRole('button', { name: `Arc: ${source} to ${target}`, exact: true });
}

async function feedbackText(page: Page): Promise<string> {
  const status = await page.getByRole('status').allTextContents();
  const alerts = await page.getByRole('alert').allTextContents();
  return [...status, ...alerts].join('\n');
}

async function dynamicCounts(page: Page) {
  return {
    places: await page.getByRole('button', { name: /^Place: .+$/u }).count(),
    transitions: await page.getByRole('button', { name: /^Transition: .+ \((enabled|disabled)\)$/u }).count(),
    arcs: await page.getByRole('button', { name: /^Arc: .+ to .+$/u }).count(),
  };
}

async function assertCounts(
  page: Page,
  expected: { readonly places: number; readonly transitions: number; readonly arcs: number },
): Promise<void> {
  assertCountsEqual(await dynamicCounts(page), expected, 'dynamic element counts differ');
}

function assertCountsEqual(
  actual: { readonly places: number; readonly transitions: number; readonly arcs: number },
  expected: { readonly places: number; readonly transitions: number; readonly arcs: number },
  message: string,
): void {
  assert(
    actual.places === expected.places &&
      actual.transitions === expected.transitions &&
      actual.arcs === expected.arcs,
    `${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

async function assertCount(locator: Locator, expected: number, message: string): Promise<void> {
  const actual = await locator.count();
  assert(actual === expected, `${message}: expected ${expected}, received ${actual}`);
}

async function resolveChromeExecutable(): Promise<string> {
  const candidates = [
    process.env['BRUNCH_CHROME_PATH'],
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((candidate): candidate is string => candidate !== undefined && candidate.length > 0);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through declared platform candidates.
    }
  }
  throw new Error('no Chrome executable found; set BRUNCH_CHROME_PATH');
}

async function startStaticServer(root: string): Promise<{
  readonly url: string;
  readonly close: () => Promise<void>;
}> {
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`static build output is not a directory: ${root}`);
  const server = createServer(async (request, response) => {
    try {
      const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (requestPath === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      const requestRelative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/u, '');
      const normalized = normalize(requestRelative);
      const selected = resolve(root, normalized);
      const selectedRelative = relative(root, selected);
      if (
        selectedRelative === '..' ||
        selectedRelative.startsWith(`..${sep}`) ||
        isAbsolute(selectedRelative)
      ) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(selected);
      response.writeHead(200, { 'content-type': contentType(extname(selected)) }).end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('static server has no TCP address');
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: async () => {
      await new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error === undefined ? resolveClose() : reject(error)));
      });
    },
  };
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });
}

function contentType(extension: string): string {
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function emptyFailedReport(commands: BrowserOracleReport['commands']): BrowserOracleReport {
  return {
    status: 'failed',
    commands,
    checks: [],
    startupConsoleErrors: [],
    failedModuleLoads: [],
    externalRuntimeRequests: [],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
