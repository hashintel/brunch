import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StructuredExchangeToolResultDetails } from '../.pi/extensions/exchanges/index.js';

interface ProbeMetadata {
  name: string;
  transport: 'pi-rpc-editor';
}

interface FrictionReport {
  blockers: string[];
  frictions: string[];
}

type TerminalDetails = StructuredExchangeToolResultDetails & {
  probe: ProbeMetadata;
  frictionReport: FrictionReport;
};

interface ProofResultEntry {
  customType: string;
  data: unknown;
}

export interface StructuredExchangeRpcProofResult {
  scenario: {
    mission: string;
    evaluationFocus: string;
    maxTurns: number;
  };
  editorRequest: {
    type: 'extension_ui_request';
    id: string;
    method: 'editor';
    title?: string;
    prefill?: string;
  };
  terminalDetails: TerminalDetails;
  sessionFile: string;
  stdout: unknown[];
}

interface StructuredExchangeRpcProofOptions {
  cwd?: string;
  timeoutMs?: number;
}

const PROOF_CUSTOM_TYPE = 'brunch.structured_exchange_rpc_proof_result';

const scenario = {
  mission: 'Complete a multi-choice structured exchange as an agent-as-user evaluator.',
  evaluationFocus:
    'Verify that selected choices and an optional comment survive the Pi RPC request_choices editor envelope as structured terminal details.',
  maxTurns: 1,
};

export async function runStructuredExchangeRpcProof(
  options: StructuredExchangeRpcProofOptions = {},
): Promise<StructuredExchangeRpcProofResult> {
  const cwd = options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-exchange-rpc-proof-')));
  const timeoutMs = options.timeoutMs ?? 10_000;
  const extensionPath = await writeProofExtension(cwd);
  const sessionDir = join(cwd, '.brunch', 'sessions');
  await mkdir(sessionDir, { recursive: true });

  const child = spawn(
    process.execPath,
    [
      piCliPath(),
      '--mode',
      'rpc',
      '--no-extensions',
      '--extension',
      extensionPath,
      '--session-dir',
      sessionDir,
    ],
    {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    },
  );

  const client = new RpcProbeClient(child, timeoutMs);
  try {
    const promptAccepted = client.waitFor(
      (event): event is RpcResponse => isRpcResponse(event) && event.command === 'prompt',
    );
    child.stdin.write(
      `${JSON.stringify({ id: 'proof', type: 'prompt', message: '/brunch-structured-exchange-rpc-proof' })}\n`,
    );

    const editorRequest = await client.waitFor(
      (event): event is StructuredExchangeRpcProofResult['editorRequest'] => isEditorRequest(event),
    );
    child.stdin.write(
      `${JSON.stringify({
        type: 'extension_ui_response',
        id: editorRequest.id,
        value: answeredEditorPayload(editorRequest.prefill),
      })}\n`,
    );

    const promptResponse = await promptAccepted;
    if (!promptResponse.success) {
      throw new Error(`Proof command failed: ${promptResponse.error ?? 'unknown error'}`);
    }

    const stateResponse = client.waitFor(
      (event): event is RpcResponse<{ sessionFile?: string }> => isRpcResponse(event) && event.id === 'state',
    );
    child.stdin.write(`${JSON.stringify({ id: 'state', type: 'get_state' })}\n`);
    const state = await stateResponse;
    const sessionFile = state.data?.sessionFile;
    if (!state.success || typeof sessionFile !== 'string') {
      throw new Error('RPC proof did not expose a persisted session file');
    }

    return {
      scenario,
      editorRequest,
      terminalDetails: await readProofDetails(sessionFile),
      sessionFile,
      stdout: client.events,
    };
  } finally {
    client.dispose();
  }
}

async function writeProofExtension(cwd: string): Promise<string> {
  const extensionPath = join(cwd, 'structured-exchange-rpc-proof-extension.ts');
  const adapterPath = resolve('src/.pi/extensions/exchanges/index.ts');
  const content = `
    import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
    import { requestChoicesViaEditor } from ${JSON.stringify(adapterPath)}

    const params = {
      exchangeId: "structured-exchange-rpc-proof",
      prompt: "Which implementation path should the evaluator choose?",
      choices: [
        { id: "rpc-fallback", label: "Ship RPC fallback" },
        { id: "wait-web", label: "Wait for web relay" },
        { id: "blocker", label: "Escalate blocker" },
      ],
    } as const

    export default function(pi: ExtensionAPI): void {
      pi.registerCommand("brunch-structured-exchange-rpc-proof", {
        description: "Exercise the Brunch request_choices editor envelope over Pi RPC.",
        handler: async (_args, ctx) => {
          const result = await requestChoicesViaEditor(params, (prefill) =>
            ctx.ui.editor("Answer structured exchange as JSON", prefill),
          )
          const details = {
            ...result.details,
            probe: { name: "structured-exchange-rpc-proof", transport: "pi-rpc-editor" },
            frictionReport: { blockers: [], frictions: [] },
          }
          ctx.sessionManager.appendMessage({
            role: "assistant",
            content: result.content,
            api: "openai-completions",
            provider: "openai",
            model: "test-model",
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: "stop",
            timestamp: Date.now(),
          })
          pi.appendEntry(${JSON.stringify(PROOF_CUSTOM_TYPE)}, details)
          ctx.ui.notify(result.content[0]?.text ?? "Structured exchange completed.", "info")
        },
      })
    }
  `;
  await writeFile(extensionPath, content, 'utf8');
  return extensionPath;
}

function answeredEditorPayload(prefill: string | undefined): string {
  if (!prefill) throw new Error('RPC editor request did not include a prefill');
  const payload = JSON.parse(prefill) as { response?: unknown };
  payload.response = {
    status: 'answered',
    choices: [{ id: 'rpc-fallback', label: 'Ship RPC fallback' }],
    comment: 'Proceed, but report any relay friction separately.',
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

async function readProofDetails(
  sessionFile: string,
): Promise<StructuredExchangeRpcProofResult['terminalDetails']> {
  const entries = (await readFile(sessionFile, 'utf8'))
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
  const proofEntry = entries.find(
    (entry): entry is ProofResultEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { customType?: unknown }).customType === PROOF_CUSTOM_TYPE &&
      'data' in entry,
  );
  if (!proofEntry) {
    throw new Error('RPC proof result entry was not written to the session');
  }
  return proofEntry.data as StructuredExchangeRpcProofResult['terminalDetails'];
}

function piCliPath(): string {
  return fileURLToPath(
    new URL('../../node_modules/@earendil-works/pi-coding-agent/dist/cli.js', import.meta.url),
  );
}

interface RpcResponse<T = unknown> {
  type: 'response';
  id?: string;
  command: string;
  success: boolean;
  data?: T;
  error?: string;
}

function isRpcResponse(value: unknown): value is RpcResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'response' &&
    typeof (value as { command?: unknown }).command === 'string' &&
    typeof (value as { success?: unknown }).success === 'boolean'
  );
}

function isEditorRequest(value: unknown): value is StructuredExchangeRpcProofResult['editorRequest'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'extension_ui_request' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (value as { method?: unknown }).method === 'editor'
  );
}

class RpcProbeClient {
  readonly events: unknown[] = [];
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #timeoutMs: number;
  #stdout = '';
  #stderr = '';
  #waiters: Array<{
    predicate: (event: unknown) => boolean;
    resolve: (event: unknown) => void;
  }> = [];

  constructor(child: ChildProcessWithoutNullStreams, timeoutMs: number) {
    this.#child = child;
    this.#timeoutMs = timeoutMs;
    child.stdout.on('data', (chunk) => this.#ingestStdout(String(chunk)));
    child.stderr.on('data', (chunk) => {
      this.#stderr += String(chunk);
    });
  }

  waitFor<T>(predicate: (event: unknown) => event is T): Promise<T> {
    const existing = this.events.find(predicate);
    if (existing) return Promise.resolve(existing);

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for RPC proof event. Stderr:\n${this.#stderr}`));
      }, this.#timeoutMs);
      this.#waiters.push({
        predicate,
        resolve: (event) => {
          clearTimeout(timeout);
          resolve(event as T);
        },
      });
    });
  }

  dispose(): void {
    this.#child.kill('SIGTERM');
  }

  #ingestStdout(chunk: string): void {
    this.#stdout += chunk;
    while (true) {
      const newline = this.#stdout.indexOf('\n');
      if (newline === -1) return;
      const line = this.#stdout.slice(0, newline).replace(/\r$/, '');
      this.#stdout = this.#stdout.slice(newline + 1);
      if (line.trim().length === 0) continue;
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      this.events.push(event);
      const waiters = this.#waiters.slice();
      for (const waiter of waiters) {
        if (!waiter.predicate(event)) continue;
        this.#waiters = this.#waiters.filter((candidate) => candidate !== waiter);
        waiter.resolve(event);
      }
    }
  }
}
