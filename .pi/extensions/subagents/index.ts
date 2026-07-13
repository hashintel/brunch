/**
 * RPC-based subagents extension (file-based config).
 *
 * Vendored copy — canonical source: ~/.pi/agent/extensions/subagents/index.ts.
 * Sync direction is user-level → project; edit the canonical file and re-copy.
 *
 * Directory layout:
 *
 *   subagents/
 *   ├── index.ts        # this file — the RPC supervisor + agent discovery
 *   ├── config.json     # { version, maxConcurrency, toolExtensions? }
 *   └── tools/          # (optional) co-located tool extensions for subagents,
 *                       #   referenced by relative path in config.toolExtensions
 *
 * Each subagent runs as an isolated `pi` process via the SUPPORTED RpcClient
 * (typed JSONL protocol) rather than parsing `--mode json -p` NDJSON by hand.
 * This keeps the host TUI responsive (separate event loop + heap per subagent),
 * makes recursion a process tree that is trivial to cap/kill, and sidesteps the
 * process-global provider registry in pi-ai.
 *
 * Agent discovery (all ambient — the extension bundles no agents of its own):
 *   - User-level: `~/.pi/agent/subagents/*.md` (getAgentDir()-based). Relative
 *     `skills:` paths resolve against that directory.
 *   - Project: trusted `<cwd>/.pi/subagents/*.md`, found by walking up from cwd,
 *     parsed per invocation; overrides same-named user-level agents. Relative
 *     `skills:` paths resolve from the project root.
 *   - Dynamic: other extensions may push agents via globalThis.__pi_subagents
 *     (needed because pi loads each extension as a separate jiti module).
 *
 * Dual copies: a project may vendor this extension at `.pi/extensions/subagents/`
 * so the scheme works on machines without the user-level install. pi loads
 * project extensions first and keeps the first-registered `subagent` tool; the
 * globalThis sentinel below makes any later copy deactivate cleanly instead of
 * double-registering.
 *
 * Recursion: an agent whose frontmatter declares `subagent_agents` gets this
 * extension re-injected into its child process (--extension) plus a
 * PI_SUBAGENT_ALLOWED env allowlist, so the child sees only the permitted
 * agents. A hard MAX_DEPTH ceiling + per-process concurrency cap bound it.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONFIG_DIR_NAME,
  type ExtensionAPI,
  getAgentDir,
  parseFrontmatter,
  RpcClient,
  type Theme,
  withFileMutationQueue,
} from '@earendil-works/pi-coding-agent';
import { Container, Spacer, Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';

// ── Types ──────────────────────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  description: string;
  tools: string[];
  model: string;
  thinking: string;
  systemPrompt: string;
  filePath: string;
  /** Explicit skill paths resolved when the agent definition is loaded. */
  skillPaths: string[];
  /**
   * If this agent has the `subagent` tool, restrict which agents it may spawn.
   * Passed to the child via PI_SUBAGENT_ALLOWED. `undefined` = no restriction.
   */
  subagentAgents?: string[];
}

interface ExtConfig {
  version?: number;
  maxConcurrency?: number;
  /** name → path (absolute, or relative to this extension dir) of a tool extension. */
  toolExtensions?: Record<string, string>;
}

// ── Paths & constants ──────────────────────────────────────────────────

const EXT_FILE = fileURLToPath(import.meta.url);
const EXT_DIR = path.dirname(EXT_FILE);
const CONFIG_PATH = path.join(EXT_DIR, 'config.json');

/** User-level ambient agent definitions (read per call so env overrides apply). */
export function userAgentsDir(): string {
  return path.join(getAgentDir(), 'subagents');
}

/** Hard ceiling on nesting depth (root prompt = depth 0). */
const MAX_DEPTH = 4;
const DEFAULT_MAX_CONCURRENCY = 4;
const SUBAGENT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RECENT_TOOLS = 8;
const PROGRESS_THROTTLE_MS = 150;

const BUILTIN_TOOLS = new Set(['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls']);

// ── Lineage (inherited from the parent process via env; root has none) ──

const CURRENT_DEPTH = Number.parseInt(process.env.PI_SUBAGENT_DEPTH ?? '0', 10) || 0;
const ROOT_ID = process.env.PI_SUBAGENT_ROOT ?? randomUUID();
const ALLOWED_AGENTS = parseAllowed(process.env.PI_SUBAGENT_ALLOWED);

function parseAllowed(value: string | undefined): Set<string> | undefined {
  if (value === undefined) return undefined; // root: all agents allowed
  const list = splitList(value);
  return list.length > 0 ? new Set(list) : new Set();
}

// ── Concurrency primitive ──────────────────────────────────────────────

class Semaphore {
  private active = 0;
  private readonly max: number;
  private readonly queue: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

// ── Mutable state (populated in the extension entry point) ──────────────

let agents: AgentConfig[] = [];
let customToolExtensions: Record<string, string> = {};
let semaphore = new Semaphore(DEFAULT_MAX_CONCURRENCY);

// ── Agent discovery & registration ─────────────────────────────────────

function registerAgent(config: AgentConfig): void {
  // A child process pinned by its parent silently ignores out-of-allowlist agents.
  if (ALLOWED_AGENTS && !ALLOWED_AGENTS.has(config.name)) return;
  if (agents.some((a) => a.name === config.name)) {
    throw new Error(`Agent already registered: ${config.name}`);
  }
  agents.push(config);
}

function unregisterAgent(name: string): void {
  agents = agents.filter((a) => a.name !== name);
}

// Expose registration globally so other extensions (separate jiti modules) can
// register their own agents against the same registry the tool reads. The
// sentinel doubles as a dual-copy guard: when a project-vendored copy of this
// extension loaded first, this module instance stays inert (see activation).
const OWNS_REGISTRY = (globalThis as Record<string, unknown>).__pi_subagents === undefined;
if (OWNS_REGISTRY) {
  (globalThis as Record<string, unknown>).__pi_subagents = { registerAgent, unregisterAgent };
}

export function loadAgentsFromDir(agentsDir: string): AgentConfig[] {
  const loaded: AgentConfig[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  } catch {
    return loaded;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.name.endsWith('.md') || (!entry.isFile() && !entry.isSymbolicLink())) continue;
    const filePath = path.join(agentsDir, entry.name);
    try {
      const { frontmatter, body } = parseFrontmatter(fs.readFileSync(filePath, 'utf-8'));
      const name = asString(frontmatter.name);
      if (!name) continue;
      const subagentRaw = asString(frontmatter.subagent_agents);
      loaded.push({
        name,
        description: asString(frontmatter.description) ?? '',
        tools: splitList(asString(frontmatter.tools)),
        model: asString(frontmatter.model) ?? 'anthropic/claude-sonnet-4-6',
        thinking: asString(frontmatter.thinking) ?? 'medium',
        systemPrompt: body,
        filePath,
        skillPaths: resolveAgentSkillPaths(frontmatter.skills, filePath),
        subagentAgents: subagentRaw ? splitList(subagentRaw) : undefined,
      });
    } catch {
      // Ignore unreadable or malformed definitions without hiding the remaining roster.
    }
  }
  return loaded;
}

function findNearestProjectAgentsDir(cwd: string): string | undefined {
  let current = path.resolve(cwd);
  while (true) {
    const candidate = path.join(current, CONFIG_DIR_NAME, 'subagents');
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Keep walking toward the filesystem root.
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function discoverAgents(cwd: string, includeProjectAgents: boolean): AgentConfig[] {
  // Precedence, lowest to highest: dynamic registrations, user-level ambient
  // definitions, trusted project definitions. Both ambient dirs are re-read per
  // invocation so edits apply without restarting pi.
  const merged = new Map(agents.map((agent) => [agent.name, agent]));
  const ambientDirs = [userAgentsDir()];
  const projectDir = includeProjectAgents ? findNearestProjectAgentsDir(cwd) : undefined;
  if (projectDir) ambientDirs.push(projectDir);
  for (const dir of ambientDirs) {
    for (const agent of loadAgentsFromDir(dir)) {
      if (!ALLOWED_AGENTS || ALLOWED_AGENTS.has(agent.name)) merged.set(agent.name, agent);
    }
  }
  return [...merged.values()];
}

function findAgent(name: string, availableAgents: AgentConfig[]): AgentConfig {
  const agent = availableAgents.find((a) => a.name === name);
  if (!agent) {
    const names = availableAgents.map((a) => a.name).join(', ') || '(none)';
    throw new Error(`Unknown or not-permitted subagent: "${name}". Available at this depth: ${names}`);
  }
  return agent;
}

// ── Config ─────────────────────────────────────────────────────────────

function loadConfig(): ExtConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as ExtConfig;
    }
  } catch {
    // malformed config → fall back to defaults
  }
  return {};
}

function resolveToolExtensions(config: ExtConfig): Record<string, string> {
  // Custom (non-builtin) tools are declared in config.json as name → extension
  // path (absolute, or relative to this extension dir — e.g. a file in tools/).
  const map: Record<string, string> = {};
  for (const [name, target] of Object.entries(config.toolExtensions ?? {})) {
    map[name] = path.isAbsolute(target) ? target : path.resolve(EXT_DIR, target);
  }
  return map;
}

// ── pi CLI resolution (RpcClient always invokes `node <cliPath>`) ───────

function resolvePiCliPath(): string {
  const entry = process.argv[1];
  if (entry) {
    try {
      const real = fs.realpathSync(entry);
      if (/\.(?:mjs|cjs|js)$/i.test(real)) return real;
    } catch {
      // fall through to error below
    }
  }
  throw new Error('subagents: could not resolve the pi CLI entry (process.argv[1]) for RPC mode');
}

// ── Result model ───────────────────────────────────────────────────────

interface RecentTool {
  tool: string;
  args: string;
}

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  cost: number;
}

interface SubagentResult {
  agent: string;
  task: string;
  depth: number;
  status: 'running' | 'completed' | 'failed';
  output: string;
  error?: string;
  model: string;
  toolCount: number;
  recentTools: RecentTool[];
  lastMessage: string;
  durationMs: number;
  usage: Usage;
}

interface Details {
  mode: 'single' | 'parallel';
  results: SubagentResult[];
}

interface ResolvedAgentSettings {
  model: string;
  thinking: string;
}

export function resolveAgentSettings(
  agent: Pick<AgentConfig, 'name' | 'model' | 'thinking'>,
  parentModel: string | undefined,
  parentThinking: string,
): ResolvedAgentSettings {
  if (agent.model === 'inherit' && !parentModel) {
    throw new Error(`Agent "${agent.name}" cannot inherit a model because the parent has no active model`);
  }
  return {
    model: agent.model === 'inherit' ? parentModel! : agent.model,
    thinking: agent.thinking === 'inherit' ? parentThinking : agent.thinking,
  };
}

function initialResult(agent: AgentConfig, task: string, settings: ResolvedAgentSettings): SubagentResult {
  return {
    agent: agent.name,
    task,
    depth: CURRENT_DEPTH + 1,
    status: 'running',
    output: '',
    model: settings.model,
    toolCount: 0,
    recentTools: [],
    lastMessage: '',
    durationMs: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0 },
  };
}

// ── Child process argument / env construction ──────────────────────────

function canRecurse(agent: AgentConfig): boolean {
  return CURRENT_DEPTH + 1 < MAX_DEPTH && (agent.subagentAgents?.length ?? 0) > 0;
}

export function buildArgs(agent: AgentConfig, settings: ResolvedAgentSettings, promptPath: string): string[] {
  const builtin: string[] = [];
  const extensions = new Set<string>();
  const recurse = canRecurse(agent);

  for (const tool of agent.tools) {
    if (BUILTIN_TOOLS.has(tool)) {
      builtin.push(tool);
    } else if (tool === 'subagent') {
      if (recurse) extensions.add(EXT_FILE); // re-inject this extension into the child
    } else if (customToolExtensions[tool]) {
      extensions.add(customToolExtensions[tool]);
    }
  }

  const args = ['--no-session', '--no-skills', '--no-extensions'];
  if (builtin.length > 0) args.push('--tools', builtin.join(','));
  else args.push('--no-tools');
  for (const ext of extensions) args.push('--extension', ext);
  for (const skillPath of agent.skillPaths) {
    if (!fs.existsSync(skillPath)) {
      throw new Error(`Agent "${agent.name}" skill path does not exist: ${skillPath}`);
    }
    args.push('--skill', skillPath);
  }
  args.push(
    '--models',
    settings.model,
    '--thinking',
    settings.thinking,
    '--append-system-prompt',
    promptPath,
  );
  return args;
}

function buildEnv(agent: AgentConfig): Record<string, string> {
  return {
    PI_SUBAGENT_DEPTH: String(CURRENT_DEPTH + 1),
    PI_SUBAGENT_ROOT: ROOT_ID,
    // Empty string = explicitly no further recursion permitted.
    PI_SUBAGENT_ALLOWED: canRecurse(agent) && agent.subagentAgents ? agent.subagentAgents.join(',') : '',
  };
}

// ── Core: run one subagent over RPC ────────────────────────────────────

async function runSubagent(
  agent: AgentConfig,
  task: string,
  settings: ResolvedAgentSettings,
  cwd: string,
  signal: AbortSignal | undefined,
  onProgress: (r: SubagentResult) => void,
): Promise<SubagentResult> {
  const startedAt = Date.now();
  const result = initialResult(agent, task, settings);

  let client: RpcClient | undefined;
  let tempDir: string | undefined;
  let onAbort: (() => void) | undefined;

  try {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pi-subagent-'));
    const promptPath = path.join(tempDir, `${agent.name}.md`);
    await withFileMutationQueue(promptPath, async () => {
      await fs.promises.writeFile(promptPath, agent.systemPrompt, { encoding: 'utf-8', mode: 0o600 });
    });

    client = new RpcClient({
      cliPath: resolvePiCliPath(),
      cwd,
      env: buildEnv(agent),
      args: buildArgs(agent, settings, promptPath),
    });
    const activeClient = client;

    const fireProgress = throttle(() => {
      result.durationMs = Date.now() - startedAt;
      onProgress(result);
    }, PROGRESS_THROTTLE_MS);

    await activeClient.start();

    if (signal) {
      onAbort = () => void activeClient.abort();
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    const unsubscribe = activeClient.onEvent((evt) => {
      if (evt.type === 'tool_execution_start') {
        result.toolCount += 1;
        result.recentTools.push({ tool: evt.toolName, args: previewArgs(evt.args) });
        if (result.recentTools.length > MAX_RECENT_TOOLS) {
          result.recentTools.splice(0, result.recentTools.length - MAX_RECENT_TOOLS);
        }
      } else if (evt.type === 'message_end') {
        const msg = evt.message;
        if (msg.role === 'assistant') {
          const text = extractText(msg.content);
          if (text) result.lastMessage = firstProseLine(text);
          if (msg.errorMessage) result.error = msg.errorMessage;
        }
      }
      fireProgress();
    });

    await activeClient.prompt(`Task: ${task}`);
    await activeClient.waitForIdle(SUBAGENT_TIMEOUT_MS);
    unsubscribe();

    const text = await activeClient.getLastAssistantText();
    if (text) result.output = text;

    const stats = await activeClient.getSessionStats().catch(() => undefined);
    if (stats) {
      result.usage = {
        input: stats.tokens.input,
        output: stats.tokens.output,
        cacheRead: stats.tokens.cacheRead,
        cacheWrite: stats.tokens.cacheWrite,
        total: stats.tokens.total,
        cost: stats.cost,
      };
    }

    result.status = result.error ? 'failed' : 'completed';
    if (!result.output && result.error) result.output = `Error: ${result.error}`;
  } catch (err) {
    result.status = 'failed';
    result.error = err instanceof Error ? err.message : String(err);
    const stderr = client?.getStderr() ?? '';
    if (!result.output) {
      result.output = `Error: ${result.error}${stderr ? `\n${truncate(stderr, 500)}` : ''}`;
    }
  } finally {
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    await client?.stop().catch(() => undefined);
    if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    result.durationMs = Date.now() - startedAt;
  }

  return result;
}

// ── Small helpers ──────────────────────────────────────────────────────

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    .map((entry) => entry.trim());
}

export function resolveAgentSkillPaths(value: unknown, agentFilePath: string): string[] {
  // Project agents (<root>/.pi/subagents/*.md) resolve relative skill paths from
  // the project root; any other location (e.g. ~/.pi/agent/subagents) resolves
  // them relative to the agent file's own directory.
  const agentDir = path.dirname(agentFilePath);
  const configDir = path.dirname(agentDir);
  const baseDir =
    path.basename(agentDir) === 'subagents' && path.basename(configDir) === CONFIG_DIR_NAME
      ? path.dirname(configDir)
      : agentDir;

  return asStringArray(value).map((skillPath) =>
    path.isAbsolute(skillPath) ? path.normalize(skillPath) : path.resolve(baseDir, skillPath),
  );
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function throttle(fn: () => void, ms: number): () => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    const remaining = ms - (Date.now() - last);
    if (remaining <= 0) {
      last = Date.now();
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      fn();
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = undefined;
        fn();
      }, remaining);
    }
  };
}

function isTextBlock(b: unknown): b is { type: 'text'; text: string } {
  return (
    typeof b === 'object' &&
    b !== null &&
    (b as { type?: unknown }).type === 'text' &&
    typeof (b as { text?: unknown }).text === 'string'
  );
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => (isTextBlock(block) ? block.text : ''))
    .filter(Boolean)
    .join('\n');
}

function firstProseLine(text: string): string {
  let inCode = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (!inCode && line) return truncate(line, 120);
  }
  return '';
}

function previewArgs(args: unknown): string {
  if (typeof args !== 'object' || args === null) return '';
  const record = args as Record<string, unknown>;
  for (const key of ['command', 'path', 'pattern', 'query', 'url']) {
    const value = record[key];
    if (typeof value === 'string') return truncate(value, 80);
  }
  return '';
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

function formatResultText(r: SubagentResult, mode: 'single' | 'parallel'): string {
  const body = r.output || '(no output)';
  if (mode === 'single') return body;
  return `## ${r.agent}${r.status === 'failed' ? ' (FAILED)' : ''}\n\n${body}`;
}

// ── Rendering ──────────────────────────────────────────────────────────

function renderOne(r: SubagentResult, theme: Theme, expanded: boolean): Container {
  const c = new Container();
  const icon =
    r.status === 'running'
      ? theme.fg('warning', '⟳')
      : r.status === 'completed'
        ? theme.fg('success', '✓')
        : theme.fg('error', '✗');
  const stats = `[d${r.depth}] ${r.toolCount} tools · ${formatTokens(r.usage.total)} tok · ${formatDuration(r.durationMs)}`;
  c.addChild(
    new Text(`${icon} ${theme.fg('toolTitle', theme.bold(r.agent))} ${theme.fg('dim', stats)}`, 0, 0),
  );
  c.addChild(
    new Text(theme.fg('dim', `Task: ${expanded ? r.task : truncate(r.task.replace(/\n/g, ' '), 80)}`), 0, 0),
  );

  for (const t of r.recentTools) {
    c.addChild(new Text(theme.fg('muted', `  ${t.tool}${t.args ? `: ${truncate(t.args, 60)}` : ''}`), 0, 0));
  }

  if (r.lastMessage) {
    c.addChild(new Text(theme.fg('text', truncate(r.lastMessage, expanded ? 1000 : 100)), 0, 0));
  }

  if (expanded && r.status !== 'running' && r.output) {
    c.addChild(new Spacer(1));
    c.addChild(new Text(theme.fg('toolOutput', r.output), 0, 0));
  }

  if (r.usage.cost > 0) {
    c.addChild(new Text(theme.fg('dim', `$${r.usage.cost.toFixed(4)}`), 0, 0));
  }

  if (r.error) {
    c.addChild(new Text(theme.fg('error', `Error: ${truncate(r.error, expanded ? 1000 : 100)}`), 0, 0));
  }

  return c;
}

// ── Tool schema ────────────────────────────────────────────────────────

const SubagentParams = Type.Object({
  agent: Type.Optional(Type.String({ description: 'Agent name (single mode)' })),
  task: Type.Optional(Type.String({ description: 'Task description (single mode)' })),
  cwd: Type.Optional(Type.String({ description: 'Working directory (single mode)' })),
  tasks: Type.Optional(
    Type.Array(
      Type.Object({
        agent: Type.String({ description: 'Agent name' }),
        task: Type.String({ description: 'Task description' }),
        cwd: Type.Optional(Type.String({ description: 'Working directory' })),
      }),
      { description: 'Parallel mode: array of {agent, task, cwd?} objects' },
    ),
  ),
});

// ── Extension entry point ──────────────────────────────────────────────

export default function subagents(pi: ExtensionAPI): void {
  // Another copy of this extension (project-vendored vs user-level) already owns
  // the registry; pi keeps the first-registered `subagent` tool anyway, so this
  // instance deactivates instead of double-registering.
  if (!OWNS_REGISTRY) return;

  const config = loadConfig();
  semaphore = new Semaphore(config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY);
  customToolExtensions = resolveToolExtensions(config);

  // Roster shown in the tool description: dynamic + user-level agents known at
  // activation. Project agents join per invocation via discoverAgents.
  const roster =
    discoverAgents(process.cwd(), false)
      .map((a) => `${a.name} (${a.description})`)
      .join('; ') || '(none)';
  const projectAgentsNote = `Trusted project agents from ${CONFIG_DIR_NAME}/subagents are discovered per invocation and override same-named user-level agents (~/.pi/agent/subagents).`;

  pi.registerTool({
    name: 'subagent',
    label: 'subagent',
    description: `Delegate a task to an isolated subagent running in its own pi process. Subagents have NO context from this conversation — include everything needed in the task. Available agents: ${roster}. ${projectAgentsNote}`,
    promptSnippet: 'Delegate reasoning-heavy or isolated tasks to subagents',
    promptGuidelines: [
      'Use subagent to delegate codebase exploration (scout), web research (researcher), or isolated code changes (worker).',
      'For multiple independent tasks, pass tasks[] to run them in parallel.',
      'Subagents have NO prior context — put ALL necessary context in the task description.',
    ],
    parameters: SubagentParams,
    executionMode: 'parallel',

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (CURRENT_DEPTH >= MAX_DEPTH) {
        throw new Error(`subagent: maximum nesting depth (${MAX_DEPTH}) reached`);
      }

      const baseCwd = ctx.cwd;
      const taskList =
        params.tasks && params.tasks.length > 0
          ? params.tasks.map((t) => ({ agent: t.agent, task: t.task, cwd: t.cwd ?? baseCwd }))
          : params.agent && params.task
            ? [{ agent: params.agent, task: params.task, cwd: params.cwd ?? baseCwd }]
            : undefined;

      if (!taskList) {
        throw new Error('subagent: provide (agent + task) for single mode, or tasks[] for parallel mode');
      }

      const mode: 'single' | 'parallel' = params.tasks && params.tasks.length > 0 ? 'parallel' : 'single';
      const availableAgents = discoverAgents(ctx.cwd, ctx.isProjectTrusted());
      const selected = taskList.map((t) => findAgent(t.agent, availableAgents)); // validate up front
      const parentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
      const settings = selected.map((agent) =>
        resolveAgentSettings(agent, parentModel, pi.getThinkingLevel()),
      );
      const results: SubagentResult[] = taskList.map((t, i) =>
        initialResult(selected[i], t.task, settings[i]),
      );

      const emit = throttle(() => {
        onUpdate?.({
          content: [{ type: 'text', text: `Running ${results.length} subagent(s)…` }],
          details: { mode, results: [...results] },
        });
      }, PROGRESS_THROTTLE_MS);

      await Promise.all(
        taskList.map((t, i) =>
          semaphore.run(async () => {
            results[i] = await runSubagent(selected[i], t.task, settings[i], t.cwd, signal, (live) => {
              results[i] = live;
              emit();
            });
            emit();
          }),
        ),
      );

      const text = results.map((r) => formatResultText(r, mode)).join('\n\n---\n\n');
      return { content: [{ type: 'text', text }], details: { mode, results } };
    },

    renderCall(args, theme) {
      const title = theme.fg('toolTitle', theme.bold('subagent'));
      if (args.tasks && args.tasks.length > 0) {
        const names = args.tasks.map((t) => t.agent).join(', ');
        return new Text(
          `${title} ${theme.fg('accent', 'parallel')} ${theme.fg('dim', `(${args.tasks.length}: ${names})`)}`,
          0,
          0,
        );
      }
      if (args.agent) {
        const preview = args.task ? truncate(args.task.replace(/\n/g, ' '), 60) : '';
        return new Text(`${title} ${theme.fg('accent', args.agent)} ${theme.fg('dim', preview)}`, 0, 0);
      }
      return new Text(title, 0, 0);
    },

    renderResult(result, options, theme) {
      const details = result.details as Details | undefined;
      const container = new Container();
      if (!details || details.results.length === 0) {
        const first = result.content[0];
        container.addChild(new Text(first?.type === 'text' ? first.text : '(no output)', 0, 0));
        return container;
      }
      details.results.forEach((r, i) => {
        if (i > 0) container.addChild(new Spacer(1));
        container.addChild(renderOne(r, theme, options.expanded));
      });
      return container;
    },
  });
}
