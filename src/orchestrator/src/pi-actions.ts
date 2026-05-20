import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ActionContext, ActionHandlers, ReportSink } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = __dirname.includes('dist')
  ? join(__dirname, '..', 'orchestrator-prompts')
  : join(__dirname, '..', 'prompts');

function runPi(opts: { model: string; promptFile: string; task: string; worktreeDir: string }): string {
  console.error(`  [pi] ${opts.model} → ${opts.worktreeDir}`);

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

  if (result.error) {
    throw new Error(`pi failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? '';
    throw new Error(`pi exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }

  return result.stdout;
}

/** Try to extract a JSON object from pi's text output. */
function extractJson(raw: string): Record<string, unknown> | undefined {
  // Look for a JSON object in the output (pi may wrap it in markdown or prose)
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function appendReport(
  reports: ReportSink,
  ctx: ActionContext,
  actor: string,
  event: string,
  payload: Record<string, unknown>,
): string {
  const id = `rpt-${actor}-${ctx.slice.id}-${Date.now()}`;
  reports.append({
    id,
    ts: new Date().toISOString(),
    epicId: ctx.epic.id,
    sliceId: ctx.slice.id,
    actor,
    event,
    payload,
  });
  return id;
}

export function createPiActions(): ActionHandlers {
  return {
    'evaluate-done': async (ctx: ActionContext) => {
      console.error(`  [evaluate] slice=${ctx.slice.id}`);
      const task = `Evaluate slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => v.target).join(', ')}\nDetermine if all verification targets are satisfied. Respond with a JSON object: { "done": true/false, "reasoning": "..." }`;

      try {
        const raw = runPi({
          model: 'claude-haiku-4-5',
          promptFile: join(promptsDir, 'evaluator.md'),
          task,
          worktreeDir: ctx.worktreeDir,
        });
        const parsed = extractJson(raw) as { done?: boolean; reasoning?: string } | undefined;
        const done = !!parsed?.done;
        console.error(`  [evaluate] result: ${done ? 'YES' : 'NO'}`);
        return appendReport(ctx.reports, ctx, 'evaluator', 'eval-done', {
          done,
          reasoning: parsed?.reasoning ?? raw.slice(0, 200),
        });
      } catch (err) {
        console.error(`  [evaluate] failed: ${err instanceof Error ? err.message : err}`);
        return appendReport(ctx.reports, ctx, 'evaluator', 'eval-done', {
          done: false,
          reasoning: `evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },

    'write-tests': async (ctx: ActionContext) => {
      console.error(`  [write-tests] slice=${ctx.slice.id}`);
      const task = `Write failing tests for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nWrite test files that will initially fail. Use bun test conventions.`;

      runPi({
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'test-writer.md'),
        task,
        worktreeDir: ctx.worktreeDir,
      });

      return appendReport(ctx.reports, ctx, 'test-writer', 'tests-written', {
        sliceId: ctx.slice.id,
        targets: ctx.slice.verification.map((v) => v.target),
      });
    },

    'write-code': async (ctx: ActionContext) => {
      console.error(`  [write-code] slice=${ctx.slice.id}`);
      const task = `Write code to make tests pass for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nImplement the minimum code to make all tests pass.`;

      runPi({
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'code-writer.md'),
        task,
        worktreeDir: ctx.worktreeDir,
      });

      return appendReport(ctx.reports, ctx, 'code-writer', 'code-written', {
        sliceId: ctx.slice.id,
      });
    },

    'verify-epic': async (ctx: ActionContext) => {
      console.error(`  [verify-epic] epic=${ctx.epic.id}`);
      const targets = ctx.epic.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');

      // Step 1: write the integration test if it doesn't exist
      const writeTask = `Write an integration test for epic "${ctx.epic.id}": ${ctx.epic.summary}\nThis test should verify that all slices in this epic work together correctly.\nVerification targets: ${targets}\nWrite the test file(s) using bun test conventions. Then run them with "bun test" to verify they pass.`;

      console.error(`  [verify-epic] writing + running integration tests`);
      runPi({
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'evaluator.md'),
        task: writeTask,
        worktreeDir: ctx.worktreeDir,
      });

      // Step 2: run the verification targets deterministically
      let allPassed = true;
      for (const v of ctx.epic.verification) {
        try {
          const { execSync } = await import('node:child_process');
          execSync(`bun test ${v.target}`, {
            cwd: ctx.worktreeDir,
            encoding: 'utf8',
            timeout: 60_000,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          console.error(`  [verify-epic] ${v.target}: PASS`);
        } catch {
          console.error(`  [verify-epic] ${v.target}: FAIL`);
          allPassed = false;
        }
      }

      console.error(`  [verify-epic] result: ${allPassed ? 'PASS' : 'FAIL'}`);
      return appendReport(ctx.reports, ctx, 'orchestrator', 'epic-verified', {
        passed: allPassed,
      });
    },
  };
}
