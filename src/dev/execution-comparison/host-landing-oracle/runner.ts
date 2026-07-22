import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  removeSession,
  sendKeys,
  sendText,
  sessionStatus,
  startSession,
  stopSession,
  waitForScreenText,
} from '../../tui-driver.js';
import { advanceHostLandingReviewRef, createHostLandingFixture } from './fixture.js';
import { emptyGitStateSnapshot, evaluateHostLandingGitOutcome, snapshotGitState } from './git-model.js';
import {
  HOST_LANDING_CASE_ID,
  HOST_LANDING_ORACLE_ID,
  HOST_LANDING_RUN_ID,
  type HostLandingFixture,
  type HostLandingOracleReport,
  type HostLandingScenario,
} from './types.js';

export async function runBrunchHostLandingOracle(input: {
  readonly candidateRoot: string;
  readonly scenario?: HostLandingScenario;
  readonly sessionMode?: 'settled' | 'fresh';
  readonly keepFixture?: boolean;
}): Promise<HostLandingOracleReport> {
  const scenario = input.scenario ?? 'brownfield_success';
  const candidateRoot = resolve(input.candidateRoot);
  let fixture: HostLandingFixture | undefined;
  try {
    fixture = await createHostLandingFixture(candidateRoot, scenario, input.sessionMode ?? 'settled');
    return await driveCandidateTui({ candidateRoot, fixture, scenario });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const empty = emptyGitStateSnapshot();
    return {
      schemaVersion: 1,
      caseId: HOST_LANDING_CASE_ID,
      oracleId: HOST_LANDING_ORACLE_ID,
      status: 'setup_failed',
      scenario,
      checks: [],
      terminalEvidence: [],
      gitEvidence: {
        before: empty,
        preConfirm: empty,
        after: empty,
        expectedTree: '',
        actualTree: '',
        changedPaths: [],
      },
      setupFailure: detail,
    };
  } finally {
    if (fixture && !input.keepFixture) await rm(fixture.root, { recursive: true, force: true });
  }
}

async function driveCandidateTui(input: {
  readonly candidateRoot: string;
  readonly fixture: HostLandingFixture;
  readonly scenario: HostLandingScenario;
}): Promise<HostLandingOracleReport> {
  if (!input.fixture.sessionFile) throw new Error('controller supplied no settled session');
  const sessionBefore = await readFile(input.fixture.sessionFile, 'utf8');
  if (!sessionBefore.includes('"role":"assistant"') && !sessionBefore.includes('"role": "assistant"')) {
    throw new Error('controller session fixture is not settled');
  }
  const before = await snapshotGitState(input.fixture.hostDir, input.fixture.metadataPath);
  const name = `host-land-${randomUUID()}`;
  const command = [
    '/usr/bin/env',
    'PI_OFFLINE=1',
    'PI_SKIP_VERSION_CHECK=1',
    process.execPath,
    join(input.candidateRoot, 'bin', 'brunch.js'),
    '--cwd',
    input.fixture.hostDir,
    '--no-webui',
  ];
  await startSession({ name, command, cols: 120, rows: 40, cwd: input.candidateRoot });
  const terminalEvidence: string[] = [];
  try {
    terminalEvidence.push(...(await wait(name, 'Continue your latest spec and session')));
    sendKeys(name, ['Up', 'Up', 'Up', 'Enter']);
    await wait(name, 'What does this specification own?');
    sendKeys(name, ['Down', 'Enter']);
    await wait(name, 'Does this build on the existing code here?');
    sendKeys(name, ['Enter']);
    await wait(name, 'Choose how Specify mode should work');
    sendKeys(name, ['Esc']);
    terminalEvidence.push(...(await wait(name, 'Settled controller session.')));
    const commandText =
      input.scenario === 'greenfield_success'
        ? `/brunch:land ${HOST_LANDING_RUN_ID} ${input.fixture.targetDir}`
        : `/brunch:land ${HOST_LANDING_RUN_ID}`;
    terminalEvidence.push(`controller invoked ${commandText}`);
    sendText(name, commandText);
    sendKeys(name, ['Enter']);
    const expectsConfirmation = !['dirty_host', 'conflict'].includes(input.scenario);
    if (expectsConfirmation) {
      terminalEvidence.push(...(await wait(name, 'Proceed with this host mutation?')));
    } else {
      terminalEvidence.push(...(await wait(name, 'Nothing changed')));
    }
    const preConfirm = await snapshotGitState(input.fixture.hostDir, input.fixture.metadataPath);
    if (input.scenario === 'stale_acceptance') {
      await advanceHostLandingReviewRef(input.fixture);
    }
    if (expectsConfirmation) {
      if (input.scenario === 'decline') sendKeys(name, ['Down', 'Enter']);
      else sendKeys(name, ['Enter']);
      const terminal = await wait(
        name,
        input.scenario === 'decline'
          ? 'declined; nothing changed'
          : input.scenario === 'stale_acceptance'
            ? 'ref_moved'
            : `Landed ${HOST_LANDING_RUN_ID}`,
      );
      terminalEvidence.push(...terminal);
    }
    const sessionAfter = await readFile(input.fixture.sessionFile, 'utf8');
    const providerActivity =
      messageCount(sessionAfter) !== messageCount(sessionBefore) ||
      sessionAfter.includes('"customType":"brunch.kick"') ||
      sessionAfter.includes('"customType": "brunch.kick"');
    const evaluated = await evaluateHostLandingGitOutcome({
      scenario: input.scenario,
      hostDir: input.fixture.hostDir,
      ...(input.fixture.targetDir ? { targetDir: input.fixture.targetDir } : {}),
      metadataPath: input.fixture.metadataPath,
      canonicalExpectedTree: input.fixture.canonicalExpectedTree,
      before,
      preConfirm,
      terminalEvidence,
      providerActivity,
    });
    return {
      schemaVersion: 1,
      caseId: HOST_LANDING_CASE_ID,
      oracleId: HOST_LANDING_ORACLE_ID,
      scenario: input.scenario,
      ...evaluated,
    };
  } finally {
    await stopSession(name);
    removeSession(name, { force: true });
  }
}

async function wait(name: string, text: string): Promise<string[]> {
  const status = sessionStatus(name);
  if (!status) throw new Error(`TUI driver session ${name} disappeared`);
  const result = await waitForScreenText(status.logPath, status.cols, status.rows, text, {
    timeoutMs: 30_000,
  });
  if (!result.matched) {
    throw new Error(`candidate TUI did not render ${JSON.stringify(text)}\n${result.screen.join('\n')}`);
  }
  return result.screen;
}

function messageCount(raw: string): number {
  return raw
    .split('\n')
    .filter((line) => line.includes('"type":"message"') || line.includes('"type": "message"')).length;
}
