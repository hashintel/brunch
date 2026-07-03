import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  StructuredExchangePresentDetails,
  StructuredExchangeRequestDetails,
} from '../.pi/extensions/exchanges/index.js';

interface OrderingScenario {
  mission: string;
  evaluationFocus: string;
  maxTurns: number;
}

interface OrderingVerdict {
  presentResultBeforeRequestUi: boolean;
  jsonlPresentBeforeRequest: boolean;
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
  presentDetails: StructuredExchangePresentDetails;
  requestDetails: StructuredExchangeRequestDetails;
  sessionFile: string;
  stdout: unknown[];
}

interface StructuredExchangeOrderingProofOptions {
  cwd?: string;
  timeoutMs?: number;
}

const scenario: OrderingScenario = {
  mission: 'Prove same-assistant-message present/request structured-exchange ordering.',
  evaluationFocus: 'Verify sequential present_question persists before request_response opens response UI.',
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
    const promptAccepted = client.waitFor(
      (event): event is RpcResponse => isRpcResponse(event) && event.command === 'prompt',
    );
    child.stdin.write(
      `${JSON.stringify({ id: 'ordering', type: 'prompt', message: '/brunch-structured-exchange-ordering-proof' })}\n`,
    );

    const editorRequest = await client.waitFor(
      (event): event is ExtensionUiRequest => isExtensionUiRequest(event) && event.method === 'editor',
    );
    child.stdin.write(
      `${JSON.stringify({ type: 'extension_ui_response', id: editorRequest.id, value: 'Sequential ordering looks safe for the next parity proof.' })}\n`,
    );

    const promptResponse = await promptAccepted;
    if (!promptResponse.success) {
      throw new Error(`Ordering proof prompt failed: ${promptResponse.error ?? 'unknown error'}`);
    }

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
    const present = toolResults.find((result) => result.toolName === 'present_question');
    const request = toolResults.find((result) => result.toolName === 'request_response');
    if (!present || !request) {
      throw new Error('Ordering proof did not persist both tool results');
    }

    const eventOrder = orderingEvents(client.events);
    const jsonlToolResultOrder = toolResults.map((result) => result.toolName);
    const presentIndex = eventOrder.indexOf('present_question:end');
    const requestUiIndex = eventOrder.indexOf('ui:editor');
    const jsonlPresentIndex = jsonlToolResultOrder.indexOf('present_question');
    const jsonlRequestIndex = jsonlToolResultOrder.indexOf('request_response');

    return {
      scenario,
      verdict: {
        presentResultBeforeRequestUi:
          presentIndex !== -1 && requestUiIndex !== -1 && presentIndex < requestUiIndex,
        jsonlPresentBeforeRequest:
          jsonlPresentIndex !== -1 && jsonlRequestIndex !== -1 && jsonlPresentIndex < jsonlRequestIndex,
      },
      eventOrder,
      jsonlToolResultOrder,
      presentDetails: present.details as StructuredExchangePresentDetails,
      requestDetails: request.details as StructuredExchangeRequestDetails,
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
          fauxToolCall("present_question", {
            exchangeId: "ordering-proof",
            heading: "What should the next parity proof check?",
            body: "This present result must persist before the request UI opens.",
          }, { id: "present-ordering-call" }),
          fauxToolCall("request_response", {
            exchangeId: "ordering-proof",
          }, { id: "request-ordering-call" }),
        ], { stopReason: "toolUse" }),
        fauxAssistantMessage("Ordering proof complete.", { stopReason: "stop" }),
      ])
      pi.registerCommand("brunch-structured-exchange-ordering-proof", {
        description: "Start the deterministic present/request ordering proof.",
        handler: async () => {
          const selected = await pi.setModel(provider.getModel())
          if (!selected) throw new Error("Ordering proof faux model was not selectable")
          pi.setActiveTools(["present_question", "request_response"])
          pi.sendUserMessage("Run the present/request ordering proof.")
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
    if (message.toolName !== 'present_question' && message.toolName !== 'request_response') {
      return [];
    }
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
  return (
    isRecord(value) &&
    value.type === 'response' &&
    typeof value.command === 'string' &&
    typeof value.success === 'boolean'
  );
}

function isExtensionUiRequest(value: unknown): value is ExtensionUiRequest {
  return (
    isRecord(value) &&
    value.type === 'extension_ui_request' &&
    typeof value.id === 'string' &&
    typeof value.method === 'string'
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
    timeout: ReturnType<typeof setTimeout>;
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
      const waiter = {
        predicate,
        resolve: (event: unknown) => {
          clearTimeout(waiter.timeout);
          resolve(event as T);
        },
        timeout: setTimeout(() => {
          this.#waiters = this.#waiters.filter((candidate) => candidate !== waiter);
          reject(
            new Error(
              `Timed out waiting for ordering proof event. Events:\n${JSON.stringify(this.events, null, 2)}\nStderr:\n${this.#stderr}`,
            ),
          );
        }, this.#timeoutMs),
      };
      this.#waiters.push(waiter);
    });
  }

  dispose(): void {
    for (const waiter of this.#waiters) {
      clearTimeout(waiter.timeout);
    }
    this.#waiters = [];
    this.#child.kill('SIGTERM');
  }

  #ingestStdout(chunk: string): void {
    this.#stdout += chunk;
    for (;;) {
      const newline = this.#stdout.indexOf('\n');
      if (newline === -1) return;
      const line = this.#stdout.slice(0, newline).trim();
      this.#stdout = this.#stdout.slice(newline + 1);
      if (line.length === 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      this.events.push(parsed);
      for (const waiter of this.#waiters) {
        if (waiter.predicate(parsed)) {
          this.#waiters = this.#waiters.filter((candidate) => candidate !== waiter);
          waiter.resolve(parsed);
        }
      }
    }
  }
}
