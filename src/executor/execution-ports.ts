export interface GitWorktreeCreateArgs {
  readonly cwd: string;
  readonly worktreeDir: string;
  readonly ref: string;
  readonly signal?: AbortSignal | undefined;
}

export type GitWorktreeCreateResult =
  | {
      readonly status: 'created';
      readonly worktreeDir: string;
      /** Resolved commit the worktree was created at — the run's durable base (runBaseSha). */
      readonly createdFromSha: string;
      readonly sideEffects: readonly [
        { readonly kind: 'git_worktree_add'; readonly path: string; readonly ref: string },
      ];
    }
  | {
      readonly status: 'failed';
      readonly worktreeDir: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    };

export interface GitWorktreePort {
  create(args: GitWorktreeCreateArgs): Promise<GitWorktreeCreateResult>;
}

export interface GitSliceWorkspaceArgs {
  readonly runWorktreeDir: string;
  readonly sliceWorktreeDir: string;
  readonly sliceId: string;
}

export type GitSliceWorkspaceResult =
  | {
      readonly status: 'prepared';
      readonly baseSha: string;
      readonly sideEffects: readonly {
        readonly kind: 'git_worktree_add';
        readonly path: string;
        readonly ref: string;
      }[];
    }
  | { readonly status: 'failed'; readonly message: string; readonly sideEffects: readonly [] };

export interface GitSliceIntegrateArgs extends GitSliceWorkspaceArgs {
  readonly baseSha: string;
}

export type GitSliceIntegrateEffect =
  | { readonly kind: 'git_commit'; readonly path: string; readonly sha: string }
  | { readonly kind: 'git_integrate'; readonly path: string; readonly sha: string };

export type GitSliceIntegrateResult =
  | {
      readonly status: 'integrated';
      readonly sliceCommitSha: string;
      readonly integrationCommitSha: string;
      readonly sideEffects: readonly GitSliceIntegrateEffect[];
    }
  | {
      readonly status: 'conflict';
      readonly message: string;
      readonly sideEffects: readonly GitSliceIntegrateEffect[];
    }
  | {
      readonly status: 'failed';
      readonly message: string;
      readonly sideEffects: readonly GitSliceIntegrateEffect[];
    };

export interface GitSliceIntegrationPort {
  prepare(args: GitSliceWorkspaceArgs): Promise<GitSliceWorkspaceResult>;
  integrate(args: GitSliceIntegrateArgs): Promise<GitSliceIntegrateResult>;
}

export interface AgentRunArgs {
  readonly worktreeDir: string;
  readonly requestPath: string;
  readonly resultPath: string;
  readonly runId: string;
  readonly epicId?: string;
  readonly sliceId: string;
  readonly runtime?: AgentRunnerRuntime;
  readonly onUpdate?: (update: AgentRunUpdate) => void | Promise<void>;
}

export interface AgentRunUpdate {
  readonly kind: 'status' | 'message' | 'tool';
  readonly message: string;
}

export interface AgentRunnerRuntime {
  readonly modelRegistry?: unknown;
  readonly model?: unknown;
  readonly signal?: AbortSignal;
}

export type AgentRunResult =
  | {
      readonly status: 'completed';
      readonly summary?: string;
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

export interface AgentRunnerPort {
  run(args: AgentRunArgs): Promise<AgentRunResult>;
}

export interface TestRunArgs {
  readonly worktreeDir: string;
  readonly verifyTarget?: VerifyTarget | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly onUpdate?: (update: TestRunUpdate) => void | Promise<void>;
}

export interface VerifyTarget {
  readonly command: string;
  readonly args: readonly string[];
}

export type TestRunUpdate =
  | { readonly kind: 'status'; readonly message: string }
  | { readonly kind: 'stdout' | 'stderr'; readonly message: string };

export type TestRunResult =
  | {
      readonly status: 'completed';
      readonly verdict: 'passed' | 'failed';
      readonly exitCode: number;
      readonly target?: string;
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

export interface TestRunnerPort {
  run(args: TestRunArgs): Promise<TestRunResult>;
}

export interface GitLandArgs {
  readonly worktreeDir: string;
  readonly message: string;
  readonly baseSha: string;
  readonly reviewBranch: string;
}

export type GitLandSideEffect =
  | { readonly kind: 'git_commit'; readonly path: string; readonly sha: string }
  | { readonly kind: 'git_ref_create'; readonly path: string; readonly ref: string; readonly sha: string };

export type GitHeadResult =
  | {
      readonly status: 'ok';
      readonly commitSha: string;
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

export type GitRefResult =
  | {
      readonly status: 'ok';
      readonly commitSha: string;
    }
  | {
      readonly status: 'missing';
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

export type GitLandResult =
  | {
      readonly status: 'promoted';
      readonly commitSha: string;
      readonly reviewBranch: string;
      readonly sideEffects: readonly GitLandSideEffect[];
    }
  | {
      readonly status: 'no_changes';
      readonly message: string;
      readonly commitSha?: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'failed';
      readonly message: string;
      readonly sideEffects: readonly GitLandSideEffect[];
    };

export interface GitLandPort {
  currentHead(args: { readonly worktreeDir: string }): Promise<GitHeadResult>;
  resolveRef(args: { readonly worktreeDir: string; readonly ref: string }): Promise<GitRefResult>;
  promote(args: GitLandArgs): Promise<GitLandResult>;
}

export interface GitHostLandIntegrateArgs {
  /** Host repository root whose checked-out branch receives the run. */
  readonly hostDir: string;
  /** Review branch name (e.g. brunch/review/<runId>) — already visible in the
      host ref store because git_worktree runs share it. */
  readonly reviewRef: string;
  /** Acceptance binding: refuse if the review ref no longer points here. */
  readonly expectedTipSha: string;
  /** Merge commit subject when a fast-forward is impossible. */
  readonly message: string;
}

export type GitHostLandIntegrateResult =
  | {
      readonly status: 'landed';
      readonly via: 'fast_forward' | 'merge';
      readonly branch: string;
      readonly landedSha: string;
      readonly sideEffects: readonly [
        {
          readonly kind: 'host_branch_advance';
          readonly path: string;
          readonly branch: string;
          readonly sha: string;
        },
      ];
    }
  | {
      readonly status: 'refused';
      readonly reason: 'detached' | 'dirty' | 'ref_moved' | 'untracked_collision' | 'not_a_repo_root';
      readonly paths?: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'conflict';
      readonly conflictedPaths: readonly string[];
      readonly sideEffects: readonly [];
    }
  | { readonly status: 'failed'; readonly message: string; readonly sideEffects: readonly [] };

export interface GitHostLandMaterializeArgs {
  /** Run repository (worktree) holding the promoted objects. */
  readonly runWorktreeDir: string;
  readonly reviewRef: string;
  readonly expectedTipSha: string;
  /** Target directory — must be missing or empty. */
  readonly targetDir: string;
  /** Initial branch of the materialized repository (normally main). */
  readonly branch: string;
  /** Subject of the single clean initial commit. */
  readonly message: string;
}

export type GitHostLandMaterializeResult =
  | {
      readonly status: 'landed';
      readonly branch: string;
      readonly landedSha: string;
      readonly targetDir: string;
      readonly sideEffects: readonly [
        {
          readonly kind: 'git_materialize';
          readonly path: string;
          readonly branch: string;
          readonly sha: string;
        },
      ];
    }
  | {
      readonly status: 'refused';
      readonly reason: 'occupied_target' | 'target_aliases_run' | 'target_inside_run' | 'ref_moved';
      readonly sideEffects: readonly [];
    }
  | { readonly status: 'failed'; readonly message: string; readonly sideEffects: readonly [] };

/**
 * Mode-aware landing of a promoted run into the host (FE-1201). Brownfield
 * `integrate` advances the host's checked-out branch from the shared review
 * ref (ff when possible, brunch-authored merge otherwise; conflicts abort back
 * to a pristine host). Greenfield `materialize` turns the promoted tip tree
 * into a fresh repository with one clean brunch-authored initial commit.
 * Both transport the complete runBaseSha..tip result — never a diff window.
 */
export interface GitHostLandPort {
  integrate(args: GitHostLandIntegrateArgs): Promise<GitHostLandIntegrateResult>;
  materialize(args: GitHostLandMaterializeArgs): Promise<GitHostLandMaterializeResult>;
}

export interface PlannerRuntime {
  readonly modelRegistry?: unknown;
  readonly model?: unknown;
  readonly signal?: AbortSignal;
}

export type PlannerSynthesisResult =
  | { readonly status: 'synthesized'; readonly candidate: unknown }
  | { readonly status: 'failed'; readonly message: string };

// The non-deterministic planner behind a sealed port (FE-1197): it receives the bounded
// planning projection plus exact validation findings on repair rounds, and returns raw
// candidate material. Parsing, validation, and admission stay deterministic executor code.
export interface PlannerPort {
  synthesize(args: {
    readonly projection: unknown;
    readonly capabilityVocabulary?: readonly string[];
    readonly findings?: readonly { readonly code: string; readonly message: string }[];
    readonly priorCandidate?: unknown;
    readonly runtime?: PlannerRuntime;
  }): Promise<PlannerSynthesisResult>;
}

export interface ExecutionPorts {
  readonly planner?: PlannerPort;
  readonly gitWorktree: GitWorktreePort;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
  readonly agentRunner: AgentRunnerPort;
  readonly testRunner: TestRunnerPort;
  readonly gitLand: GitLandPort;
  readonly gitHostLand: GitHostLandPort;
}
