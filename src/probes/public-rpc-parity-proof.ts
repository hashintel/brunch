import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';

import { formatPresentCandidates } from '../agents/contexts/exchanges/present-candidates.js';
import { projectPresentCandidates } from '../exchanges/projections/present-candidates.js';
import { createRpcHandlers } from '../rpc/handlers.js';
import { flushSessionManagerToFile } from '../session/flush-session-manager.js';
import { syntheticExchangeToolCallMessage } from '../session/structured-exchange-loop.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { assertPortableRunId, portableCwd } from './portable-report.js';

const PUBLIC_RPC_PARITY_PERMUTATION_COUNT = 3;

function mintActiveCandidateExchange(sessionFile: string, completedCount: number): PendingExchange {
  const turnNumber = completedCount + 1;
  const exchangeId = `deterministic-candidate-${turnNumber}`;
  const projection = projectPresentCandidates({
    exchangeId,
    heading: `Choose parity candidate ${turnNumber}`,
    body: 'Exercise the active present_candidates → ask grammar through public RPC.',
    candidates: [
      {
        id: `candidate-${turnNumber}`,
        title: `Parity candidate ${turnNumber}`,
        user_rubric: {
          core_bet: 'Drive the active candidate settlement path.',
          best_fit: 'Public RPC parity verification.',
          cost_complexity: 'One deterministic transcript exchange.',
          covers_well: 'Present readback and ask settlement.',
          main_risks: 'Does not cover retired question vocabulary.',
          lock_in_constraints: 'Uses the active exchange grammar.',
          recommendation: 'Select this deterministic candidate.',
        },
        meta_rubric: {
          legibility_cost_of_knowing: 'Easy to inspect.',
          failure_modes: 'Schema drift fails transcript readback.',
          coverage_range: 'Public RPC exchange parity.',
          commitment: 'Fixture state only.',
        },
        graph_refs: [],
      },
    ],
  });
  const call = syntheticExchangeToolCallMessage(exchangeId, 'present_candidates');
  const manager = SessionManager.open(sessionFile);
  manager.appendMessage(call as never);
  manager.appendMessage({
    role: 'toolResult',
    toolCallId: call.content[0].id,
    toolName: 'present_candidates',
    content: [{ type: 'text', text: formatPresentCandidates(projection) }],
    details: projection.details,
    isError: false,
    timestamp: 0,
  } as never);
  flushSessionManagerToFile(manager, sessionFile);
  return {
    exchangeId,
    mode: 'single-select',
    prompt: projection.heading,
    options: [
      {
        id: `candidate-${turnNumber}`,
        label: `Parity candidate ${turnNumber}`,
        content: `Parity candidate ${turnNumber}`,
        rationale: 'Select this deterministic candidate.',
      },
    ],
  };
}

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

interface WorkspaceSelectionResult {
  requiresSelection: boolean;
}

interface PendingResult {
  status: 'pending';
  exchange: PendingExchange;
}

interface PublicRpcParityProofArtifacts {
  runDir: string;
  sessionJsonl: string;
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
  description?: string;
}

type AskOptionEntry = Pick<ToolResultOptionDetails, 'id' | 'label' | 'description'>;

interface ToolResultDetails {
  exchange_id?: string;
  schema?: string;
  display?: { heading?: string };
  options?: ToolResultOptionDetails[];
  question?: { options?: AskOptionEntry[] };
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
  const runId = assertPortableRunId(options.runId ?? defaultRunId());
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
    'session.triggerExchange',
    'session.pendingExchange',
    'session.submitExchangeResponse',
    'session.exchanges',
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
    // D78-L/D49-L revised 2026-06-12: the product mints no deterministic
    // exchange — the probe stands in for the assistant-authored offer by
    // minting the permutation's present pair directly into the transcript,
    // then drives readback + response through the public RPC surface only.
    const minted = mintActiveCandidateExchange(workspace.session.file, turn);
    const started = success<PendingResult>(
      await handlers.handle({
        jsonrpc: '2.0',
        id: 10 + turn * 3,
        method: 'session.triggerExchange',
      }),
    );
    const pending = success<PendingResult>(
      await handlers.handle({
        jsonrpc: '2.0',
        id: 11 + turn * 3,
        method: 'session.pendingExchange',
      }),
    );
    if (started.exchange.exchangeId !== minted.exchangeId) {
      friction.push(`Turn ${turn + 1}: triggerExchange did not surface the minted exchange.`);
    }
    if (pending.exchange.exchangeId !== started.exchange.exchangeId) {
      friction.push(`Turn ${turn + 1}: pendingExchange differed from triggerExchange.`);
    }
    if (started.exchange.mode !== 'text') {
      const richOption = started.exchange.options.find(
        (option) => option.content !== undefined && option.rationale !== undefined,
      );
      if (!richOption) {
        throw new Error(`Turn ${turn + 1}: pending options dropped content/rationale`);
      }
    }
    exchangeIds.push(started.exchange.exchangeId);
    const response = responseFor(started.exchange);
    await handlers.handle({
      jsonrpc: '2.0',
      id: 12 + turn * 3,
      method: 'session.submitExchangeResponse',
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
      method: 'session.exchanges',
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
  for (const required of ['ask']) {
    if (!toolCoverage.includes(required)) {
      throw new Error(`Missing tool coverage for ${required}`);
    }
  }

  if (new Set(exchangeIds).size !== exchangeIds.length) {
    throw new Error('Public RPC parity proof reused exchange IDs');
  }

  const presentPrompts = tools
    .filter((entry) => entry.details?.schema === 'brunch.structured_exchange.present')
    .map((entry) => entry.details?.display?.heading)
    .filter((prompt): prompt is string => prompt !== undefined);
  if (new Set(presentPrompts).size !== presentPrompts.length) {
    throw new Error('Public RPC parity proof repeated deterministic prompts');
  }

  const optionPresentResults = tools.filter((entry) => {
    const details = entry.details as { question?: { options?: unknown } } | undefined;
    return entry.toolName === 'ask' && Array.isArray(details?.question?.options);
  });
  for (const entry of optionPresentResults) {
    const details = entry.details as { exchange_id?: string; question?: { options?: AskOptionEntry[] } };
    const richOption = details.question?.options?.find(
      (option) => option.label !== undefined && option.description !== undefined,
    );
    if (!richOption) {
      throw new Error(
        `Exchange ${details.exchange_id ?? 'unknown'} JSONL ask option details dropped label/description`,
      );
    }
    const optionLabel = richOption.label;
    const optionDescription = richOption.description;
    if (optionLabel === undefined || optionDescription === undefined) {
      throw new Error(
        `Exchange ${details.exchange_id ?? 'unknown'} JSONL ask option details dropped label/description`,
      );
    }
    if (!entry.content.includes(optionLabel) || !entry.content.includes(optionDescription)) {
      throw new Error(
        `Exchange ${details.exchange_id ?? 'unknown'} transcript markdown dropped ask option label/description`,
      );
    }
  }

  for (const exchangeId of exchangeIds) {
    const presentIndex = tools.findIndex(
      (entry) =>
        entry.details?.exchange_id === exchangeId &&
        entry.details.schema === 'brunch.structured_exchange.present',
    );
    const requestIndex = tools.findIndex(
      (entry) =>
        entry.details?.exchange_id === exchangeId &&
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
  // Persisted artifact references are fixture-root-relative so committed
  // reports stay portable; the disk paths used for writing are resolved
  // against the (possibly absolute) fixture root.
  const runId = assertPortableRunId(options.runId);
  const runDirRef = `runs/public-rpc-parity/${runId}`;
  const artifacts: PublicRpcParityProofArtifacts = {
    runDir: runDirRef,
    sessionJsonl: `${runDirRef}/session.jsonl`,
    reportJson: `${runDirRef}/report.json`,
  };
  const diskPath = (ref: string) => resolve(options.fixtureRoot, ref);
  const persistedReport: PublicRpcParityProofReport = {
    ...options.report,
    cwd: portableCwd(options.report.cwd),
    artifacts,
  };

  await mkdir(diskPath(artifacts.runDir), { recursive: true });
  await writeFile(diskPath(artifacts.sessionJsonl), options.sessionText, 'utf8');
  await writeFile(diskPath(artifacts.reportJson), `${JSON.stringify(persistedReport, null, 2)}\n`, 'utf8');

  return artifacts;
}

function defaultRunId(): string {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}
