import { spawn } from 'node:child_process';

import { tool } from 'ai';
import * as z from 'zod/v4';

const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_LINES = 500;
const MAX_BYTES = 64 * 1024;

const inputSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  timeout: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(`Timeout in seconds (default ${DEFAULT_TIMEOUT_SECONDS})`),
});

const outputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  truncated: z.boolean(),
});

function truncateTail(
  text: string,
  maxLines: number,
  maxBytes: number,
): { text: string; truncated: boolean } {
  const lines = text.split('\n');
  let truncated = false;

  if (lines.length > maxLines) {
    const kept = lines.slice(-maxLines);
    kept.unshift(`[... ${lines.length - maxLines} lines truncated ...]`);
    truncated = true;
    return { text: kept.join('\n'), truncated };
  }

  if (Buffer.byteLength(text) > maxBytes) {
    // Take tail bytes
    const buf = Buffer.from(text);
    const tail = buf.subarray(buf.length - maxBytes).toString('utf-8');
    return { text: `[... truncated ...]\n${tail}`, truncated: true };
  }

  return { text, truncated };
}

export function createBashTool(cwd: string) {
  return tool({
    description:
      'Execute a shell command and return its output. Use for system commands, package managers, git, etc.',
    inputSchema,
    outputSchema,
    execute: ({ command, timeout: timeoutSec }) => {
      const timeoutMs = (timeoutSec ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

      return new Promise((resolve) => {
        const child = spawn('bash', ['-c', command], {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, TERM: 'dumb' },
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 2000);
        }, timeoutMs);

        child.on('close', (code, signal) => {
          clearTimeout(timer);
          const exitCode = code ?? (signal ? 128 : 1);

          if (signal === 'SIGTERM') {
            stderr += `\n[Process timed out after ${timeoutSec ?? DEFAULT_TIMEOUT_SECONDS}s]`;
          }

          const stdoutResult = truncateTail(stdout, MAX_LINES, MAX_BYTES);
          const stderrResult = truncateTail(stderr, MAX_LINES, MAX_BYTES);

          resolve({
            stdout: stdoutResult.text,
            stderr: stderrResult.text,
            exitCode,
            truncated: stdoutResult.truncated || stderrResult.truncated,
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            stdout: '',
            stderr: err.message,
            exitCode: 1,
            truncated: false,
          });
        });
      });
    },
  });
}
