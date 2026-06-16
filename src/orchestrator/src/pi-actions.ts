import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AuthStorage,
  type CreateAgentSessionOptions,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';

import { buildProbeSpec, runProbe } from './app-probe.js';
import { defaultToolchain, type Toolchain } from './project-profile.js';
import { createReport } from './report-helpers.js';
import { sliceLabel } from './slice-label.js';
import { runVerification, ToolchainTestRunner } from './test-runner.js';
import type {
  ActionContext,
  ActionHandlers,
  Epic,
  ProbeGrounder,
  ProbeResult,
  ProbeTarget,
  Slice,
  TestRunner,
} from './types.js';

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
// Output cap — the timeout alone won't stop a fast, chatty agent.
const PI_MAX_OUTPUT = 10 * 1024 * 1024;

// Per-action tool scoping. The evaluator observes, it does not produce: a
// read-only toolset means `evaluate-done` cannot fix code during evaluation and
// short-circuit the write-tests → write-code → evaluate loop. Code-producing
// actions keep the full toolset.
const WRITE_TOOLS = 'read,write,edit,bash';
const READ_ONLY_TOOLS = 'read';

export function toolsForAction(action: string): string {
  return action === 'evaluate-done' ? READ_ONLY_TOOLS : WRITE_TOOLS;
}

interface RunPiOpts {
  label: string;
  model: string;
  promptFile: string;
  task: string;
  sandboxDir: string;
  tools: string;
}

/** The pi SDK session factory — injectable so the drive loop is testable without a model or network. */
export type SessionFactory = typeof createAgentSession;

function createAgentDir(): string {
  return mkdtempSync(join(tmpdir(), 'brunch-pi-'));
}

function removeAgentDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function piTimeoutError(timeoutMs: number): Error {
  return new Error(`pi timed out after ${timeoutMs / 1000}s`);
}

function finalAgentFailure(session: {
  messages?: unknown[];
  state?: { messages?: unknown[] };
}): string | undefined {
  const messages = session.messages ?? session.state?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || typeof message !== 'object') continue;
    const record = message as { role?: unknown; stopReason?: unknown; errorMessage?: unknown };
    if (record.role !== 'assistant') continue;
    if (record.stopReason !== 'error' && record.stopReason !== 'aborted') return undefined;
    const detail =
      typeof record.errorMessage === 'string' && record.errorMessage.length > 0
        ? `: ${record.errorMessage}`
        : '';
    return `agent ended with stopReason "${record.stopReason}"${detail}`;
  }
  return undefined;
}

// Map one action's inputs to SDK session config — tools/model/system-prompt, no
// context/skills, in-memory session. Auth from brunch's own ANTHROPIC_API_KEY, not
// the user's ~/.pi credentials, which is what keeps a fresh checkout self-contained.
async function buildSessionOptions(opts: RunPiOpts, isolatedDir: string): Promise<CreateAgentSessionOptions> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set — the in-process pi agent needs it (no pi login / auth.json required)',
    );
  }

  const authStorage = AuthStorage.create(join(isolatedDir, 'auth.json'));
  authStorage.setRuntimeApiKey('anthropic', apiKey);
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const model = modelRegistry.find('anthropic', opts.model);
  if (!model) {
    throw new Error(`model anthropic/${opts.model} not found in the pi model registry`);
  }

  const systemPrompt = readFileSync(opts.promptFile, 'utf8');
  const resourceLoader = new DefaultResourceLoader({
    cwd: opts.sandboxDir,
    agentDir: isolatedDir,
    systemPromptOverride: () => systemPrompt,
    appendSystemPromptOverride: () => [],
    agentsFilesOverride: () => ({ agentsFiles: [] }),
    skillsOverride: () => ({ skills: [], diagnostics: [] }),
    promptsOverride: () => ({ prompts: [], diagnostics: [] }),
  });
  await resourceLoader.reload();

  return {
    cwd: opts.sandboxDir,
    agentDir: isolatedDir,
    model,
    authStorage,
    modelRegistry,
    resourceLoader,
    tools: opts.tools.split(','),
    sessionManager: SessionManager.inMemory(opts.sandboxDir),
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  };
}

// In-process (not a spawned CLI) so brunch is self-contained. Each run gets a
// throwaway agent/auth dir to keep concurrent slices isolated; the dir is removed
// after the session ends. Output is buffered from text_delta events, never written
// to brunch's stdout (keeps the cook SSE stream clean); the timeout covers both
// session setup and the prompt turn, aborting cooperatively once a session exists.
async function runPi(
  opts: RunPiOpts,
  deps: { createSession?: SessionFactory; timeoutMs?: number; maxOutput?: number } = {},
): Promise<string> {
  const createSession = deps.createSession ?? createAgentSession;
  const timeoutMs = deps.timeoutMs ?? PI_TIMEOUT_MS;
  const maxOutput = deps.maxOutput ?? PI_MAX_OUTPUT;
  const start = Date.now();

  const isolatedDir = createAgentDir();
  let cleanedAgentDir = false;
  const cleanupAgentDir = (): void => {
    if (cleanedAgentDir) return;
    cleanedAgentDir = true;
    removeAgentDir(isolatedDir);
  };
  let session: Awaited<ReturnType<SessionFactory>>['session'] | undefined;
  let captured = '';
  let capturedBytes = 0;
  let overflowed = false;
  let timedOut = false;
  let promptError: unknown;
  let agentFailure: string | undefined;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      void session?.abort();
      reject(piTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const setup = (async () => {
      const created = await createSession(await buildSessionOptions(opts, isolatedDir));
      if (timedOut) {
        created.session.dispose();
      }
      return created.session;
    })();
    void setup.then(
      () => {
        if (timedOut && !session) cleanupAgentDir();
      },
      () => {
        if (timedOut && !session) cleanupAgentDir();
      },
    );

    session = await Promise.race([setup, timeout]);

    unsubscribe = session.subscribe((event) => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        if (overflowed) return;
        const delta = event.assistantMessageEvent.delta;
        const deltaBytes = Buffer.byteLength(delta, 'utf8');
        if (capturedBytes + deltaBytes > maxOutput) {
          overflowed = true;
          void session?.abort();
          return;
        }
        captured += delta;
        capturedBytes += deltaBytes;
      }
    });

    try {
      await Promise.race([session.prompt(opts.task), timeout]);
      agentFailure = finalAgentFailure(session);
    } catch (err) {
      promptError = err;
    }
  } finally {
    if (timer) clearTimeout(timer);
    unsubscribe?.();
    session?.dispose();
    cleanupAgentDir();
  }

  if (timedOut) throw piTimeoutError(timeoutMs);
  if (overflowed) throw new Error(`pi output exceeded ${Math.floor(maxOutput / (1024 * 1024))}MB buffer`);
  if (promptError) {
    const detail = promptError instanceof Error ? promptError.message : JSON.stringify(promptError);
    throw new Error(`pi failed: ${detail}`);
  }
  if (agentFailure) {
    throw new Error(`pi failed: ${agentFailure}`);
  }

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  log('✓', `${opts.label} (${dur}s)`);
  logVerbose(captured);
  return captured;
}

export { runPi };

function report(ctx: ActionContext, actor: string, event: string, payload: Record<string, unknown>): string {
  return createReport(ctx.reports, { epicId: ctx.epic.id, sliceId: ctx.slice.id, actor, event, payload });
}

/**
 * Resolve the epic's reachability probe target (FE-876): a concrete `epic.probe`
 * wins (Half A — fixtures / explicit); otherwise a host-blind `epic.reachability`
 * intent is ground into a `ProbeTarget` by the injected cook-time grounder
 * (Half B). With no concrete target, no intent, or no grounder, there is nothing
 * to probe — the epic falls back to the unit-test verdict alone.
 */
async function resolveProbeTarget(
  epic: Epic,
  sandboxDir: string,
  ground: ProbeGrounder | undefined,
): Promise<ProbeTarget | undefined> {
  if (epic.probe) return epic.probe;
  if (epic.reachability && ground) return ground(epic.reachability, sandboxDir);
  return undefined;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Build the cook test-writer task for one slice. The concrete test
 * framework / import conventions come from the toolchain — never hardcoded
 * — so the prompt stays stack-agnostic (slice 2 of plan-build-architect).
 */
export function sliceTestTask(slice: Slice, toolchain: Toolchain): string {
  const targets = slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');
  return `Write failing tests for slice "${slice.id}": ${slice.definition}\nVerification targets: ${targets}\nWrite test files that will initially fail. ${toolchain.testConventions}`;
}

/** Build the cook epic-verify task — toolchain-supplied conventions, as above. */
export function epicVerifyTask(epic: Epic, toolchain: Toolchain): string {
  const targets = epic.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');
  return `Write an integration test for epic "${epic.id}": ${epic.summary}\nThis test should verify that all slices in this epic work together correctly.\nVerification targets: ${targets}\nWrite the test file(s). ${toolchain.testConventions} Then run them to verify they pass.`;
}

export function createPiActions(opts?: {
  verbose?: boolean;
  runStart?: number;
  toolchain?: Toolchain;
  testRunner?: TestRunner;
  /** Inject the agent-session factory (tests stub it so no real session runs). */
  createSession?: SessionFactory;
  /**
   * Cook-time probe grounding (FE-876 Half B): resolve an epic's host-blind
   * `reachability` intent into a concrete `ProbeTarget`. Absent → reachability
   * intents are not enforced (the agent grounder lands with the pi-harness
   * contract); concrete `epic.probe` targets work regardless.
   */
  groundProbe?: ProbeGrounder;
}): ActionHandlers {
  _verbose = opts?.verbose ?? false;
  t0 = opts?.runStart ?? Date.now();
  const toolchain = opts?.toolchain ?? defaultToolchain;
  const testRunner = opts?.testRunner ?? new ToolchainTestRunner(toolchain);
  const groundProbe = opts?.groundProbe;
  const piDeps = opts?.createSession ? { createSession: opts.createSession } : {};

  return {
    'evaluate-done': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      log('?', `evaluate  ${label}`);
      const { done, failureKind, results } = await runVerification(
        ctx.slice.verification,
        testRunner,
        ctx.sandboxDir,
      );
      for (const r of results) {
        logVerbose(r.output);
        log(r.passed ? '✓' : '✗', `verify    ${r.target}`);
      }
      log(done ? '●' : '○', `verdict   ${label} → ${done ? 'DONE' : 'NEEDS WORK'}`);
      return report(ctx, 'evaluator', 'eval-done', { done, failureKind, results });
    },

    'write-tests': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      log('▸', `tests     ${label}`);
      const task = sliceTestTask(ctx.slice, toolchain);

      await runPi(
        {
          label: `tests     ${label}`,
          model: 'claude-sonnet-4-6',
          promptFile: join(promptsDir, 'test-writer.md'),
          task,
          sandboxDir: ctx.sandboxDir,
          tools: toolsForAction('write-tests'),
        },
        piDeps,
      );

      return report(ctx, 'test-writer', 'tests-written', {
        sliceId: ctx.slice.id,
        targets: ctx.slice.verification.map((v) => v.target),
      });
    },

    'write-code': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      log('▸', `code      ${label}`);
      const task = `Write code to make tests pass for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nImplement the minimum code to make all tests pass.`;

      await runPi(
        {
          label: `code      ${label}`,
          model: 'claude-sonnet-4-6',
          promptFile: join(promptsDir, 'code-writer.md'),
          task,
          sandboxDir: ctx.sandboxDir,
          tools: toolsForAction('write-code'),
        },
        piDeps,
      );

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
      const writeTask = epicVerifyTask(ctx.epic, toolchain);

      await runPi(
        {
          label: `verify    ${ctx.epic.id} (write)`,
          model: 'claude-sonnet-4-6',
          promptFile: join(promptsDir, 'test-writer.md'),
          task: writeTask,
          sandboxDir: ctx.sandboxDir,
          tools: toolsForAction('verify-epic'),
        },
        piDeps,
      );

      const {
        done: testsPassed,
        failureKind,
        results,
      } = await runVerification(ctx.epic.verification, testRunner, ctx.sandboxDir);
      for (const r of results) {
        logVerbose(r.output);
        log(r.passed ? '✓' : '✗', `verify    ${r.target}`);
      }

      // Integration oracle (FE-876): the epic is reachable only when the booted
      // merged tree answers the feature endpoint. `not-reachable` is the FE-800
      // orphan (code merged but never wired into the running app); `infra` is a
      // harness fault, not a wiring verdict. Gate the boot on tests passing —
      // never boot a known-broken build. The probe target is either concrete
      // (`epic.probe`, Half A) or cook-time-grounded from `epic.reachability`
      // (Half B); a grounder that throws is itself an `infra` fault.
      let probe: ProbeResult | undefined;
      if (testsPassed) {
        try {
          const target = await resolveProbeTarget(ctx.epic, ctx.sandboxDir, groundProbe);
          if (target) probe = await runProbe(await buildProbeSpec(target), ctx.sandboxDir);
        } catch (err) {
          probe = { kind: 'infra', reachable: false, output: `probe grounding failed: ${String(err)}` };
        }
        if (probe) {
          logVerbose(probe.output);
          log(
            probe.reachable ? '✓' : '✗',
            `probe     ${ctx.epic.id} → ${probe.kind}${probe.status === undefined ? '' : ` (${probe.status})`}`,
          );
        }
      }
      const passed = testsPassed && (probe === undefined || probe.reachable);

      log(passed ? '●' : '✗', `epic      ${ctx.epic.id} → ${passed ? 'PASS' : 'FAIL'}`);
      return report(ctx, 'orchestrator', 'epic-verified', {
        passed,
        failureKind,
        ...(probe ? { reachability: probe.kind } : {}),
      });
    },
  };
}
