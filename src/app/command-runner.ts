import { spawn } from 'node:child_process';

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** Set only when the process could not be spawned (e.g. command not found). */
  readonly spawnError?: string;
  readonly aborted?: boolean;
  readonly timedOut?: boolean;
  readonly outputTruncated?: boolean;
}

export interface CommandRunnerOptions {
  readonly cwd: string;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxOutputBytes?: number | undefined;
  readonly stdin?: string | undefined;
  readonly onOutput?: (chunk: { readonly stream: 'stdout' | 'stderr'; readonly text: string }) => void;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandRunnerOptions,
) => Promise<CommandResult>;

export async function runCommand(
  command: string,
  args: readonly string[],
  options: CommandRunnerOptions,
): Promise<CommandResult> {
  return await new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({ exitCode: 1, stdout: '', stderr: '', aborted: true });
      return;
    }

    const child = spawn(command, [...args], {
      cwd: options.cwd,
      detached: process.platform !== 'win32',
      stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let capturedBytes = 0;
    let settled = false;
    let aborted = false;
    let timedOut = false;
    let outputTruncated = false;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    };

    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        ...result,
        ...(aborted ? { aborted: true } : {}),
        ...(timedOut ? { timedOut: true } : {}),
        ...(outputTruncated ? { outputTruncated: true } : {}),
      });
    };

    const killChild = () => {
      if (child.pid === undefined) return;
      try {
        if (process.platform === 'win32') child.kill('SIGTERM');
        else process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    };

    const abort = () => {
      aborted = true;
      killChild();
    };

    const timeout =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            killChild();
          }, options.timeoutMs);

    options.signal?.addEventListener('abort', abort, { once: true });

    const appendOutput = (current: string, chunk: Buffer, stream: 'stdout' | 'stderr'): string => {
      const maxOutputBytes = options.maxOutputBytes;
      if (maxOutputBytes !== undefined && capturedBytes >= maxOutputBytes) {
        outputTruncated = true;
        return current;
      }

      const text = chunk.toString('utf8');
      if (maxOutputBytes === undefined) {
        options.onOutput?.({ stream, text });
        return current + text;
      }

      const remainingBytes = maxOutputBytes - capturedBytes;
      const chunkBytes = Buffer.byteLength(text, 'utf8');
      if (chunkBytes <= remainingBytes) {
        capturedBytes += chunkBytes;
        options.onOutput?.({ stream, text });
        return current + text;
      }

      outputTruncated = true;
      const clipped = Buffer.from(text, 'utf8').subarray(0, remainingBytes).toString('utf8');
      capturedBytes = maxOutputBytes;
      if (clipped.length > 0) options.onOutput?.({ stream, text: clipped });
      return current + clipped;
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk, 'stdout');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk, 'stderr');
    });
    child.on('error', (error) => {
      finish({ exitCode: 1, stdout, stderr, spawnError: error.message });
    });
    child.on('close', (code) => {
      finish({ exitCode: code ?? 1, stdout, stderr });
    });
    if (options.stdin !== undefined) child.stdin?.end(options.stdin);
  });
}
