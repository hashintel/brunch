import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRpcHandlers } from '../rpc/handlers.js';
import { renderSessionTranscript } from '../session/session-transcript.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';

const PUBLIC_RPC_PARITY_PERMUTATION_COUNT = 3;

interface JsonRpcSuccess<T> {
  jsonrpc: '2.0';
  id: number;
  result: T;
}

interface PendingOption {
  id: string;
  label: string;
  content?: string;
  rationale?: string;
}

interface PendingExchange {
  exchangeId: string;
  mode: 'text' | 'single-select' | 'multi-select';
  prompt: string;
  options: PendingOption[];
}

interface RpcExchange {
  promptEntryIds: string[];
  responseEntryIds: string[];
}

interface RpcExchangeProjection {
  status: string;
  exchanges: RpcExchange[];
}

interface TranscriptDisplayRow {
  role: string;
  text: string;
}

interface TranscriptDisplayProjection {
  rows: TranscriptDisplayRow[];
}

interface WorkspaceSelectionResult {
  requiresSelection: boolean;
}

interface PendingResult {
  status: 'pending';
  exchange: PendingExchange;
}

export interface PublicRpcParityProofArtifacts {
  runDir: string;
  sessionJsonl: string;
  transcriptMarkdown: string;
  reportJson: string;
}

export interface PublicRpcParityProofOptions {
  fixtureRoot?: string;
  runId?: string;
}

export interface PublicRpcParityProofReport {
  schemaVersion: 1;
  probeId: 'public-rpc-parity';
  runId: string;
  generatedAt: string;
  mission: string;
  evaluationFocus: string;
  maxTurnBudget: number;
  completedTurns: number;
  friction: string[];
  cwd: string;
  specId: number;
  sessionId: string;
  toolCoverage: string[];
  exchangeIds: string[];
  transcriptDisplayRows: number;
  artifacts?: PublicRpcParityProofArtifacts;
}

function success<T>(response: unknown): T {
  if (typeof response === 'object' && response !== null && 'result' in response) {
    return (response as JsonRpcSuccess<T>).result;
  }
  throw new Error(`Expected JSON-RPC success response: ${JSON.stringify(response)}`);
}

interface ToolResultOptionDetails {
  id?: string;
  label?: string;
  content?: string;
  rationale?: string;
}

interface ToolResultDetails {
  exchangeId?: string;
  schema?: string;
  requestTool?: string;
  presentTool?: string;
  prompt?: string;
  options?: ToolResultOptionDetails[];
}

interface ToolResultEntry {
  toolName: string;
  content: string;
  details?: ToolResultDetails;
}

interface JsonlMessageEntry {
  message?: {
    role?: string;
    toolName?: string;
    content?: unknown;
    details?: unknown;
  };
}

function toolResultEntries(sessionText: string): ToolResultEntry[] {
  return sessionText
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as JsonlMessageEntry)
    .filter((entry) => entry.message?.role === 'toolResult')
    .map((entry) => ({
      toolName: entry.message?.toolName ?? '',
      content: textContent(entry.message?.content),
      details: entry.message?.details as never,
    }));
}

function textContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text
        : '',
    )
    .join('\n');
}

interface ProofResponse {
  answer: unknown;
  note?: string;
}

function responseFor(exchange: PendingExchange): ProofResponse {
  if (exchange.mode === 'text') {
    return { answer: { text: `Answer for ${exchange.exchangeId}` } };
  }
  if (exchange.mode === 'multi-select') {
    return {
      answer: { optionIds: ['transcript', 'other'] },
      note: 'Other: keep a compact blocker/friction report.',
    };
  }
  return {
    answer: { optionId: exchange.options[0]?.id ?? 'new-from-scratch' },
    note: 'Chosen by deterministic public-RPC proof.',
  };
}

export async function runPublicRpcParityProof(
  options: PublicRpcParityProofOptions = {},
): Promise<PublicRpcParityProofReport> {
  const runId = options.runId ?? defaultRunId();
  const generatedAt = new Date().toISOString();
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-public-rpc-parity-'));
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const handlers = createRpcHandlers({ coordinator, cwd });
  const friction: string[] = [];

  const discovery = success<{ methods: Array<{ method: string }> }>(
    await handlers.handle({ jsonrpc: '2.0', id: 1, method: 'rpc.discover' }),
  );
  for (const method of [
    'workspace.selectionState',
    'workspace.activate',
    'session.startElicitation',
    'session.pendingExchange',
    'elicitation.respond',
    'session.elicitationExchanges',
    'session.transcriptDisplay',
  ]) {
    if (!discovery.methods.some((entry) => entry.method === method)) {
      throw new Error(`rpc.discover did not include ${method}`);
    }
  }

  const selection = success<WorkspaceSelectionResult>(
    await handlers.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'workspace.selectionState',
    }),
  );
  if (!selection.requiresSelection) {
    friction.push('Fresh cwd did not report selection-required state.');
  }

  await handlers.handle({
    jsonrpc: '2.0',
    id: 3,
    method: 'workspace.activate',
    params: {
      decision: { action: 'newSpec', title: 'Public RPC parity spec' },
    },
  });
  const workspace = await coordinator.openDefaultWorkspace();
  if (workspace.status !== 'ready') {
    throw new Error('workspace.activate(newSpec) did not create a ready workspace');
  }

  const exchangeIds: string[] = [];
  for (let turn = 0; turn < PUBLIC_RPC_PARITY_PERMUTATION_COUNT; turn += 1) {
    const started = success<PendingResult>(
      await handlers.handle({
        jsonrpc: '2.0',
        id: 10 + turn * 3,
        method: 'session.startElicitation',
      }),
    );
    const pending = success<PendingResult>(
      await handlers.handle({
        jsonrpc: '2.0',
        id: 11 + turn * 3,
        method: 'session.pendingExchange',
      }),
    );
    if (pending.exchange.exchangeId !== started.exchange.exchangeId) {
      friction.push(`Turn ${turn + 1}: pendingExchange differed from startElicitation.`);
    }
    if (started.exchange.mode !== 'text') {
      const richOption = started.exchange.options.find(
        (option) => option.content !== undefined && option.rationale !== undefined,
      );
      if (!richOption) {
        throw new Error(`Turn ${turn + 1}: pending options dropped content/rationale`);
      }
      if (richOption.content === richOption.label) {
        throw new Error(`Turn ${turn + 1}: pending option content collapsed into label`);
      }
    }
    exchangeIds.push(started.exchange.exchangeId);
    const response = responseFor(started.exchange);
    await handlers.handle({
      jsonrpc: '2.0',
      id: 12 + turn * 3,
      method: 'elicitation.respond',
      params: {
        exchangeId: started.exchange.exchangeId,
        answer: response.answer,
        ...(response.note === undefined ? {} : { note: response.note }),
      },
    });
  }

  const exchanges = success<RpcExchangeProjection>(
    await handlers.handle({
      jsonrpc: '2.0',
      id: 50,
      method: 'session.elicitationExchanges',
    }),
  );
  const display = success<TranscriptDisplayProjection>(
    await handlers.handle({
      jsonrpc: '2.0',
      id: 51,
      method: 'session.transcriptDisplay',
    }),
  );
  if (exchanges.exchanges.length !== PUBLIC_RPC_PARITY_PERMUTATION_COUNT) {
    throw new Error(
      `Expected ${PUBLIC_RPC_PARITY_PERMUTATION_COUNT} completed exchanges, got ${exchanges.exchanges.length}`,
    );
  }

  const sessionText = await readFile(workspace.session.file, 'utf8');
  if (
    sessionText.includes('brunch.elicitation_prompt') ||
    sessionText.includes('brunch.elicitation_response')
  ) {
    throw new Error('Public RPC parity transcript used the retired lightweight elicitation entries');
  }
  const tools = toolResultEntries(sessionText);
  const toolCoverage = [...new Set(tools.map((entry) => entry.toolName))].sort();
  for (const required of [
    'present_question',
    'request_answer',
    'present_options',
    'request_choice',
    'request_choices',
  ]) {
    if (!toolCoverage.includes(required)) {
      throw new Error(`Missing tool coverage for ${required}`);
    }
  }

  if (new Set(exchangeIds).size !== exchangeIds.length) {
    throw new Error('Public RPC parity proof reused exchange IDs');
  }

  const presentPrompts = tools
    .filter((entry) => entry.details?.schema === 'brunch.structured_exchange.present')
    .map((entry) => entry.details?.prompt)
    .filter((prompt): prompt is string => prompt !== undefined);
  if (new Set(presentPrompts).size !== presentPrompts.length) {
    throw new Error('Public RPC parity proof repeated deterministic prompts');
  }

  const optionPresentResults = tools.filter((entry) => entry.toolName === 'present_options');
  for (const entry of optionPresentResults) {
    const richOption = entry.details?.options?.find(
      (option) => option.content !== undefined && option.rationale !== undefined,
    );
    if (!richOption) {
      throw new Error(
        `Exchange ${entry.details?.exchangeId ?? 'unknown'} JSONL option details dropped content/rationale`,
      );
    }
    const optionContent = richOption.content;
    const optionRationale = richOption.rationale;
    if (optionContent === undefined || optionRationale === undefined) {
      throw new Error(
        `Exchange ${entry.details?.exchangeId ?? 'unknown'} JSONL option details dropped content/rationale`,
      );
    }
    if (optionContent === richOption.label) {
      throw new Error(
        `Exchange ${entry.details?.exchangeId ?? 'unknown'} JSONL option content collapsed into label`,
      );
    }
    if (!entry.content.includes(optionContent) || !entry.content.includes(optionRationale)) {
      throw new Error(
        `Exchange ${entry.details?.exchangeId ?? 'unknown'} transcript markdown dropped option artifacts`,
      );
    }
  }

  for (const exchangeId of exchangeIds) {
    const presentIndex = tools.findIndex(
      (entry) =>
        entry.details?.exchangeId === exchangeId &&
        entry.details.schema === 'brunch.structured_exchange.present',
    );
    const requestIndex = tools.findIndex(
      (entry) =>
        entry.details?.exchangeId === exchangeId &&
        entry.details.schema === 'brunch.structured_exchange.request',
    );
    if (presentIndex < 0 || requestIndex < 0 || presentIndex > requestIndex) {
      throw new Error(`Exchange ${exchangeId} did not preserve present-before-request order`);
    }
  }

  const report: PublicRpcParityProofReport = {
    schemaVersion: 1,
    probeId: 'public-rpc-parity',
    runId,
    generatedAt,
    mission: 'Drive deterministic Brunch structured-exchange permutations through public JSON-RPC only.',
    evaluationFocus:
      'Tuple transcript/projection parity for current structured-exchange modes without raw Pi RPC or legacy prompt/response entries.',
    maxTurnBudget: PUBLIC_RPC_PARITY_PERMUTATION_COUNT,
    completedTurns: exchanges.exchanges.length,
    friction,
    cwd,
    specId: workspace.spec.id,
    sessionId: workspace.session.id,
    toolCoverage,
    exchangeIds,
    transcriptDisplayRows: display.rows.length,
  };

  if (options.fixtureRoot !== undefined) {
    report.artifacts = await writeProofArtifacts({
      fixtureRoot: options.fixtureRoot,
      runId,
      sessionText,
      report,
    });
  }

  return report;
}

async function writeProofArtifacts(options: {
  fixtureRoot: string;
  runId: string;
  sessionText: string;
  report: PublicRpcParityProofReport;
}): Promise<PublicRpcParityProofArtifacts> {
  const runDir = join(options.fixtureRoot, 'runs', 'public-rpc-parity', options.runId);
  const artifacts: PublicRpcParityProofArtifacts = {
    runDir,
    sessionJsonl: join(runDir, 'session.jsonl'),
    transcriptMarkdown: join(runDir, 'transcript.md'),
    reportJson: join(runDir, 'report.json'),
  };
  const persistedReport: PublicRpcParityProofReport = {
    ...options.report,
    artifacts,
  };

  await mkdir(runDir, { recursive: true });
  await writeFile(artifacts.sessionJsonl, options.sessionText, 'utf8');
  await writeFile(
    artifacts.transcriptMarkdown,
    renderSessionTranscript(options.sessionText, { title: 'session.jsonl' }),
    'utf8',
  );
  await writeFile(artifacts.reportJson, `${JSON.stringify(persistedReport, null, 2)}\n`, 'utf8');

  return artifacts;
}

function defaultRunId(): string {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}
