import { spawnSync } from 'node:child_process';

import { defaultToolchain, type RunnerDiagnostics, type Toolchain } from './project-profile.js';
import type { ConfinedSpawn } from './sandbox-guard.js';
import type {
  TestFailureKind,
  TestResult,
  TestRunner,
  VerificationOutcome,
  VerificationResult,
} from './types.js';

// Shell-reported "the runner binary doesn't exist" — the cross-platform spawn
// `error` (ENOENT) is the primary signal; these catch the case where a shell
// wrapper swallows that into a normal non-zero exit instead.
const RUNNER_MISSING_PATTERNS: readonly RegExp[] = [
  /command not found/i,
  /is not recognized as an internal or external command/i,
];

/**
 * FE-884 Slice B: the verify subprocess timeout. Sized well above a real test
 * run because the wait includes `npx`/runner resolution + framework warmup +
 * code-split lazy loading (a single code-split route test was observed at ~25s),
 * so the prior 60s ceiling spuriously `ETIMEDOUT`-ed and the timeout was then
 * misread as a logic red. A timeout is now classified `infra` (see
 * `isInfraSpawnError`) and re-run, but the ceiling is also raised so a healthy
 * run does not trip it. Distinct from FE-864's pi *session* idle deadline.
 */
export const VERIFY_TIMEOUT_MS = 180_000;

/**
 * FE-884 Slice B: a spawn error that means "the runner never delivered a
 * verdict" — the binary is missing, unavailable, or the run was killed by the
 * timeout. These are toolchain/infra faults, not code assertions, so they must
 * not be routed to the (logic-fix) remediation agent. ENOBUFS and other
 * post-start errors stay `test` — output exists to classify.
 */
export function isInfraSpawnError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === 'ENOENT' || code === 'ETIMEDOUT' || code === 'EACCES' || code === 'EPERM';
}

function isIdentifierChar(ch: string | undefined): boolean {
  if (!ch) return false;
  const code = ch.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || ch === '_'
  );
}

function includesErrorCode(output: string, code: string): boolean {
  let index = output.indexOf(code);
  while (index !== -1) {
    const before = output[index - 1];
    const after = output[index + code.length];
    if (!isIdentifierChar(before) && !isIdentifierChar(after)) return true;
    index = output.indexOf(code, index + code.length);
  }
  return false;
}

function isRunnerPackageDenied(output: string, diagnostics: RunnerDiagnostics): boolean {
  return output.split('\n').some((line) => {
    const lowerLine = line.toLowerCase();
    const denied =
      includesErrorCode(line, 'EACCES') ||
      includesErrorCode(line, 'EPERM') ||
      lowerLine.includes('operation not permitted') ||
      lowerLine.includes('permission denied');
    if (!denied) return false;
    const normalized = line.replaceAll('\\', '/');
    return diagnostics.runnerPackages.some((pkg) => normalized.includes(`/node_modules/${pkg}/`));
  });
}

/**
 * Classify a non-passing test run. Deliberately conservative ordering:
 *   1. `infra` — a spawn failure (missing binary) or shell "command not found";
 *      an unambiguous "the runner itself isn't there/can't load".
 *   2. `absent` — zero test files matched; not started.
 *   3. `test` — everything else, because a missing *module* is ambiguous with a
 *      legitimate TDD red and misrouting a real failure would silently skip it.
 */
export function classifyTestFailure(
  output: string,
  spawnFailed: boolean,
  diagnostics: RunnerDiagnostics,
): TestFailureKind {
  if (spawnFailed) return 'infra';
  if (RUNNER_MISSING_PATTERNS.some((re) => re.test(output))) return 'infra';
  if (isRunnerPackageDenied(output, diagnostics)) return 'infra';
  if (diagnostics.noTestsPatterns.some((re) => re.test(output))) return 'absent';
  return 'test';
}

/**
 * Drop pi harness `[agent-tail]` session-bookkeeping lines (e.g. "Pruned old
 * session", "Writing to …/browser.log") from captured runner output. They are
 * not test diagnostics — they pollute the verbose log and the LLM evaluator's
 * signal, and accumulate O(slices) per run.
 */
export function stripAgentTailLines(output: string): string {
  return output
    .split('\n')
    .filter((line) => !/^\s*\[agent-tail\]/.test(line))
    .join('\n');
}

export type TestCommandConfiner = (argv: readonly string[], sandboxDir: string) => ConfinedSpawn;

export class ToolchainTestRunner implements TestRunner {
  constructor(
    private readonly toolchain: Toolchain = defaultToolchain,
    private readonly confine?: TestCommandConfiner,
  ) {}

  async run(target: string, sandboxDir: string): Promise<TestResult> {
    const argv = this.toolchain.testCommand(target);
    const spawn = this.confine
      ? this.confine(argv, sandboxDir)
      : { command: argv[0] ?? '', args: argv.slice(1) };
    const result = spawnSync(spawn.command, spawn.args, {
      cwd: sandboxDir,
      encoding: 'utf8',
      env: spawn.env ? { ...process.env, ...spawn.env } : undefined,
      timeout: VERIFY_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Test runners vary in which stream carries diagnostics (e.g. `bun test`
    // writes its results to stderr and only the version banner to stdout) —
    // concatenate both so tests-run reports carry real detail.
    const output = stripAgentTailLines(
      [result.stdout, result.stderr, result.error ? String(result.error) : ''].filter(Boolean).join(''),
    );
    const passed = result.status === 0;
    if (passed) return { passed, output };
    // A missing runner binary (`ENOENT`) or a timeout-kill (`ETIMEDOUT`) means
    // the runner never delivered a verdict — an infra fault, not a code red
    // (FE-884 Slice B). Other post-start errors stay `test`.
    const runnerFailed = isInfraSpawnError(result.error);
    return {
      passed,
      output,
      failureKind: classifyTestFailure(output, runnerFailed, this.toolchain.diagnostics),
    };
  }
}

/**
 * The single verification seam: run every target through one `TestRunner` and
 * fold the per-target results into one verdict. This is the one place the
 * "≥1 target and all pass" oracle rule and the infra-dominates aggregate live,
 * so `evaluate-done`, `verify-epic`, and the net `run-tests` handler can't drift
 * apart (they each used to re-implement this). A runner that throws is treated
 * as an `infra` failure — a harness fault, not a code assertion.
 */
export async function runVerification(
  targets: readonly { target: string }[],
  runner: TestRunner,
  sandboxDir: string,
): Promise<VerificationOutcome> {
  const results: VerificationResult[] = [];
  for (const t of targets) {
    try {
      results.push({ target: t.target, ...(await runner.run(t.target, sandboxDir)) });
    } catch (err) {
      results.push({ target: t.target, passed: false, output: String(err), failureKind: 'infra' });
    }
  }
  const done = results.length > 0 && results.every((r) => r.passed);
  // Aggregate precedence: infra > test > absent. infra (toolchain broke)
  // dominates — a run that never executed is the actionable signal. `absent`
  // only wins when *every* non-passing target merely matched no files (the
  // greenfield gate); any genuine/unclassified failure makes the verdict `test`
  // so a real red is never downgraded to "not started". Undefined when passed.
  const failureKind: TestFailureKind | undefined = done
    ? undefined
    : results.some((r) => r.failureKind === 'infra')
      ? 'infra'
      : results.every((r) => r.passed || r.failureKind === 'absent')
        ? 'absent'
        : 'test';
  return { done, failureKind, results };
}
