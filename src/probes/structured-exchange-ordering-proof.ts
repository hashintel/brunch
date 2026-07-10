import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StructuredExchangeRequestDetails } from '../.pi/extensions/exchanges/index.js';

interface OrderingScenario {
  mission: string;
  evaluationFocus: string;
  maxTurns: number;
}

interface OrderingVerdict {
  askUiOpenedBeforeResult: boolean;
  jsonlAskPersisted: boolean;
}

interface ToolResultRecord {
  toolName: string;
  details: unknown;
}

export interface StructuredExchangeOrderingProofResult {
  scenario: OrderingScenario;
  verdict: OrderingVerdict;
  eventOrder: string[];
  jsonlToolResultOrder: string[];
  requestDetails: StructuredExchangeRequestDetails;
  sessionFile: string;
  stdout: unknown[];
}

interface StructuredExchangeOrderingProofOptions {
  cwd?: string;
  timeoutMs?: number;
}

const scenario: OrderingScenario = {
  mission: 'Prove same-assistant-message ask collection.',
  evaluationFocus: 'Verify ask opens response UI and persists one durable question+answer result.',
  maxTurns: 1,
};

export async function runStructuredExchangeOrderingProof(
  options: StructuredExchangeOrderingProofOptions = {},
): Promise<StructuredExchangeOrderingProofResult> {
  const cwd = options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-exchange-ordering-')));
  const timeoutMs = options.timeoutMs ?? 10_000;
  const extensionPath = await writeOrderingExtension(cwd);
  const sessionDir = join(cwd, '.brunch', 'sessions');
  await mkdir(sessionDir, { recursive: true });

  const child = spawn(
    process.execPath,
    [
      piCliPath(),
      '--mode',
      'rpc',
      '--no-extensions',
      '--no-builtin-tools',
      '--extension',
      extensionPath,
      '--session-dir',
      sessionDir,
    ],
    {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BRUNCH_FAUX_HARNESS_API_KEY: 'brunch-ordering-faux-key',
        NO_COLOR: '1',
        PI_OFFLINE: '1',
      },
    },
  );

  const client = new RpcProbeClient(child, timeoutMs);
  try {
    const promptPreflightAccepted = client.waitFor(
      (event): event is RpcResponse => isRpcResponse(event) && event.command === 'prompt',
    );
    const agentCompleted = client.waitFor(
      (event): event is Record<string, unknown> => isRecord(event) && event.type === 'agent_end',
    );
    child.stdin.write(
      `${JSON.stringify({ id: 'ordering', type: 'prompt', message: '/brunch-structured-exchange-ordering-proof' })}\n`,
    );

    const editorRequest = await client.waitFor(
      (event): event is ExtensionUiRequest => isExtensionUiRequest(event) && event.method === 'editor',
    );
    child.stdin.write(
      `${JSON.stringify({ type: 'extension_ui_response', id: editorRequest.id, value: 'Sequential ask ordering looks safe for the next parity proof.' })}\n`,
    );

    const promptResponse = await promptPreflightAccepted;
    if (!promptResponse.success) {
      throw new Error(`Ordering proof prompt failed: ${promptResponse.error ?? 'unknown error'}`);
    }
    await agentCompleted;

    const stateResponse = client.waitFor(
      (event): event is RpcResponse<{ sessionFile?: string }> => isRpcResponse(event) && event.id === 'state',
    );
    child.stdin.write(`${JSON.stringify({ id: 'state', type: 'get_state' })}\n`);
    const state = await stateResponse;
    const sessionFile = state.data?.sessionFile;
    if (!state.success || typeof sessionFile !== 'string') {
      throw new Error('Ordering proof did not expose a persisted session file');
    }

    const toolResults = await readToolResults(sessionFile);
    const ask = toolResults.find((result) => result.toolName === 'ask');
    if (!ask) throw new Error('Ordering proof did not persist ask tool result');

    const eventOrder = orderingEvents(client.events);
    const jsonlToolResultOrder = toolResults.map((result) => result.toolName);
    const askStartIndex = eventOrder.indexOf('ask:start');
    const requestUiIndex = eventOrder.indexOf('ui:editor');
    const askEndIndex = eventOrder.indexOf('ask:end');

    return {
      scenario,
      verdict: {
        askUiOpenedBeforeResult:
          askStartIndex !== -1 && requestUiIndex !== -1 && askEndIndex !== -1 && requestUiIndex < askEndIndex,
        jsonlAskPersisted: jsonlToolResultOrder.includes('ask'),
      },
      eventOrder,
      jsonlToolResultOrder,
      requestDetails: ask.details as StructuredExchangeRequestDetails,
      sessionFile,
      stdout: client.events,
    };
  } finally {
    client.dispose();
  }
}

async function writeOrderingExtension(cwd: string): Promise<string> {
  const extensionPath = join(cwd, 'structured-exchange-ordering-extension.ts');
  const adapterPath = resolve('src/.pi/extensions/exchanges/index.ts');
  const fauxProviderPath = resolve('src/probes/faux-provider.ts');
  const content = orderingExtensionSource(adapterPath, fauxProviderPath);
  await writeFile(extensionPath, content, 'utf8');
  return extensionPath;
}

export function orderingExtensionSource(adapterPath: string, fauxProviderPath: string): string {
  return `
    import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
    import {
      fauxAssistantMessage,
      fauxToolCall,
      registerFauxProvider,
    } from "@earendil-works/pi-ai"
    import { registerStructuredExchange } from ${JSON.stringify(adapterPath)}
    import { BRUNCH_FAUX_HARNESS_ENV_API_KEY, brunchFauxProviderConfig, defaultBrunchFauxModel } from ${JSON.stringify(fauxProviderPath)}

    export default function(pi: ExtensionAPI): void {
      registerStructuredExchange(pi)
      const model = defaultBrunchFauxModel({
        model: {
          provider: "brunch-ordering",
          api: "brunch-ordering-api",
          modelId: "ordering-model",
          modelName: "Ordering proof model",
        },
      })
      const provider = registerFauxProvider({
        provider: model.provider,
        api: model.api + "-faux-source",
        models: [{ id: model.modelId, name: model.modelName }],
      })
      pi.registerProvider(model.provider, brunchFauxProviderConfig(model, provider, BRUNCH_FAUX_HARNESS_ENV_API_KEY))
      provider.setResponses([
        fauxAssistantMessage([
          fauxToolCall("ask", {
            exchangeId: "ordering-proof",
            body: "What should the next parity proof check?",
          }, { id: "ask-ordering-call" }),
        ], { stopReason: "toolUse" }),
        fauxAssistantMessage("Ordering proof complete.", { stopReason: "stop" }),
      ])
      pi.registerCommand("brunch-structured-exchange-ordering-proof", {
        description: "Start the deterministic ask ordering proof.",
        handler: async () => {
          const selected = await pi.setModel(provider.getModel())
          if (!selected) throw new Error("Ordering proof faux model was not selectable")
          pi.setActiveTools(["ask"])
          pi.sendUserMessage("Run the ask ordering proof.")
        },
      })
    }
  `;
}

function orderingEvents(events: readonly unknown[]): string[] {
  return events.flatMap((event) => {
    if (!isRecord(event)) return [];
    if (event.type === 'tool_execution_start') {
      return [`${String(event.toolName)}:start`];
    }
    if (event.type === 'tool_execution_end') {
      return [`${String(event.toolName)}:end`];
    }
    if (event.type === 'extension_ui_request') {
      return [`ui:${String(event.method)}`];
    }
    return [];
  });
}

async function readToolResults(sessionFile: string): Promise<ToolResultRecord[]> {
  const entries = (await readFile(sessionFile, 'utf8'))
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
  return entries.flatMap((entry) => {
    if (!isRecord(entry) || entry.type !== 'message') return [];
    const message = entry.message;
    if (!isRecord(message) || message.role !== 'toolResult') return [];
    if (message.toolName !== 'ask') return [];
    return [{ toolName: message.toolName, details: message.details }];
  });
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

interface ExtensionUiRequest {
  type: 'extension_ui_request';
  id: string;
  method: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRpcResponse(value: unknown): value is RpcResponse {
  return isRecord(value) && value.type === 'response' && typeof value.command === 'string';
}

function isExtensionUiRequest(value: unknown): value is ExtensionUiRequest {
  return isRecord(value) && value.type === 'extension_ui_request' && typeof value.id === 'string';
}

class RpcProbeClient {
  readonly events: unknown[] = [];
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #timeoutMs: number;
  readonly #waiters = new Set<() => void>();
  #disposed = false;

  constructor(child: ChildProcessWithoutNullStreams, timeoutMs: number) {
    this.#child = child;
    this.#timeoutMs = timeoutMs;
    child.stdout.on('data', (chunk: Buffer) => this.#read(chunk));
  }

  waitFor<T>(predicate: (event: unknown) => event is T): Promise<T> {
    const existing = this.events.find(predicate);
    if (existing !== undefined) return Promise.resolve(existing);
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#waiters.delete(check);
        reject(new Error(`Timed out waiting for RPC probe event after ${this.#timeoutMs}ms`));
      }, this.#timeoutMs);
      const check = () => {
        const event = this.events.find(predicate);
        if (event === undefined) return;
        clearTimeout(timeout);
        this.#waiters.delete(check);
        resolve(event);
      };
      this.#waiters.add(check);
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#child.kill('SIGTERM');
  }

  #read(chunk: Buffer): void {
    for (const line of chunk.toString('utf8').split('\n')) {
      if (line.trim().length === 0) continue;
      const event = JSON.parse(line) as unknown;
      this.events.push(event);
    }
    for (const waiter of this.#waiters) waiter();
  }
}
