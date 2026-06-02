import { exec, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

import { createReport } from './report-helpers.js';
import type { ActionContext, ActionHandlers } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = __dirname.includes('dist')
  ? join(__dirname, '..', 'orchestrator-prompts')
  : join(__dirname, '..', 'prompts');

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

let t0 = 0;
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

const PI_TIMEOUT_MS = 300_000;
const PI_MAX_BUFFER = 10 * 1024 * 1024;

// Async on purpose: `pi` runs for tens of seconds per call. A synchronous
// `spawnSync` would freeze the shared event loop, starving the FE-764 SSE
// stream server (which lives on the same loop) of the chance to flush frames
// while a slice is being worked. Awaiting an async child keeps the loop free
// so transition firings stream live.
function runPi(opts: {
  label: string;
  model: string;
  promptFile: string;
  task: string;
  sandboxDir: string;
}): Promise<string> {
  const start = Date.now();

  return new Promise<string>((resolve, reject) => {
    const child = spawn(
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
      { cwd: opts.sandboxDir, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutLen = 0;
    let settled = false;

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => {
        child.kill('SIGTERM');
        reject(new Error(`pi timed out after ${PI_TIMEOUT_MS / 1000}s`));
      });
    }, PI_TIMEOUT_MS);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutLen += chunk.length;
      if (stdoutLen > PI_MAX_BUFFER) {
        settle(() => {
          child.kill('SIGTERM');
          reject(new Error('pi output exceeded 10MB buffer'));
        });
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      settle(() => reject(new Error(`pi failed to start: ${err.message}`)));
    });

    child.on('close', (code) => {
      settle(() => {
        const stdout = Buffer.concat(stdoutChunks).toString('utf8');
        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
          reject(new Error(`pi exited ${code}${stderr ? `: ${stderr}` : ''}`));
          return;
        }
        const dur = ((Date.now() - start) / 1000).toFixed(1);
        log('✓', `${opts.label} (${dur}s)`);
        logVerbose(stdout);
        resolve(stdout);
      });
    });
  });
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

export function createPiActions(opts?: { verbose?: boolean; runStart?: number }): ActionHandlers {
  _verbose = opts?.verbose ?? false;
  t0 = opts?.runStart ?? Date.now();

  return {
    'evaluate-done': async (ctx: ActionContext) => {
      log('?', `evaluate  ${ctx.slice.id}`);
      const task = `Evaluate slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => v.target).join(', ')}\nDetermine if all verification targets are satisfied. Respond with a JSON object: { "done": true/false, "reasoning": "..." }`;

      try {
        const raw = await runPi({
          label: `evaluate  ${ctx.slice.id}`,
          model: 'claude-haiku-4-5',
          promptFile: join(promptsDir, 'evaluator.md'),
          task,
          sandboxDir: ctx.sandboxDir,
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

      await runPi({
        label: `tests     ${ctx.slice.id}`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'test-writer.md'),
        task,
        sandboxDir: ctx.sandboxDir,
      });

      return report(ctx, 'test-writer', 'tests-written', {
        sliceId: ctx.slice.id,
        targets: ctx.slice.verification.map((v) => v.target),
      });
    },

    'write-code': async (ctx: ActionContext) => {
      log('▸', `code      ${ctx.slice.id}`);
      const task = `Write code to make tests pass for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nImplement the minimum code to make all tests pass.`;

      await runPi({
        label: `code      ${ctx.slice.id}`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'code-writer.md'),
        task,
        sandboxDir: ctx.sandboxDir,
      });

      return report(ctx, 'code-writer', 'code-written', {
        sliceId: ctx.slice.id,
      });
    },

    'assess-semantic': async (ctx: ActionContext) => {
      log('?', `semantic  ${ctx.slice.id}`);
      // POC: auto-satisfy — real semantic assessment requires graph-derived gates (Phase 3)
      return report(ctx, 'semantic-assessor', 'semantic-assessed', { satisfied: true });
    },

    'verify-epic': async (ctx: ActionContext) => {
      log('▸', `verify    ${ctx.epic.id}`);
      const targets = ctx.epic.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');

      const writeTask = `Write an integration test for epic "${ctx.epic.id}": ${ctx.epic.summary}\nThis test should verify that all slices in this epic work together correctly.\nVerification targets: ${targets}\nWrite the test file(s) using bun test conventions. Then run them with "bun test" to verify they pass.`;

      await runPi({
        label: `verify    ${ctx.epic.id} (write)`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'test-writer.md'),
        task: writeTask,
        sandboxDir: ctx.sandboxDir,
      });

      let allPassed = true;
      for (const v of ctx.epic.verification) {
        try {
          const { stdout } = await execAsync(`bun test ${v.target}`, {
            cwd: ctx.sandboxDir,
            encoding: 'utf8',
            timeout: 60_000,
          });
          log('✓', `verify    ${v.target}`);
          logVerbose(stdout);
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
