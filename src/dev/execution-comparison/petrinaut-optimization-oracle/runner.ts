import { runCommand } from '../../../app/command-runner.js';
import { isPetrinautOptimizationExecutionCaseContract, loadPublicCasePacket } from '../case-contract.js';
import {
  isPetrinautOptimizationControllerOracleManifest,
  loadControllerOracleManifest,
} from '../oracle-pack.js';
import { runPetrinautBrowserChecks } from './browser.js';
import type { PetrinautOptimizationOracleReport } from './types.js';

export const PETRINAUT_FOCUSED_PREPARATION = [
  {
    id: 'design-system-codegen',
    command: 'yarn',
    args: ['workspace', '@hashintel/ds-components', 'codegen'],
  },
  {
    id: 'design-system-build',
    command: 'yarn',
    args: ['workspace', '@hashintel/ds-components', 'build'],
  },
  {
    id: 'petrinaut-core-build',
    command: 'yarn',
    args: ['workspace', '@hashintel/petrinaut-core', 'build'],
  },
  {
    id: 'optimizer-client-build',
    command: 'yarn',
    args: ['workspace', '@local/petrinaut-optimizer-client', 'build'],
  },
  {
    id: 'petrinaut-ui-build',
    command: 'yarn',
    args: ['workspace', '@hashintel/petrinaut', 'build'],
  },
] as const;

export async function runPetrinautOptimizationOracle(input: {
  readonly candidateRoot: string;
  readonly caseDir: string;
}): Promise<PetrinautOptimizationOracleReport> {
  const [packet, manifest] = await Promise.all([
    loadPublicCasePacket(input.caseDir),
    loadControllerOracleManifest(input.caseDir),
  ]);
  if (
    !isPetrinautOptimizationExecutionCaseContract(packet.contract) ||
    !isPetrinautOptimizationControllerOracleManifest(manifest)
  ) {
    throw new Error('Petrinaut optimization oracle received a different compiled case');
  }

  const preparation: PetrinautOptimizationOracleReport['preparation'][number][] = [];
  for (const step of PETRINAUT_FOCUSED_PREPARATION) {
    const result = await runCommand(step.command, step.args, {
      cwd: input.candidateRoot,
      timeoutMs: 10 * 60_000,
      maxOutputBytes: 256 * 1024,
    });
    preparation.push({
      id: step.id,
      status: result.exitCode === 0 ? 'passed' : 'failed',
      exitCode: result.exitCode,
    });
    if (result.exitCode !== 0) {
      return {
        schemaVersion: 1,
        caseId: packet.contract.case.id,
        oracleId: manifest.id,
        status: 'setup_failed',
        preparation,
        checks: [],
        setupFailure: `${step.id} exited ${result.exitCode}`,
        consoleErrors: [],
        failedRequests: [],
      };
    }
  }

  try {
    const browser = await runPetrinautBrowserChecks({
      candidateRoot: input.candidateRoot,
      contract: packet.contract,
      manifest,
    });
    return {
      schemaVersion: 1,
      caseId: packet.contract.case.id,
      oracleId: manifest.id,
      status: browser.checks.every(({ status }) => status === 'passed') ? 'passed' : 'assertion_failed',
      preparation,
      checks: browser.checks,
      consoleErrors: browser.consoleErrors,
      failedRequests: browser.failedRequests,
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      caseId: packet.contract.case.id,
      oracleId: manifest.id,
      status: 'setup_failed',
      preparation,
      checks: [],
      setupFailure: error instanceof Error ? error.message : String(error),
      consoleErrors: [],
      failedRequests: [],
    };
  }
}
