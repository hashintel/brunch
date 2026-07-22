export type ProspectResearchCheckId =
  | 'startup-and-health'
  | 'project-approval-and-research'
  | 'qualification-and-deduplication'
  | 'suppression-and-rerun'
  | 'override-and-export'
  | 'provider-failure'
  | 'restart-persistence';

export type ProspectEvidenceSource = 'browser' | 'http' | 'sqlite' | 'export' | 'process';

export interface ProspectResearchWorkspaceOracleCheck {
  readonly id: ProspectResearchCheckId;
  readonly claims: readonly string[];
  readonly status: 'passed' | 'setup_failed' | 'assertion_failed';
  readonly message: string;
  readonly evidence: readonly {
    readonly source: ProspectEvidenceSource;
    readonly detail: string;
  }[];
  readonly externalRuntimeRequests: readonly string[];
  readonly cleanup: {
    readonly processStopped: boolean;
    readonly browserClosed: boolean;
  };
}

export interface ProspectResearchWorkspaceOracleReport {
  readonly schemaVersion: 1;
  readonly caseId: 'prospect-research-workspace-v1';
  readonly oracleId: 'prospect-research-workspace-oracles-v1';
  readonly status: 'passed' | 'setup_failed' | 'assertion_failed';
  readonly commands: readonly {
    readonly id: 'test' | 'build';
    readonly command: 'npm';
    readonly args: readonly string[];
    readonly status: 'passed' | 'failed';
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
  }[];
  readonly checks: readonly ProspectResearchWorkspaceOracleCheck[];
  readonly externalRuntimeRequests: readonly string[];
  readonly setupFailure?: string;
}
