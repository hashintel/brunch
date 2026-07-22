export type PetrinautOptimizationCheckId =
  | 'route-and-accessibility'
  | 'scenario-configuration'
  | 'request-contract'
  | 'progress-and-completion'
  | 'service-error'
  | 'cancel-and-abort'
  | 'private-origin-secrecy';

export interface PetrinautOptimizationOracleCheck {
  readonly id: PetrinautOptimizationCheckId;
  readonly claims: readonly string[];
  readonly status: 'passed' | 'failed' | 'setup_failed';
  readonly evidence: readonly string[];
}

export interface PetrinautOptimizationOracleReport {
  readonly schemaVersion: 1;
  readonly caseId: 'petrinaut-optimization-v1';
  readonly oracleId: 'petrinaut-optimization-oracles-v1';
  readonly status: 'passed' | 'setup_failed' | 'assertion_failed';
  readonly preparation: readonly {
    readonly id: string;
    readonly status: 'passed' | 'failed';
    readonly exitCode: number;
  }[];
  readonly checks: readonly PetrinautOptimizationOracleCheck[];
  readonly setupFailure?: string;
  readonly consoleErrors: readonly string[];
  readonly failedRequests: readonly string[];
}
