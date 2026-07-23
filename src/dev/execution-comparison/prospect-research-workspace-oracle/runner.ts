import { runCommand } from '../../../app/command-runner.js';
import { isProspectResearchWorkspaceExecutionCaseContract, loadPublicCasePacket } from '../case-contract.js';
import {
  isProspectResearchWorkspaceControllerOracleManifest,
  loadControllerOracleManifest,
} from '../oracle-pack.js';
import { runManagedProspectJourney } from './journey-runner.js';
import { fixtureForCheck, prospectJourneyDefinitions } from './journeys.js';
import { openProspectJourneyEnvironment } from './lifecycle.js';
import type { ProspectResearchWorkspaceOracleCheck, ProspectResearchWorkspaceOracleReport } from './types.js';

const COMMAND_TIMEOUT_MS = 10 * 60_000;
const JOURNEY_TIMEOUT_MS = 30_000;

export async function runProspectResearchWorkspaceOracle(input: {
  readonly candidateRoot: string;
  readonly caseDir: string;
}): Promise<ProspectResearchWorkspaceOracleReport> {
  const [packet, manifest] = await Promise.all([
    loadPublicCasePacket(input.caseDir),
    loadControllerOracleManifest(input.caseDir),
  ]);
  if (
    !isProspectResearchWorkspaceExecutionCaseContract(packet.contract) ||
    !isProspectResearchWorkspaceControllerOracleManifest(manifest)
  ) {
    throw new Error('prospect research oracle received a different compiled case');
  }

  const commands: ProspectResearchWorkspaceOracleReport['commands'][number][] = [];
  for (const step of [
    { id: 'test', command: 'npm', args: ['test'] },
    { id: 'build', command: 'npm', args: ['run', 'build'] },
  ] as const) {
    const result = await runCommand(step.command, step.args, {
      cwd: input.candidateRoot,
      timeoutMs: COMMAND_TIMEOUT_MS,
      maxOutputBytes: 256 * 1024,
    });
    commands.push({
      ...step,
      status: result.exitCode === 0 ? 'passed' : 'failed',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    if (result.exitCode !== 0) {
      return {
        schemaVersion: 1,
        caseId: packet.contract.case.id,
        oracleId: manifest.id,
        status: 'setup_failed',
        commands,
        checks: [],
        externalRuntimeRequests: [],
        setupFailure: `${step.command} ${step.args.join(' ')} exited ${result.exitCode}`,
      };
    }
  }

  const definitions = prospectJourneyDefinitions({
    caseDir: input.caseDir,
    contract: packet.contract,
    manifest,
  });
  const checks: ProspectResearchWorkspaceOracleCheck[] = [];
  for (const declared of manifest.checks) {
    const definition = definitions.get(declared.id);
    if (definition === undefined) throw new Error(`missing prospect journey implementation: ${declared.id}`);
    const result = await runManagedProspectJourney({
      open: async () =>
        await openProspectJourneyEnvironment({
          candidateRoot: input.candidateRoot,
          fixtureSource: fixtureForCheck(input.caseDir, declared.id),
        }),
      setup: async () => {},
      assert: definition,
      close: async (environment) => await environment.close(),
      timeoutMs: JOURNEY_TIMEOUT_MS,
    });
    const environment = result.context;
    checks.push({
      id: declared.id,
      claims: declared.claims,
      status: result.status,
      message: result.message,
      evidence: environment?.evidence ?? [],
      externalRuntimeRequests: environment?.externalRuntimeRequests ?? [],
      cleanup: environment?.cleanup ?? { processStopped: true, browserClosed: true },
    });
  }

  const externalRuntimeRequests = [...new Set(checks.flatMap((check) => check.externalRuntimeRequests))];
  return {
    schemaVersion: 1,
    caseId: packet.contract.case.id,
    oracleId: manifest.id,
    status: checks.some(({ status }) => status === 'setup_failed')
      ? 'setup_failed'
      : checks.some(({ status }) => status === 'assertion_failed')
        ? 'assertion_failed'
        : 'passed',
    commands,
    checks,
    externalRuntimeRequests,
  };
}
