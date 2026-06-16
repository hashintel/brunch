// Which presenter renders a CLI run, chosen from command + environment.
//
// Pure so the decision is testable without a real TTY. `ink` is the
// interactive full-screen TUI (slice 2); `plain` is line-oriented for
// CI / non-TTY / piped output; `silent` keeps stdout clean for the
// `agent` JSONL protocol. An explicit `--reporter` flag overrides the
// environment entirely. (`json` is intentionally not modeled yet — no
// consumer exists; add it when one does.)

export type PresenterKind = 'ink' | 'plain' | 'silent';

export type PresenterCommand = 'plan' | 'cook' | 'serve' | 'agent';

export type SelectPresenterEnv = {
  command: PresenterCommand;
  isTTY: boolean;
  ci: boolean;
  reporterFlag?: PresenterKind;
};

export function selectPresenter(env: SelectPresenterEnv): PresenterKind {
  if (env.reporterFlag) return env.reporterFlag;
  if (env.command === 'agent') return 'silent';
  if (env.ci || !env.isTTY) return 'plain';
  return 'ink';
}
