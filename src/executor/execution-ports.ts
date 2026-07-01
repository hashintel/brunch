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

export interface TestRunnerPort {}

export interface GitLandPort {}

export interface ExecutionPorts {
  readonly gitWorktree: GitWorktreePort;
  readonly agentRunner?: AgentRunnerPort;
  readonly testRunner?: TestRunnerPort;
  readonly gitLand?: GitLandPort;
}
