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

export interface AgentRunArgs {
  readonly worktreeDir: string;
  readonly requestPath: string;
  readonly resultPath: string;
  readonly runId: string;
  readonly epicId: string;
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
  readonly verifyCommand?: readonly string[];
  readonly signal?: AbortSignal | undefined;
  readonly onUpdate?: (update: TestRunUpdate) => void | Promise<void>;
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
}

export type GitHeadResult =
  | {
      readonly status: 'ok';
      readonly commitSha: string;
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

export type GitLandResult =
  | {
      readonly status: 'promoted';
      readonly commitSha: string;
      readonly sideEffects: readonly [
        { readonly kind: 'git_commit'; readonly path: string; readonly sha: string },
      ];
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
      readonly sideEffects: readonly [];
    };

export interface GitLandPort {
  currentHead(args: { readonly worktreeDir: string }): Promise<GitHeadResult>;
  promote(args: GitLandArgs): Promise<GitLandResult>;
}

export interface GitHostPromotionPreflightArgs {
  readonly cwd: string;
  readonly worktreeDir: string;
  readonly commitSha: string;
}

export type GitHostPromotionPreflightResult =
  | {
      readonly status: 'ok';
      readonly baseSha: string;
      readonly commitSha: string;
      readonly changedFiles: readonly string[];
      readonly patchSummary: string;
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

export interface GitHostPromotionPreflightPort {
  preflight(args: GitHostPromotionPreflightArgs): Promise<GitHostPromotionPreflightResult>;
}

export interface GitHostPromotionApplyArgs {
  readonly cwd: string;
  readonly worktreeDir: string;
  readonly baseSha: string;
  readonly commitSha: string;
  readonly changedFiles: readonly string[];
}

export type GitHostPromotionApplyResult =
  | {
      readonly status: 'applied';
      readonly changedFiles: readonly string[];
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

export interface GitHostPromotionPort extends GitHostPromotionPreflightPort {
  apply(args: GitHostPromotionApplyArgs): Promise<GitHostPromotionApplyResult>;
}

export interface ExecutionPorts {
  readonly gitWorktree: GitWorktreePort;
  readonly agentRunner: AgentRunnerPort;
  readonly testRunner: TestRunnerPort;
  readonly gitLand: GitLandPort;
  readonly gitHostPromotion: GitHostPromotionPort;
}
