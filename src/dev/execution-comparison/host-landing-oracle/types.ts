export const HOST_LANDING_CASE_ID = 'brunch-host-landing-v1' as const;
export const HOST_LANDING_ORACLE_ID = 'brunch-host-landing-oracles-v1' as const;
export const HOST_LANDING_RUN_ID = 'run-1';
export const HOST_LANDING_REVIEW_REF = `brunch/review/${HOST_LANDING_RUN_ID}`;

export type HostLandingScenario =
  | 'brownfield_success'
  | 'greenfield_success'
  | 'decline'
  | 'dirty_host'
  | 'conflict'
  | 'stale_acceptance'
  | 'final_commit_only'
  | 'bookkeeping_retained';

export interface GitStateSnapshot {
  readonly head: string;
  readonly tree: string;
  readonly status: string;
  readonly runMetadataSha256: string;
  readonly runMetadataBytes: string;
}

export interface HostLandingOracleCheck {
  readonly id:
    | 'public-tui-preflight'
    | 'brownfield-full-range'
    | 'greenfield-materialization'
    | 'refusal-safety';
  readonly claims: readonly string[];
  readonly status: 'passed' | 'failed';
  readonly evidence: readonly string[];
}

export interface HostLandingOracleReport {
  readonly schemaVersion: 1;
  readonly caseId: typeof HOST_LANDING_CASE_ID;
  readonly oracleId: typeof HOST_LANDING_ORACLE_ID;
  readonly status: 'passed' | 'assertion_failed' | 'setup_failed';
  readonly scenario: HostLandingScenario;
  readonly checks: readonly HostLandingOracleCheck[];
  readonly terminalEvidence: readonly string[];
  readonly gitEvidence: {
    readonly before: GitStateSnapshot;
    readonly preConfirm: GitStateSnapshot;
    readonly after: GitStateSnapshot;
    readonly expectedTree: string;
    readonly actualTree: string;
    readonly changedPaths: readonly string[];
  };
  readonly setupFailure?: string;
}

export interface HostLandingFixture {
  readonly root: string;
  readonly hostDir: string;
  readonly runRepoDir: string;
  readonly targetDir?: string;
  readonly runBaseSha: string;
  readonly reviewSha: string;
  readonly canonicalExpectedTree: string;
  readonly metadataPath: string;
  readonly sessionFile: string;
}
