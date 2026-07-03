/**
 * Shared assertion/projection helpers for the tier-2 boot test files
 * (`tier-2-harness.test.ts`, `tier-2-scaffold.test.ts`). Test-only — `src/dev`
 * is excluded from the build, and this module imports vitest.
 */

import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { expect } from 'vitest';

import { projectRequestChoices } from '../../../exchanges/projections/request-choices.js';
import { waitForCondition } from '../../tier-2-harness.js';

/** Wait for the product kick turn (brunch.kick entry) on a fixture boot. */
export async function waitForKick(runtime: {
  session: { sessionManager: { getEntries(): readonly unknown[] } };
}) {
  await waitForCondition(
    () => customEntries(runtime.session.sessionManager.getEntries(), 'brunch.kick').length > 0,
    8000,
    'resume kick turn (brunch.kick entry)',
  );
}

/** Settle window in which a wrongly-fired kick would have appended its entry. */
export async function expectNoKick(runtime: {
  session: { sessionManager: { getEntries(): readonly unknown[] } };
}) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(customEntries(runtime.session.sessionManager.getEntries(), 'brunch.kick')).toHaveLength(0);
}

export async function readSessionContextDetails(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}) {
  const tool = session.getToolDefinition('read_session_context');
  if (!tool) throw new Error('read_session_context tool is not registered');
  const result = await tool.execute('boot-session-context', {}, undefined, undefined, {
    sessionManager: session.sessionManager,
  } as never);
  return result.details;
}

export async function readSessionContextSpecId(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}): Promise<number> {
  const details = await readSessionContextDetails(session);
  if (!isRecord(details) || typeof details.specId !== 'number') {
    throw new Error('read_session_context did not return a numeric specId');
  }
  return details.specId;
}

export async function executeReadGraph(
  session: { getToolDefinition(name: string): ToolDefinition | undefined; sessionManager: unknown },
  params: Record<string, unknown>,
): Promise<unknown> {
  const tool = session.getToolDefinition('read_graph');
  if (!tool) throw new Error('read_graph tool is not registered');
  return tool.execute('tier-2-read-graph', params, undefined, undefined, {
    sessionManager: session.sessionManager,
  } as never);
}

export function messagesByRole(
  entries: readonly unknown[],
  role: string,
): readonly Record<string, unknown>[] {
  return entries.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const message = (entry as { message?: unknown }).message;
    if (typeof message !== 'object' || message === null) return [];
    return (message as { role?: unknown }).role === role ? [message as Record<string, unknown>] : [];
  });
}

export function expectProviderLegalToolPairs(messages: readonly unknown[]): void {
  const seenToolCallIds = new Set<string>();
  for (const message of messages) {
    if (!isRecord(message)) continue;
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isRecord(block) && block.type === 'toolCall' && typeof block.id === 'string') {
          expect(block.id).toMatch(/^[a-zA-Z0-9_-]+$/);
          seenToolCallIds.add(block.id);
        }
      }
    }
    if (message.role === 'toolResult' && typeof message.toolCallId === 'string') {
      expect(message.toolCallId).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(seenToolCallIds.has(message.toolCallId)).toBe(true);
    }
  }
}

export function presentToolResults(entries: readonly unknown[]): readonly Record<string, unknown>[] {
  return messagesByRole(entries, 'toolResult').filter(
    (message) => typeof message.toolName === 'string' && message.toolName.startsWith('present_'),
  );
}

export function userMessages(entries: readonly unknown[]): readonly Record<string, unknown>[] {
  return messagesByRole(entries, 'user');
}

/**
 * A request_* tool result exactly as the exchanges extension writes it: the
 * details envelope comes from the real projection (answered/cancelled/
 * unavailable key presence), not a hand-built status field — this fixture IS
 * the test of the resume-debt classifier's envelope reading.
 */
export function requestChoicesResultMessage(status: 'answered' | 'cancelled' | 'unavailable') {
  const details =
    status === 'answered'
      ? projectRequestChoices({
          exchangeId: 'ex-resume-1',
          status,
          choices: [{ id: 'choice-1', label: 'Choice 1', kind: 'listed' as const }],
          options: [{ id: 'choice-1', content: 'Choice 1' }],
        })
      : projectRequestChoices({
          exchangeId: 'ex-resume-1',
          status,
          ...(status === 'unavailable' ? { message: 'request_choices unavailable' } : {}),
        });
  return {
    role: 'toolResult' as const,
    toolCallId: 'ex-resume-1__request_choices',
    toolName: 'request_choices',
    content: [{ type: 'text' as const, text: `request_choices ${status}` }],
    details,
    isError: false as const,
    timestamp: 0 as const,
  };
}

/**
 * Continuity entries by customType, payload-normalized: ledger entries carry
 * `data`, provider-visible message entries carry `details` (carrier migration,
 * FE-857 card 1). Assertions read the normalized `data` regardless of carrier.
 */
export function customEntries(
  entries: readonly unknown[],
  customType: string,
): ReadonlyArray<{ data: unknown }> {
  return entries
    .filter(
      (entry): entry is { customType: string; data?: unknown; details?: unknown } =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as { customType?: unknown }).customType === customType,
    )
    .map((entry) => ({ ...entry, data: entry.data ?? entry.details }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readWorkspaceContextMarkdownFiles(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}): Promise<string[]> {
  const tool = session.getToolDefinition('read_workspace_context');
  if (!tool) throw new Error('read_workspace_context tool is not registered');
  const result = (await tool.execute(
    'boot-workspace-context',
    { mode: 'cwd_inventory' },
    undefined,
    undefined,
    { sessionManager: session.sessionManager } as never,
  )) as { details: { topology: { name: string; children?: Array<{ name: string; children?: unknown[] }> } } };
  return topologyNames(result.details.topology);
}

function topologyNames(entry: { name: string; children?: unknown[] }): string[] {
  return [
    entry.name,
    ...(entry.children ?? []).flatMap((child) =>
      isRecord(child) && typeof child.name === 'string'
        ? topologyNames(child as { name: string; children?: unknown[] })
        : [],
    ),
  ];
}
