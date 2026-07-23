import { join } from 'node:path';

import type { Page } from 'playwright-core';

import type { ProspectResearchWorkspaceExecutionCasePublicContract } from '../case-contract.js';
import type { ProspectResearchWorkspaceControllerOracleManifest } from '../oracle-pack.js';
import type { ProspectJourneyEnvironment } from './lifecycle.js';
import { expectedResearchState } from './reference.js';
import { rows, snapshotSqlite } from './sqlite-evidence.js';
import type { ProspectResearchCheckId } from './types.js';

interface AppState {
  readonly projects: readonly { readonly id: number; readonly approved: boolean }[];
  readonly runs: readonly { readonly status: string; readonly error: string | null }[];
  readonly prospects: readonly {
    readonly id: number;
    readonly person: string;
    readonly company: string;
    readonly email: string;
    readonly automatedStatus: string;
    readonly currentStatus: string;
    readonly suppressed: boolean;
    readonly approved: boolean;
    readonly sources: readonly string[];
  }[];
  readonly decisions: readonly {
    readonly kind: string;
    readonly previousStatus: string | null;
    readonly nextStatus: string;
    readonly reason: string | null;
  }[];
}

type Journey = (environment: ProspectJourneyEnvironment) => Promise<void>;

export function prospectJourneyDefinitions(input: {
  readonly caseDir: string;
  readonly contract: ProspectResearchWorkspaceExecutionCasePublicContract;
  readonly manifest: ProspectResearchWorkspaceControllerOracleManifest;
}): ReadonlyMap<ProspectResearchCheckId, Journey> {
  const researchFixture = join(input.caseDir, 'controller', 'fixtures', 'research-batch.json');
  return new Map([
    [
      'startup-and-health',
      async (environment) => {
        const { page } = environment;
        await requireCount(
          page.getByRole('application', { name: input.contract.accessibility.application.name, exact: true }),
          1,
          'application shell',
        );
        await requireCount(
          page.getByRole('heading', { name: input.contract.accessibility.projects.name, exact: true }),
          1,
          'projects heading',
        );
        await requireCount(
          page.getByRole('region', { name: input.contract.accessibility.queue.name, exact: true }),
          1,
          'prospect queue',
        );
        for (const field of input.contract.accessibility.fields) {
          await requireCount(
            page.getByRole(field.role as 'textbox', { name: field.name, exact: true }),
            1,
            field.name,
          );
        }
        for (const control of input.contract.accessibility.controls) {
          await requireCount(
            page.getByRole(control.role as 'button', { name: control.name, exact: true }),
            1,
            control.name,
          );
        }
        const state = await httpState(environment);
        assert(state.projects.length === 0, 'fresh HTTP state contains projects');
        const sqlite = snapshotSqlite(environment.databasePath);
        assert(rows(sqlite, 'projects').length === 0, 'fresh SQLite state contains projects');
        environment.evidence.push(
          { source: 'browser', detail: 'accessible React shell and all declared controls are reachable' },
          { source: 'sqlite', detail: 'fresh durable store contains zero projects' },
        );
        assertNoExternalRequests(environment);
      },
    ],
    [
      'project-approval-and-research',
      async (environment) => {
        await createProject(environment.page);
        const unapproved = await action(environment.page, 'Run research', '/api/projects/', 'research');
        assert(unapproved.status === 409, `unapproved research returned ${unapproved.status}`);
        let state = await httpState(environment);
        assert(state.runs.length === 0, 'unapproved research created a run');
        await action(environment.page, 'Approve project', '/approve');
        await action(environment.page, 'Run research', '/research');
        state = await httpState(environment);
        assert(
          state.runs.length === 1 && state.runs[0]?.status === 'completed',
          'approved run not completed once',
        );
        const sqlite = snapshotSqlite(environment.databasePath);
        assert(rows(sqlite, 'runs').length === 1, 'SQLite did not retain exactly one run');
        environment.evidence.push(
          {
            source: 'browser',
            detail: 'research was refused before approval and completed after explicit approval',
          },
          { source: 'sqlite', detail: 'one completed manual run retained durably' },
        );
        assertNoExternalRequests(environment);
      },
    ],
    [
      'qualification-and-deduplication',
      async (environment) => {
        await createApprovedResearch(environment.page);
        const state = await httpState(environment);
        const expected = await expectedResearchState(researchFixture);
        assert(
          state.prospects.length === expected.length,
          'HTTP prospect identities differ from reference model',
        );
        for (const prospect of expected) {
          const actual = state.prospects.find(({ email }) => email === prospect.email);
          assert(actual !== undefined, `missing normalized prospect ${prospect.email}`);
          assert(
            actual.automatedStatus === prospect.automatedStatus,
            `${prospect.email} qualification is not evidence-backed`,
          );
          assert(
            sameStrings(actual.sources, prospect.sources),
            `${prospect.email} provenance was not retained`,
          );
        }
        const sqlite = snapshotSqlite(environment.databasePath);
        const ari = rows(sqlite, 'prospects').filter(({ email }) => email === 'ari@arc.example');
        assert(ari.length === 1, 'SQLite contains duplicate Ari identities');
        assert(
          rows(sqlite, 'provenance').filter(({ prospect_id }) => prospect_id === ari[0]?.['id']).length === 2,
          'SQLite discarded one Ari provenance row',
        );
        environment.evidence.push(
          {
            source: 'http',
            detail: 'state API agrees with the controller qualification/deduplication model',
          },
          { source: 'sqlite', detail: 'one normalized Ari identity retains two independent provenance rows' },
        );
        assertNoExternalRequests(environment);
      },
    ],
    [
      'suppression-and-rerun',
      async (environment) => {
        await createApprovedResearch(environment.page);
        await selectProspect(environment.page, 'Sam Reed', 'Muted Systems');
        await environment.page
          .getByRole('textbox', { name: 'Decision reason', exact: true })
          .fill('Existing customer');
        await action(environment.page, 'Suppress prospect', '/suppress');
        await action(environment.page, 'Run research', '/research');
        const state = await httpState(environment);
        const sam = requiredProspect(state, 'sam@muted.example');
        assert(sam.suppressed, 'suppression did not dominate the later research run');
        const exported = await exportApproved(environment.page);
        assert(!exported.some(({ email }) => email === sam.email), 'suppressed prospect entered export');
        const sqlite = snapshotSqlite(environment.databasePath);
        assert(rows(sqlite, 'suppressions').length === 1, 'SQLite suppression history missing');
        assert(rows(sqlite, 'runs').length === 2, 'rerun was not retained independently');
        environment.evidence.push(
          { source: 'browser', detail: 'selected prospect remained suppressed after a second manual run' },
          { source: 'sqlite', detail: 'suppression and both runs remain durable' },
          { source: 'export', detail: 'suppressed identity is absent from downloaded JSON' },
        );
        assertNoExternalRequests(environment);
      },
    ],
    [
      'override-and-export',
      async (environment) => {
        await createApprovedResearch(environment.page);
        await selectProspect(environment.page, 'Noor Vale', 'Arc Labs');
        const reasonless = await action(environment.page, 'Override qualification', '/override');
        assert(reasonless.status === 400, `reasonless override returned ${reasonless.status}`);
        await environment.page
          .getByRole('textbox', { name: 'Decision reason', exact: true })
          .fill('Role confirmed by operator');
        await action(environment.page, 'Override qualification', '/override');
        await selectProspect(environment.page, 'Ari Lane', 'Arc Labs');
        await action(environment.page, 'Approve prospect', '/approve');
        const state = await httpState(environment);
        const noor = requiredProspect(state, 'noor@arc.example');
        assert(
          noor.currentStatus === 'qualified' && !noor.approved,
          'reasoned override or approval boundary is wrong',
        );
        const overrides = state.decisions.filter(({ kind }) => kind === 'override');
        assert(overrides.length === 1, 'reasonless override mutated audit history');
        assert(
          overrides[0]?.previousStatus === 'needs_review' &&
            overrides[0].nextStatus === 'qualified' &&
            overrides[0].reason === 'Role confirmed by operator',
          'override did not preserve prior decision and reason',
        );
        const exported = await exportApproved(environment.page);
        assert(
          exported.length === 1 && exported[0]?.email === 'ari@arc.example',
          'export contains prospects outside the explicitly approved non-suppressed subset',
        );
        const sqlite = snapshotSqlite(environment.databasePath);
        assert(
          rows(sqlite, 'decisions').some(
            ({ kind, previous_status, next_status, reason }) =>
              kind === 'override' &&
              previous_status === 'needs_review' &&
              next_status === 'qualified' &&
              reason === 'Role confirmed by operator',
          ),
          'SQLite override audit is incomplete',
        );
        environment.evidence.push(
          { source: 'sqlite', detail: 'reasoned override retains previous and next automated decisions' },
          { source: 'export', detail: 'download contains only explicitly approved Ari Lane' },
        );
        assertNoExternalRequests(environment);
      },
    ],
    [
      'provider-failure',
      async (environment) => {
        await createProject(environment.page);
        await action(environment.page, 'Approve project', '/approve');
        const response = await action(environment.page, 'Run research', '/research');
        assert(response.status === 503, `provider failure returned ${response.status}`);
        const state = await httpState(environment);
        assert(
          state.runs.length === 1 && state.runs[0]?.status === 'failed' && state.runs[0].error !== null,
          'provider failure was not retained honestly',
        );
        assert(state.prospects.length === 0, 'provider failure created prospect decisions');
        const sqlite = snapshotSqlite(environment.databasePath);
        assert(rows(sqlite, 'prospects').length === 0, 'provider failure corrupted prior prospect state');
        assert(rows(sqlite, 'decisions').length === 0, 'provider failure was laundered into rejection');
        environment.evidence.push(
          { source: 'http', detail: 'provider failure remains a distinct 503 response and failed run' },
          { source: 'sqlite', detail: 'failure produced no prospect or rejection decision rows' },
        );
        assertNoExternalRequests(environment);
      },
    ],
    [
      'restart-persistence',
      async (environment) => {
        await createApprovedResearch(environment.page);
        await selectProspect(environment.page, 'Noor Vale', 'Arc Labs');
        await environment.page
          .getByRole('textbox', { name: 'Decision reason', exact: true })
          .fill('Durable operator decision');
        await action(environment.page, 'Override qualification', '/override');
        await selectProspect(environment.page, 'Ari Lane', 'Arc Labs');
        await action(environment.page, 'Approve prospect', '/approve');
        const before = await httpState(environment);
        const beforeExport = await exportApproved(environment.page);
        await environment.restart();
        const after = await httpState(environment);
        const afterExport = await exportApproved(environment.page);
        assert(JSON.stringify(after) === JSON.stringify(before), 'restart changed durable API state');
        assert(
          JSON.stringify(afterExport) === JSON.stringify(beforeExport),
          'restart changed export eligibility',
        );
        const sqlite = snapshotSqlite(environment.databasePath);
        assert(rows(sqlite, 'projects').length === 1, 'project missing after restart');
        assert(
          rows(sqlite, 'decisions').some(({ kind }) => kind === 'override'),
          'override history missing after restart',
        );
        environment.evidence.push(
          {
            source: 'browser',
            detail: 'fresh browser context rehydrated the complete workspace after restart',
          },
          { source: 'http', detail: 'pre/post restart state API bytes are equivalent' },
          {
            source: 'sqlite',
            detail: 'project, prospects, decisions, and approval remain in the same database',
          },
          { source: 'export', detail: 'approved-only export is stable across restart' },
        );
        assertNoExternalRequests(environment);
      },
    ],
  ]);
}

export function fixtureForCheck(caseDir: string, id: ProspectResearchCheckId): string {
  const name = id === 'provider-failure' ? 'provider-failure.json' : 'research-batch.json';
  return join(caseDir, 'controller', 'fixtures', name);
}

async function createProject(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Founder-led B2B');
  await page
    .getByRole('textbox', { name: 'Ideal customer profile', exact: true })
    .fill('B2B workflow software with a growth leader');
  await action(page, 'Create project', '/api/projects');
}

async function createApprovedResearch(page: Page): Promise<void> {
  await createProject(page);
  await action(page, 'Approve project', '/approve');
  await action(page, 'Run research', '/research');
}

async function action(
  page: Page,
  buttonName: string,
  ...urlParts: string[]
): Promise<{ readonly status: number }> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && urlParts.every((part) => response.url().includes(part)),
  );
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const response = await responsePromise;
  return { status: response.status() };
}

async function selectProspect(page: Page, person: string, company: string): Promise<void> {
  await page.getByRole('button', { name: `Prospect: ${person} at ${company}`, exact: true }).click();
}

async function httpState(environment: ProspectJourneyEnvironment): Promise<AppState> {
  const response = await fetch(`${environment.origin}/api/state`);
  assert(response.ok, `GET /api/state returned ${response.status}`);
  environment.evidence.push({ source: 'http', detail: 'controller read same-origin /api/state directly' });
  return (await response.json()) as AppState;
}

async function exportApproved(page: Page): Promise<readonly { readonly email: string }[]> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export approved prospects', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { email: string }[];
}

function requiredProspect(state: AppState, email: string): AppState['prospects'][number] {
  const prospect = state.prospects.find((candidate) => candidate.email === email);
  if (prospect === undefined) throw new Error(`missing prospect ${email}`);
  return prospect;
}

function assertNoExternalRequests(environment: ProspectJourneyEnvironment): void {
  assert(
    environment.externalRuntimeRequests.length === 0,
    `external runtime requests: ${environment.externalRuntimeRequests.join(', ')}`,
  );
}

async function requireCount(
  locator: ReturnType<Page['getByRole']>,
  expected: number,
  label: string,
): Promise<void> {
  const actual = await locator.count();
  assert(actual === expected, `${label}: expected ${expected}, received ${actual}`);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
