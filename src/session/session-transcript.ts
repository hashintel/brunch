import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FileEntry } from '@earendil-works/pi-coding-agent';

import { projectTranscriptContext } from '../projections/session/transcript-context.js';
import { openActiveSessionBranch } from './active-session-branch.js';
import { formatTranscript } from './transcript-markdown.js';

type TranscriptEntry = FileEntry;

export async function renderSessionTranscriptFile(sessionFile: string): Promise<string> {
  const { entries } = openActiveSessionBranch(sessionFile);
  return formatTranscript(projectTranscriptContext(entries), { title: basename(sessionFile) });
}

export async function writeDebugSessionTranscript(options: {
  readonly cwd: string;
  readonly sessionFile: string;
}): Promise<string> {
  const transcript = await renderSessionTranscriptFile(options.sessionFile);
  const debugDir = join(options.cwd, '.brunch', 'debug');
  await mkdir(debugDir, { recursive: true });
  await writeFile(join(debugDir, 'transcript.md'), transcript, 'utf8');
  return transcript;
}

/** Renders physical append order for artifact inspection, including abandoned branches. */
export function renderAllHistoryDiagnosticTranscript(
  jsonl: string,
  options: { title?: string } = {},
): string {
  const entries = parseAllHistoryDiagnosticJsonl(jsonl);
  return formatTranscript(projectTranscriptContext(entries), options);
}

function parseAllHistoryDiagnosticJsonl(jsonl: string): FileEntry[] {
  return jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as TranscriptEntry;
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${(error as Error).message}`);
      }
    });
}

async function main(): Promise<void> {
  const [, , sessionFile] = process.argv;
  if (!sessionFile) {
    process.stderr.write('Usage: tsx src/session-transcript.ts <session.jsonl>\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(await renderSessionTranscriptFile(sessionFile));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
