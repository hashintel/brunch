import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReport } from './report-helpers.js';
import type { ActionContext, ActionHandlers } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = __dirname.includes('dist')
  ? join(__dirname, '..', 'orchestrator-prompts')
  : join(__dirname, '..', 'prompts');

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const t0 = Date.now();
let _verbose = false;

function elapsed(): string {
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  return `${s}s`.padStart(7);
}

function log(icon: string, msg: string): void {
  console.error(`  ${elapsed()}  ${icon}  ${msg}`);
}

function logVerbose(output: string): void {
  if (!_verbose) return;
  const trimmed = output.trim();
  if (!trimmed) return;
  console.error('');
  for (const line of trimmed.split('\n')) {
    console.error(`             │ ${line}`);
  }
  console.error('');
}

// ---------------------------------------------------------------------------
// Pi dispatch
// ---------------------------------------------------------------------------

function runPi(opts: {
  label: string;
  model: string;
  promptFile: string;
  task: string;
  worktreeDir: string;
}): string {
  const start = Date.now();

  const result = spawnSync(
    'pi',
    [
      '-p',
      '--no-session',
      '--no-context-files',
      '--mode',
      'text',
      '--provider',
      'anthropic',
      '--model',
      opts.model,
      '--system-prompt',
      '',
      '--append-system-prompt',
      opts.promptFile,
      '--tools',
      'read,write,edit,bash',
      opts.task,
    ],
    {
      cwd: opts.worktreeDir,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const dur = ((Date.now() - start) / 1000).toFixed(1);

  if (result.error) {
    throw new Error(`pi failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? '';
    throw new Error(`pi exited ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }

  log('✓', `${opts.label} (${dur}s)`);
  logVerbose(result.stdout);

  return result.stdout;
}

/** Try to extract a JSON object from pi's text output. */
function extractJson(raw: string): Record<string, unknown> | undefined {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function report(ctx: ActionContext, actor: string, event: string, payload: Record<string, unknown>): string {
  return createReport(ctx.reports, { epicId: ctx.epic.id, sliceId: ctx.slice.id, actor, event, payload });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function createPiActions(opts?: { verbose?: boolean }): ActionHandlers {
  _verbose = opts?.verbose ?? false;

  return {
    'evaluate-done': async (ctx: ActionContext) => {
      log('?', `evaluate  ${ctx.slice.id}`);
      const task = `Evaluate slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => v.target).join(', ')}\nDetermine if all verification targets are satisfied. Respond with a JSON object: { "done": true/false, "reasoning": "..." }`;

      try {
        const raw = runPi({
          label: `evaluate  ${ctx.slice.id}`,
          model: 'claude-haiku-4-5',
          promptFile: join(promptsDir, 'evaluator.md'),
          task,
          worktreeDir: ctx.worktreeDir,
        });
        const parsed = extractJson(raw) as { done?: boolean; reasoning?: string } | undefined;
        const done = !!parsed?.done;
        log(done ? '●' : '○', `verdict   ${ctx.slice.id} → ${done ? 'DONE' : 'NEEDS WORK'}`);
        return report(ctx, 'evaluator', 'eval-done', {
          done,
          reasoning: parsed?.reasoning ?? raw.slice(0, 200),
        });
      } catch (err) {
        log('✗', `evaluate  ${ctx.slice.id} — ${err instanceof Error ? err.message : err}`);
        return report(ctx, 'evaluator', 'eval-done', {
          done: false,
          reasoning: `evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },

    'write-tests': async (ctx: ActionContext) => {
      log('▸', `tests     ${ctx.slice.id}`);
      const task = `Write failing tests for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nWrite test files that will initially fail. Use bun test conventions.`;

      runPi({
        label: `tests     ${ctx.slice.id}`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'test-writer.md'),
        task,
        worktreeDir: ctx.worktreeDir,
      });

      return report(ctx, 'test-writer', 'tests-written', {
        sliceId: ctx.slice.id,
        targets: ctx.slice.verification.map((v) => v.target),
      });
    },

    'write-code': async (ctx: ActionContext) => {
      log('▸', `code      ${ctx.slice.id}`);
      const task = `Write code to make tests pass for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nImplement the minimum code to make all tests pass.`;

      runPi({
        label: `code      ${ctx.slice.id}`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'code-writer.md'),
        task,
        worktreeDir: ctx.worktreeDir,
      });

      return report(ctx, 'code-writer', 'code-written', {
        sliceId: ctx.slice.id,
      });
    },

    'verify-epic': async (ctx: ActionContext) => {
      log('▸', `verify    ${ctx.epic.id}`);
      const targets = ctx.epic.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');

      const writeTask = `Write an integration test for epic "${ctx.epic.id}": ${ctx.epic.summary}\nThis test should verify that all slices in this epic work together correctly.\nVerification targets: ${targets}\nWrite the test file(s) using bun test conventions. Then run them with "bun test" to verify they pass.`;

      runPi({
        label: `verify    ${ctx.epic.id} (write)`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'test-writer.md'),
        task: writeTask,
        worktreeDir: ctx.worktreeDir,
      });

      let allPassed = true;
      for (const v of ctx.epic.verification) {
        try {
          const { execSync } = await import('node:child_process');
          const output = execSync(`bun test ${v.target}`, {
            cwd: ctx.worktreeDir,
            encoding: 'utf8',
            timeout: 60_000,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          log('✓', `verify    ${v.target}`);
          logVerbose(output);
        } catch (err) {
          log('✗', `verify    ${v.target}`);
          if (_verbose && err && typeof err === 'object' && 'stdout' in err) {
            logVerbose(String((err as { stdout: unknown }).stdout));
          }
          allPassed = false;
        }
      }

      log(allPassed ? '●' : '✗', `epic      ${ctx.epic.id} → ${allPassed ? 'PASS' : 'FAIL'}`);
      return report(ctx, 'orchestrator', 'epic-verified', {
        passed: allPassed,
      });
    },
  };
}
