export interface GitWorktreeCreateArgs {
  readonly cwd: string;
  readonly worktreeDir: string;
  readonly ref: string;
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

export interface AgentRunnerPort {}

export interface TestRunArgs {
  readonly cwd: string;
  readonly worktreeDir: string;
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

export interface GitLandPort {}

export interface ExecutionPorts {
  readonly gitWorktree: GitWorktreePort;
  readonly testRunner: TestRunnerPort;
  readonly agentRunner?: AgentRunnerPort;
  readonly gitLand?: GitLandPort;
}
