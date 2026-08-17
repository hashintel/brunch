import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createAgentSession,
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type CreateAgentSessionOptions,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type Skill,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

import { buildProbeSpec, runProbe } from './app-probe.js';
import type { CookEvent } from './presenter/events.js';
import { defaultToolchain, type Toolchain } from './project-profile.js';
import { createReport } from './report-helpers.js';
import { createConfinedTools } from './sandbox-guard.js';
import { sliceLabel } from './slice-label.js';
import { runVerification, ToolchainTestRunner } from './test-runner.js';
import type {
  ActionContext,
  ActionHandlers,
  Epic,
  ProbeGrounder,
  ProbeResult,
  ProbeTarget,
  SemanticAssessedPayload,
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

let _verbose = false;
// Presentation boundary. Per-action progress flows to the CookBus as
// CookEvents; the presenter owns formatting (and the elapsed clock —
// I136-K). Defaults to a no-op so unit tests that ignore output run clean.
let _emit: (event: CookEvent) => void = () => {};

function log(icon: string, msg: string): void {
  _emit({ kind: 'action', icon, message: msg });
}

function logVerbose(output: string): void {
  if (!_verbose) return;
  // The presenter trims and skips blank output.
  _emit({ kind: 'verbose', text: output });
}

const HEARTBEAT_MAX = 56;

/** The agent's most recent non-empty line, tail-truncated for a one-line wait heartbeat. */
function latestLine(text: string): string {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (line) return line.length > HEARTBEAT_MAX ? `…${line.slice(-(HEARTBEAT_MAX - 1))}` : line;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Tool-call observability — show what the agent is *doing* (editing X, running
// bash, reading Y), not just what it's saying. We can't observe tool calls via
// session.subscribe (that stream is text/lifecycle only), so we supply the
// built-in tools ourselves and wrap their execute to emit a heartbeat. The
// createXToolDefinition builders bake in the real config (mutation queue,
// truncation defaults), so wrapping + delegating preserves behavior exactly.
// ---------------------------------------------------------------------------

// Inferred so each builder keeps its own tool-schema generic; the heterogeneous
// list is erased to the base ToolDefinition at the single wrap point below.
const TOOL_DEF_BUILDERS = {
  read: createReadToolDefinition,
  write: createWriteToolDefinition,
  edit: createEditToolDefinition,
  bash: createBashToolDefinition,
  grep: createGrepToolDefinition,
  find: createFindToolDefinition,
  ls: createLsToolDefinition,
} as const;

/** A one-line "what the agent is doing" label from a tool name + its params. */
export function toolLabel(name: string, params: unknown): string {
  const p = (params && typeof params === 'object' ? params : {}) as Record<string, unknown>;
  const target = [p.path, p.command, p.pattern].find(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  const label = target ? `${name} ${target}` : name;
  return label.length > HEARTBEAT_MAX ? `${label.slice(0, HEARTBEAT_MAX - 1)}…` : label;
}

/**
 * Wrap a tool definition's execute to bracket the call: `onStart` fires a
 * heartbeat before it runs, `onSettle` fires once it resolves or rejects. The
 * bracket lets the idle deadline treat an in-flight tool (e.g. a long `bash`
 * test run that emits no session traffic) as active work rather than dead air.
 */
export function instrumentToolDefinition(
  def: ToolDefinition,
  onStart: (label: string) => void,
  onSettle: () => void = () => {},
): ToolDefinition {
  const original = def.execute.bind(def);
  const settle = (): void => {
    try {
      onSettle();
    } catch {
      /* ignore */
    }
  };
  def.execute = ((...args: Parameters<typeof def.execute>) => {
    // Observation must never break a tool call.
    try {
      onStart(toolLabel(def.name, args[1]));
    } catch {
      /* ignore */
    }
    let result: ReturnType<typeof def.execute>;
    try {
      result = original(...args);
    } catch (err) {
      settle();
      throw err;
    }
    // Real tools are async: settle when the promise resolves/rejects, but return
    // the original promise so the result and shape are preserved unchanged.
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      return (result as Promise<unknown>).finally(settle) as ReturnType<typeof def.execute>;
    }
    settle();
    return result;
  }) as typeof def.execute;
  return def;
}

function buildInstrumentedTools(
  names: string[],
  cwd: string,
  onStart: (label: string) => void,
  onSettle: () => void,
  confine = true,
): ToolDefinition[] {
  const confinedTools = confine ? new Map(createConfinedTools(cwd).map((def) => [def.name, def])) : new Map();
  return names.flatMap((name) => {
    const def = confinedTools.get(name);
    if (def) return [instrumentToolDefinition(def, onStart, onSettle)];
    const build = TOOL_DEF_BUILDERS[name as keyof typeof TOOL_DEF_BUILDERS];
    if (!build) return [];
    return [instrumentToolDefinition(build(cwd) as ToolDefinition, onStart, onSettle)];
  });
}

/** Bracket a wait so it shows as a live pending activity; always closes. */
async function withActivity<T>(id: string, label: string, fn: () => Promise<T>): Promise<T> {
  _emit({ kind: 'activity-start', id, label });
  try {
    return await fn();
  } finally {
    _emit({ kind: 'activity-end', id });
  }
}

// ---------------------------------------------------------------------------
// Pi dispatch
// ---------------------------------------------------------------------------

// Idle deadline, not a wall-clock cap: the agent may legitimately work far
// longer than this on a heavy slice — what we guard against is dead air. Each
// session event re-arms the timer (see runPi), so this bounds silence, not
// total runtime. FE-864.
const PI_TIMEOUT_MS = 600_000;
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
  /** Activity id for the live wait/heartbeat. Defaults to `label`; set to the
   *  slice id so the heartbeat lands on that slice's grid row. */
  activityId?: string;
  confine?: boolean;
}

/** The pi SDK session factory — injectable so the drive loop is testable without a model or network. */
export type SessionFactory = typeof createAgentSession;

/** Per-action token usage read from the pi session after its single prompt turn (FE-894 P0). */
export type PiUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
};

/** Per-action wall-clock split: session setup (cold start) vs the prompt turn. */
export type PiTimingMs = { coldStartMs: number; promptMs: number };

/** runPi's result: buffered agent output plus the telemetry that makes prompt-cache hits and per-action latency observable. */
export type PiResult = { output: string; usage: PiUsage; timingMs: PiTimingMs };

/**
 * Normalize a pi `SessionStats` into a `PiUsage`, defaulting any absent token
 * field to 0. Each cook action drives a *fresh* session with a single prompt,
 * so the session's cumulative stats are exactly that action's usage. Pure and
 * defensive — telemetry must never throw a live session.
 */
export function sessionStatsToUsage(stats: { tokens?: Partial<PiUsage> } | undefined): PiUsage {
  const t = stats?.tokens ?? {};
  return {
    input: t.input ?? 0,
    output: t.output ?? 0,
    cacheRead: t.cacheRead ?? 0,
    cacheWrite: t.cacheWrite ?? 0,
    total: t.total ?? 0,
  };
}

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

/**
 * Keep only skills rooted under `sandboxDir` (the cook worktree). Drops the
 * developer's machine-global pi skills and any sibling-slice / look-alike paths,
 * so a brownfield cook builds on the target repo's own skills without leaking the
 * host's pi config — the "self-contained checkout" guarantee, narrowed from
 * "no skills" to "no skills from outside the repo" (FE-881).
 */
export function sandboxScopedSkills(skills: Skill[], sandboxDir: string): Skill[] {
  const root = resolve(sandboxDir);
  const prefix = root + sep;
  return skills.filter((s) => {
    const p = resolve(s.filePath);
    return p === root || p.startsWith(prefix);
  });
}

/**
 * Resource loader for a cook agent session. The agent still runs on the task
 * prompt (system-prompt override) with prompts and AGENTS files suppressed, but
 * it now sees the target repo's own skills: pi's default discovery scans
 * `<cwd>/<config>/skills` + `<agentDir>/skills` rather than the Agent-Skills
 * convention dirs, so we point it at the repo's `.agents/skills` / `.claude/skills`
 * (deduped by realpath since brunch-style repos symlink the two) and filter the
 * result to paths under the sandbox. Greenfield worktrees have no such dir, so
 * this resolves empty and leaves greenfield behavior unchanged.
 */
export function cookResourceLoader(
  sandboxDir: string,
  agentDir: string,
  systemPrompt: string,
): DefaultResourceLoader {
  const skillDirs = [
    ...new Set(
      [join(sandboxDir, '.agents', 'skills'), join(sandboxDir, '.claude', 'skills')]
        .filter((d) => existsSync(d))
        .map((d) => realpathSync(d)),
    ),
  ];
  return new DefaultResourceLoader({
    cwd: sandboxDir,
    agentDir,
    systemPromptOverride: () => systemPrompt,
    appendSystemPromptOverride: () => [],
    additionalSkillPaths: skillDirs,
    agentsFilesOverride: () => ({ agentsFiles: [] }),
    skillsOverride: (base) => ({
      skills: sandboxScopedSkills(base.skills, sandboxDir),
      diagnostics: base.diagnostics,
    }),
    promptsOverride: () => ({ prompts: [], diagnostics: [] }),
  });
}

// Map one action's inputs to SDK session config — tools/model/system-prompt +
// the target repo's sandbox-scoped skills (see cookResourceLoader), in-memory
// session. Auth from brunch's own ANTHROPIC_API_KEY, not the user's ~/.pi
// credentials, which keeps a fresh checkout self-contained.
async function buildSessionOptions(
  opts: RunPiOpts,
  isolatedDir: string,
  toolHooks: { onStart: () => void; onSettle: () => void },
): Promise<CreateAgentSessionOptions> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set — the in-process pi agent needs it (no pi login / auth.json required)',
    );
  }

  // pi 0.80.8 replaced the `authStorage` + `modelRegistry` session options with
  // a single async `modelRuntime`. Between them these three reproduce the old
  // `ModelRegistry.inMemory` behaviour — built-in models only, no I/O at
  // construction: `modelsPath: null` skips models.json, `allowModelNetwork`
  // gates the create-time catalog fetch (already the default, but stated so an
  // upstream default flip can't quietly put a network call on this path), and
  // `refreshOnCreate: false` skips the initial catalog/availability refresh
  // that create() would otherwise run.
  const modelRuntime = await ModelRuntime.create({
    authPath: join(isolatedDir, 'auth.json'),
    modelsPath: null,
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
  await modelRuntime.setRuntimeApiKey('anthropic', apiKey);
  const model = modelRuntime.getModel('anthropic', opts.model);
  if (!model) {
    throw new Error(`model anthropic/${opts.model} not found in the pi model registry`);
  }

  const systemPrompt = readFileSync(opts.promptFile, 'utf8');
  const resourceLoader = cookResourceLoader(opts.sandboxDir, isolatedDir, systemPrompt);
  await resourceLoader.reload();

  // Supply the built-in tools ourselves (instrumented), instead of the `tools`
  // name allowlist, so each tool call emits a "what the agent is doing"
  // heartbeat into the current wait. `noTools:'builtin'` drops the default
  // read/bash/edit/write so they aren't double-registered.
  const toolNames = opts.tools
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const customTools = buildInstrumentedTools(
    toolNames,
    opts.sandboxDir,
    (label) => {
      _emit({ kind: 'activity-progress', id: opts.activityId ?? opts.label, detail: label });
      toolHooks.onStart();
    },
    toolHooks.onSettle,
    opts.confine !== false,
  );

  return {
    cwd: opts.sandboxDir,
    agentDir: isolatedDir,
    model,
    modelRuntime,
    resourceLoader,
    noTools: 'builtin',
    tools: toolNames,
    customTools,
    sessionManager: SessionManager.inMemory(opts.sandboxDir),
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  };
}

// In-process (not a spawned CLI) so brunch is self-contained. Each run gets a
// throwaway agent/auth dir to keep concurrent slices isolated; the dir is removed
// after the session ends. Output is buffered from text_delta events, never written
// to brunch's stdout (keeps the cook SSE stream clean); the timeout is an idle
// deadline covering both session setup and the prompt turn — any session event
// re-arms it and an in-flight tool call (e.g. a long `bash`) pauses it, so only
// true dead air trips it, aborting cooperatively once a session exists.
async function runPi(
  opts: RunPiOpts,
  deps: { createSession?: SessionFactory; timeoutMs?: number; maxOutput?: number } = {},
): Promise<PiResult> {
  const createSession = deps.createSession ?? createAgentSession;
  const timeoutMs = deps.timeoutMs ?? PI_TIMEOUT_MS;
  const maxOutput = deps.maxOutput ?? PI_MAX_OUTPUT;
  const start = Date.now();
  const activityId = opts.activityId ?? opts.label;
  // Open a live wait so the agent session isn't dead air in the UI.
  _emit({ kind: 'activity-start', id: activityId, label: opts.label });
  let heartbeatKb = 0;

  let isolatedDir: string | undefined;
  let cleanedAgentDir = false;
  const cleanupAgentDir = (): void => {
    if (!isolatedDir) return;
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
  // Per-action telemetry (FE-894 P0): session-setup vs prompt-turn wall-clock,
  // and the prompt's token usage (incl. prompt-cache reads/writes). Read from
  // getSessionStats after the single prompt resolves; best-effort, never fatal.
  let coldStartMs = 0;
  let promptMs = 0;
  let usage = sessionStatsToUsage(undefined);
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTimeout: ((err: Error) => void) | undefined;
  // Tool calls currently executing. A tool in flight (e.g. a multi-minute
  // `bash` test run) is active work that emits no session traffic, so the idle
  // deadline must not count its duration — pause while any tool runs.
  let inFlightTools = 0;
  // Re-armable idle deadline: cleared and reset on every session event so the
  // budget bounds silence, not total work. A heavy slice whose agent spends
  // minutes in a single test command between edits stays alive as long as the
  // session keeps emitting; only genuine dead air for `timeoutMs` aborts it.
  const armIdleTimer = (): void => {
    if (timedOut) return;
    if (timer) clearTimeout(timer);
    // Don't count idle time while a tool is mid-execution; its settle hook
    // re-arms once it finishes.
    if (inFlightTools > 0) return;
    timer = setTimeout(() => {
      timedOut = true;
      void session?.abort();
      rejectTimeout?.(piTimeoutError(timeoutMs));
    }, timeoutMs);
  };
  // Bracket every tool call: pause the idle deadline while it runs (a long
  // silent `bash` must not trip the timeout mid-command), resume on settle.
  const onToolStart = (): void => {
    inFlightTools += 1;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  const onToolSettle = (): void => {
    inFlightTools = Math.max(0, inFlightTools - 1);
    if (inFlightTools === 0) armIdleTimer();
  };
  const timeout = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
    armIdleTimer();
  });

  try {
    const setupStart = Date.now();
    isolatedDir = createAgentDir();
    const agentDir = isolatedDir;
    const setup = (async () => {
      const created = await createSession(
        await buildSessionOptions(opts, agentDir, { onStart: onToolStart, onSettle: onToolSettle }),
      );
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
    coldStartMs = Date.now() - setupStart;

    unsubscribe = session.subscribe((event) => {
      // Any activity — text, tool call, tool-execution progress, thinking —
      // is liveness: push the idle deadline forward.
      armIdleTimer();
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
        // Throttled heartbeat — every 2 KB — surface what the agent is currently
        // saying (its latest line) instead of a raw byte count, so the wait reads
        // as live work, not just "still going".
        const kb = Math.floor(capturedBytes / 1024);
        if (kb >= heartbeatKb + 2) {
          heartbeatKb = kb;
          const snippet = latestLine(captured);
          if (snippet) _emit({ kind: 'activity-progress', id: activityId, detail: snippet });
        }
      }
    });

    try {
      const promptStart = Date.now();
      await Promise.race([session.prompt(opts.task), timeout]);
      promptMs = Date.now() - promptStart;
      // Fresh-session-per-action ⇒ cumulative stats == this action's usage.
      try {
        usage = sessionStatsToUsage(session.getSessionStats());
      } catch {
        // Telemetry is best-effort; a stats read must never fail the action.
      }
      agentFailure = finalAgentFailure(session);
    } catch (err) {
      promptError = err;
    }
  } finally {
    if (timer) clearTimeout(timer);
    unsubscribe?.();
    session?.dispose();
    cleanupAgentDir();
    // Always close the wait — even on timeout / overflow / prompt error — so
    // the spinner can never hang.
    _emit({ kind: 'activity-end', id: activityId });
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
  return { output: captured, usage, timingMs: { coldStartMs, promptMs } };
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
export function sliceTestTask(slice: Slice, toolchain: Toolchain, harnessNotes?: string): string {
  const targets = slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');
  return withHarnessNotes(
    `Write failing tests for slice "${slice.id}": ${slice.definition}\nVerification targets: ${targets}\nWrite test files that will initially fail. ${toolchain.testConventions}`,
    harnessNotes,
  );
}

/** Build the cook epic-verify task — toolchain-supplied conventions, as above. */
export function epicVerifyTask(epic: Epic, toolchain: Toolchain, harnessNotes?: string): string {
  const targets = epic.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');
  return withHarnessNotes(
    `Write an integration test for epic "${epic.id}": ${epic.summary}\nThis test should verify that all slices in this epic work together correctly.\nVerification targets: ${targets}\nWrite the test file(s). ${toolchain.testConventions} Then run them to verify they pass.`,
    harnessNotes,
  );
}

export function epicRemediateTask(epic: Epic, harnessNotes?: string): string {
  const targets = epic.verification.map((v) => `${v.kind}: ${v.target}`).join(', ');
  return withHarnessNotes(
    `Remediate the failing integration test for epic "${epic.id}": ${epic.summary}\nThe slices in this epic each pass on their own, but the epic's integration test fails now that they are folded together in this tree. Read the failing test, find the cross-slice defect, and fix the product code so the test passes.\nVerification targets: ${targets}\nDo not modify the integration test or any test file — fix the implementation, not the oracle.`,
    harnessNotes,
  );
}

/**
 * Append plan-supplied harness prior-art (FE-894 ①) to an agent task so slice
 * agents apply the project's known build/framework seams instead of
 * rediscovering them every slice. Absent/empty notes leave the task untouched.
 */
function withHarnessNotes(task: string, harnessNotes?: string): string {
  const notes = harnessNotes?.trim();
  if (!notes) return task;
  return `${task}\nProject harness notes (prior art — apply these, do not rediscover): ${notes}`;
}

export function createPiActions(opts?: {
  verbose?: boolean;
  /** Presentation sink. Per-action progress is emitted as CookEvents; defaults to no-op. */
  emit?: (event: CookEvent) => void;
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
  confine?: boolean;
}): ActionHandlers {
  _verbose = opts?.verbose ?? false;
  _emit = opts?.emit ?? (() => {});
  const toolchain = opts?.toolchain ?? defaultToolchain;
  const testRunner = opts?.testRunner ?? new ToolchainTestRunner(toolchain);
  const groundProbe = opts?.groundProbe;
  const piDeps = opts?.createSession ? { createSession: opts.createSession } : {};
  const confine = opts?.confine ?? true;

  return {
    'evaluate-done': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      _emit({ kind: 'slice', id: ctx.slice.id, epicId: ctx.epic.id, status: 'running', step: 'verify' });
      log('?', `evaluate  ${label}`);
      const { done, failureKind, results } = await withActivity(
        ctx.slice.id,
        `running tests · ${label}`,
        () => runVerification(ctx.slice.verification, testRunner, ctx.sandboxDir),
      );
      // `absent` = the gate ran before any test file exists (greenfield). That
      // is "not started", not a red — it must not consume an attempt or paint a
      // ✗ NEEDS WORK. The slice stays running and flows on to write-tests.
      const notStarted = !done && failureKind === 'absent';
      for (const r of results) {
        logVerbose(r.output);
        log(r.passed ? '✓' : r.failureKind === 'absent' ? '·' : '✗', `verify    ${r.target}`);
      }
      log(
        done ? '●' : notStarted ? '·' : '○',
        `verdict   ${label} → ${done ? 'DONE' : notStarted ? 'NOT STARTED' : 'NEEDS WORK'}`,
      );
      if (done) {
        _emit({ kind: 'slice', id: ctx.slice.id, epicId: ctx.epic.id, status: 'passed' });
      } else if (!notStarted) {
        _emit({
          kind: 'slice',
          id: ctx.slice.id,
          epicId: ctx.epic.id,
          status: 'failed',
          reason: failureKind === 'infra' ? 'infra error' : 'tests failed',
        });
      }
      return report(ctx, 'evaluator', 'eval-done', { done, failureKind, results });
    },

    'write-tests': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      _emit({ kind: 'slice', id: ctx.slice.id, epicId: ctx.epic.id, status: 'running', step: 'tests' });
      log('▸', `tests     ${label}`);
      const task = sliceTestTask(ctx.slice, toolchain, ctx.plan.harnessNotes);

      let piResult: PiResult;
      try {
        piResult = await runPi(
          {
            label: `tests     ${label}`,
            model: 'claude-opus-4-8',
            promptFile: join(promptsDir, 'test-writer.md'),
            task,
            sandboxDir: ctx.sandboxDir,
            tools: toolsForAction('write-tests'),
            activityId: ctx.slice.id,
            confine,
          },
          piDeps,
        );
      } catch (err) {
        _emit({
          kind: 'slice',
          id: ctx.slice.id,
          epicId: ctx.epic.id,
          status: 'failed',
          reason: 'test authoring failed',
        });
        throw err;
      }

      return report(ctx, 'test-writer', 'tests-written', {
        sliceId: ctx.slice.id,
        targets: ctx.slice.verification.map((v) => v.target),
        usage: piResult.usage,
        timingMs: piResult.timingMs,
      });
    },

    'write-code': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      _emit({ kind: 'slice', id: ctx.slice.id, epicId: ctx.epic.id, status: 'running', step: 'code' });
      log('▸', `code      ${label}`);
      const task = withHarnessNotes(
        `Write code to make tests pass for slice "${ctx.slice.id}": ${ctx.slice.definition}\nVerification targets: ${ctx.slice.verification.map((v) => `${v.kind}: ${v.target}`).join(', ')}\nImplement the minimum code to make all tests pass.`,
        ctx.plan.harnessNotes,
      );

      let piResult: PiResult;
      try {
        piResult = await runPi(
          {
            label: `code      ${label}`,
            model: 'claude-opus-4-8',
            promptFile: join(promptsDir, 'code-writer.md'),
            task,
            sandboxDir: ctx.sandboxDir,
            tools: toolsForAction('write-code'),
            activityId: ctx.slice.id,
            confine,
          },
          piDeps,
        );
      } catch (err) {
        _emit({
          kind: 'slice',
          id: ctx.slice.id,
          epicId: ctx.epic.id,
          status: 'failed',
          reason: 'code authoring failed',
        });
        throw err;
      }

      return report(ctx, 'code-writer', 'code-written', {
        sliceId: ctx.slice.id,
        usage: piResult.usage,
        timingMs: piResult.timingMs,
      });
    },

    'assess-semantic': async (ctx: ActionContext) => {
      const label = sliceLabel(ctx.slice);
      log('?', `semantic  ${label}`);
      // POC: auto-satisfy — real semantic assessment requires graph-derived
      // gates (Phase 3). The `semantic-assessed` payload carries a wire-ready
      // `disposition` slot (`rework` | `needs-human-review`, FE-885 D173-K) that
      // the exec-progress projector maps to a `needs-review` requirement status;
      // the stub emits none, so `needs-review` is inert in v1.
      const payload: SemanticAssessedPayload = { satisfied: true };
      return report(ctx, 'semantic-assessor', 'semantic-assessed', payload);
    },

    'verify-epic': async (ctx: ActionContext) => {
      log('▸', `verify    ${ctx.epic.id}`);
      const writeTask = epicVerifyTask(ctx.epic, toolchain, ctx.plan.harnessNotes);

      let piResult: PiResult;
      try {
        piResult = await runPi(
          {
            label: `verify    ${ctx.epic.id} (write)`,
            model: 'claude-opus-4-8',
            promptFile: join(promptsDir, 'test-writer.md'),
            task: writeTask,
            sandboxDir: ctx.sandboxDir,
            tools: toolsForAction('verify-epic'),
            confine,
          },
          piDeps,
        );
      } catch (err) {
        // Mirror write-tests/write-code: a thrown runPi must paint a failed row
        // (on the epic's representative slice) with a reason, not vanish silently.
        _emit({
          kind: 'slice',
          id: ctx.slice.id,
          epicId: ctx.epic.id,
          status: 'failed',
          reason: 'epic verification failed',
        });
        throw err;
      }

      const {
        done: testsPassed,
        failureKind,
        results,
      } = await withActivity(`verify-epic ${ctx.epic.id}`, `running tests · ${ctx.epic.id}`, () =>
        runVerification(ctx.epic.verification, testRunner, ctx.sandboxDir),
      );
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
          if (target) {
            probe = await withActivity(
              `probe ${ctx.epic.id}`,
              `probing reachability · ${ctx.epic.id}`,
              async () => runProbe(await buildProbeSpec(target), ctx.sandboxDir),
            );
          }
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
      const combinedFailureKind = failureKind ?? (probe?.kind === 'infra' ? 'infra' : undefined);

      log(passed ? '●' : '✗', `epic      ${ctx.epic.id} → ${passed ? 'PASS' : 'FAIL'}`);
      return report(ctx, 'orchestrator', 'epic-verified', {
        passed,
        failureKind: combinedFailureKind,
        ...(probe ? { reachability: probe.kind } : {}),
        usage: piResult.usage,
        timingMs: piResult.timingMs,
      });
    },

    'remediate-epic': async (ctx: ActionContext) => {
      log('▸', `remediate ${ctx.epic.id}`);
      let piResult: PiResult;
      try {
        piResult = await runPi(
          {
            label: `remediate ${ctx.epic.id}`,
            model: 'claude-opus-4-8',
            promptFile: join(promptsDir, 'code-writer.md'),
            task: epicRemediateTask(ctx.epic, ctx.plan.harnessNotes),
            sandboxDir: ctx.sandboxDir,
            tools: toolsForAction('remediate-epic'),
            confine,
          },
          piDeps,
        );
      } catch (err) {
        _emit({
          kind: 'slice',
          id: ctx.slice.id,
          epicId: ctx.epic.id,
          status: 'failed',
          reason: 'epic remediation failed',
        });
        throw err;
      }

      return report(ctx, 'coding-agent', 'remediation-agent-done', {
        sliceId: ctx.slice.id,
        usage: piResult.usage,
        timingMs: piResult.timingMs,
      });
    },
  };
}
