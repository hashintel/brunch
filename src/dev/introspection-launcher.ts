import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentSession } from '@earendil-works/pi-coding-agent';

import type {
  BrunchIntrospectionBaseReport,
  BrunchIntrospectionStore,
  BrunchIntrospectionTurnCapture,
} from '../.pi/brunch-pi-extensions.js';
import { assertPortableRunId } from '../probes/portable-report.js';
import { latestAssistantText } from './agent-messages.js';

export type BrunchIntrospectionSession = Pick<AgentSession, 'prompt' | 'messages'>;

export interface BrunchIntrospectionLauncherOptions {
  readonly session: BrunchIntrospectionSession;
  readonly store: BrunchIntrospectionStore;
  readonly cwd?: string;
  readonly runId?: string;
  readonly prompt?: string;
  readonly now?: () => Date;
}

export interface BrunchIntrospectionRunArtifact {
  readonly runId: string;
  readonly generatedAt: string;
  readonly prompt: string;
  readonly turnId: string;
  readonly mechanical: {
    readonly passiveCapture: BrunchIntrospectionTurnCapture;
    readonly baseReport?: BrunchIntrospectionBaseReport;
  };
  readonly subjective: {
    readonly answerText: string;
  };
}

export interface BrunchIntrospectionLauncherResult {
  readonly artifactDir: string;
  readonly artifact: BrunchIntrospectionRunArtifact;
}

const DEFAULT_INTROSPECTION_PROMPT =
  'Inspect the prompt, tools, and Brunch resources you can see. Name confusing or missing guidance.';

export async function runBrunchIntrospectionTurn(
  options: BrunchIntrospectionLauncherOptions,
): Promise<BrunchIntrospectionLauncherResult> {
  const now = options.now ?? (() => new Date());
  const generatedAt = now().toISOString();
  const runId = assertPortableRunId(
    options.runId ?? `introspection-${generatedAt.replaceAll(':', '').replaceAll('.', '')}`,
  );
  const prompt = options.prompt ?? DEFAULT_INTROSPECTION_PROMPT;

  await options.session.prompt(prompt, { expandPromptTemplates: false, source: 'rpc' });

  const passiveCapture = options.store.latestPassiveCapture();
  if (!passiveCapture) {
    throw new Error(
      'Introspection run did not capture a provider payload. Is the introspection extension enabled?',
    );
  }

  const baseReport = options.store.latestBaseReport();
  const artifact: BrunchIntrospectionRunArtifact = {
    runId,
    generatedAt,
    prompt,
    turnId: passiveCapture.turnId,
    mechanical: {
      passiveCapture,
      ...(baseReport ? { baseReport } : {}),
    },
    subjective: {
      answerText: latestAssistantText(options.session.messages),
    },
  };

  const artifactDir = join(options.cwd ?? process.cwd(), '.fixtures', 'runs', 'introspection', runId);
  await mkdir(artifactDir, { recursive: true });
  await writeFile(join(artifactDir, 'mechanical.json'), `${JSON.stringify(artifact.mechanical, null, 2)}\n`);
  await writeFile(join(artifactDir, 'subjective.json'), `${JSON.stringify(artifact.subjective, null, 2)}\n`);
  await writeFile(join(artifactDir, 'manifest.json'), `${JSON.stringify(artifact, null, 2)}\n`);

  return { artifactDir, artifact };
}
