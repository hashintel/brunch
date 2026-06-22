import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

import type { JsonRpcResponse } from '../rpc/protocol.js';

export interface ShipGateRpcClient {
  request<T>(method: string, params?: unknown): Promise<T>;
  close(): Promise<void>;
}

interface PendingRequest {
  readonly resolve: (response: JsonRpcResponse) => void;
  readonly reject: (error: Error) => void;
}

export function launchPublicBrunchRpc(options: {
  readonly cliPath: string;
  readonly cwd: string;
  readonly timeoutMs?: number;
}): ShipGateRpcClient {
  const child = spawn(process.execPath, [options.cliPath, '--mode', 'rpc', '--cwd', options.cwd], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return new ChildProcessRpcClient(child, options.timeoutMs ?? 5000);
}

class ChildProcessRpcClient implements ShipGateRpcClient {
  #nextId = 1;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #stderr: string[] = [];
  readonly #lines: Interface;
  #exited = false;
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #timeoutMs: number;

  constructor(child: ChildProcessWithoutNullStreams, timeoutMs: number) {
    this.#child = child;
    this.#timeoutMs = timeoutMs;
    this.#lines = createInterface({ input: this.#child.stdout });
    this.#lines.on('line', (line) => this.#receive(line));
    this.#child.stderr.on('data', (chunk) => this.#stderr.push(String(chunk)));
    this.#child.on('error', (error) => this.#rejectAll(error));
    this.#child.on('exit', (code, signal) => {
      this.#exited = true;
      if (this.#pending.size > 0) {
        this.#rejectAll(
          new Error(
            `Public Brunch RPC exited before responding (code=${String(code)}, signal=${String(signal)}): ${this.#stderr.join('')}`,
          ),
        );
      }
    });
  }

  request<T>(method: string, params?: unknown): Promise<T> {
    if (this.#exited) {
      return Promise.reject(new Error('Public Brunch RPC process has exited'));
    }
    const id = this.#nextId++;
    const payload =
      params === undefined ? { jsonrpc: '2.0', id, method } : { jsonrpc: '2.0', id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}: ${this.#stderr.join('')}`));
      }, this.#timeoutMs);
      this.#pending.set(id, {
        resolve: (response) => {
          clearTimeout(timer);
          if ('error' in response) {
            reject(new Error(`${method} failed: ${response.error.message}`));
            return;
          }
          resolve(response.result as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.#child.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  async close(): Promise<void> {
    if (this.#exited) return;
    this.#child.stdin.end();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.#child.kill();
        resolve();
      }, 1000);
      this.#child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  #receive(line: string): void {
    if (line.trim().length === 0) return;
    const parsed = JSON.parse(line) as JsonRpcResponse | { readonly method?: string };
    if (!('id' in parsed) || typeof parsed.id !== 'number') return;
    const pending = this.#pending.get(parsed.id);
    if (!pending) return;
    this.#pending.delete(parsed.id);
    pending.resolve(parsed as JsonRpcResponse);
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      pending.reject(error);
    }
    this.#pending.clear();
  }
}
