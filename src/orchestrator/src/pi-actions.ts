import { exec, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

import { createReport } from './report-helpers.js';
import { sliceLabel } from './slice-label.js';
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

// Per-action tool scoping. The evaluator observes, it does not produce: a
// read-only toolset means `evaluate-done` cannot fix code during evaluation and
// short-circuit the write-tests → write-code → evaluate loop. Code-producing
// actions keep the full toolset.
const WRITE_TOOLS = 'read,write,edit,bash';
const READ_ONLY_TOOLS = 'read';

export function toolsForAction(action: string): string {
  return action === 'evaluate-done' ? READ_ONLY_TOOLS : WRITE_TOOLS;
}

// Async on purpose: `pi` runs for tens of seconds per call. A synchronous
// `spawnSync` would freeze the shared event loop, starving the SSE stream
// server of the chance to flush frames while a slice is being worked.
// Awaiting an async child keeps the loop free so transition firings stream
// live.
function runPi(opts: {
  label: string;
  model: string;
  promptFile: string;
  task: string;
  sandboxDir: string;
  tools: string;
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
        opts.tools,
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

/**
 * Decide whether a slice is done by executing its verification targets. `done`
 * requires at least one target and every target passing — a slice with no
 * runnable verification cannot be proven done (no requisite variety). This is
 * the real oracle: it replaces the prior LLM verdict over criterion prose,
 * which a standalone component or Ladle story could satisfy without the
 * feature working.
 */
export async function evaluateVerificationTargets(
  targets: readonly { target: string }[],
  runTarget: (target: string) => Promise<boolean>,
): Promise<{ done: boolean; results: Array<{ target: string; passed: boolean }> }> {
  const results: Array<{ target: string; passed: boolean }> = [];
  for (const t of targets) {
    let passed = false;
    try {
      passed = await runTarget(t.target);
    } catch {
      passed = false;
    }
    results.push({ target: t.target, passed });
  }
  return { done: results.length > 0 && results.every((r) => r.passed), results };
}

async function runBunTest(target: string, sandboxDir: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`bun test ${target}`, {
      cwd: sandboxDir,
      encoding: 'utf8',
      timeout: 60_000,
    });
    logVerbose(stdout);
    return true;
  } catch (err) {
    if (_verbose && err && typeof err === 'object' && 'stdout' in err) {
      logVerbose(String((err as { stdout: unknown }).stdout));
    }
    return false;
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
      const label = sliceLabel(ctx.slice);
      log('?', `evaluate  ${label}`);
      const { done, results } = await evaluateVerificationTargets(ctx.slice.verification, (target) =>
        runBunTest(target, ctx.sandboxDir),
      );
      for (const r of results) {
        log(r.passed ? '✓' : '✗', `verify    ${r.target}`);
      }
      log(done ? '●' : '○', `verdict   ${label} → ${done ? 'DONE' : 'NEEDS WORK'}`);
      return report(ctx, 'evaluator', 'eval-done', { done, results });
    },

    'write-tests': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      log('▸', `tests     ${label}`);
      const task = `Write failing tests for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nWrite test files that will initially fail. Use bun test conventions.`;

      await runPi({
        label: `tests     ${label}`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'test-writer.md'),
        task,
        sandboxDir: ctx.sandboxDir,
        tools: toolsForAction('write-tests'),
      });

      return report(ctx, 'test-writer', 'tests-written', {
        sliceId: ctx.slice.id,
        targets: ctx.slice.verification.map((v) => v.target),
      });
    },

    'write-code': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      log('▸', `code      ${label}`);
      const task = `Write code to make tests pass for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nImplement the minimum code to make all tests pass.`;

      await runPi({
        label: `code      ${label}`,
        model: 'claude-sonnet-4-6',
        promptFile: join(promptsDir, 'code-writer.md'),
        task,
        sandboxDir: ctx.sandboxDir,
        tools: toolsForAction('write-code'),
      });

      return report(ctx, 'code-writer', 'code-written', {
        sliceId: ctx.slice.id,
      });
    },

    'assess-semantic': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      log('?', `semantic  ${label}`);
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
        tools: toolsForAction('verify-epic'),
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
