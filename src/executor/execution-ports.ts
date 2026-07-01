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
  readonly signal?: AbortSignal | undefined;
}

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
  promote(args: GitLandArgs): Promise<GitLandResult>;
}

export interface ExecutionPorts {
  readonly gitWorktree: GitWorktreePort;
  readonly agentRunner: AgentRunnerPort;
  readonly testRunner: TestRunnerPort;
  readonly gitLand: GitLandPort;
}
