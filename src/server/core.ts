import { query } from '@anthropic-ai/claude-agent-sdk';

import {
  getProject,
  getActivePath,
  getOptionsForTurn,
  getTurn,
  createTurn,
  updateTurn,
  advanceHead,
  listProjects,
  createProject,
  type Turn,
  type DB,
  type Project,
} from './db.js';
import { getSystemPrompt, createInterviewMcpServer } from './interview.js';

/** Domain events yielded by conductTurn(). Transport-agnostic. */
export type DomainEvent =
  | { type: 'stream-start'; messageId: string }
  | { type: 'thinking'; delta: string }
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call-start'; toolName: string; toolCallId: string }
  | { type: 'tool-call-delta'; toolCallId: string; delta: string }
  | { type: 'tool-call-end'; toolCallId: string; toolName: string }
  | { type: 'stream-end' }
  | { type: 'turn-created'; turn: Turn }
  | { type: 'error'; message: string };

/** Extract user text from a UIMessage (parts[]) or legacy format (content string). */
export function extractPrompt(messages: unknown[]): string {
  const lastMessage = messages?.[messages.length - 1] as Record<string, unknown> | undefined;
  if (!lastMessage) return '';
  if (typeof lastMessage.content === 'string') return lastMessage.content;
  const parts = lastMessage.parts as Array<{ type: string; text: string }> | undefined;
  return (
    parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('') ?? ''
  );
}

/** Turn with optional options for richer history formatting. */
export interface TurnWithOptions extends Turn {
  options?: Array<{ content: string; is_recommended: boolean; is_selected: boolean }>;
}

/** Format conversation history from active-path turns for multi-turn context. */
export function formatHistory(turns: TurnWithOptions[], currentPrompt: string): string {
  if (turns.length === 0) return currentPrompt;
  const lines: string[] = [];
  for (const turn of turns) {
    if (turn.question) {
      let questionLine = `Question: ${turn.question}`;
      if (turn.why) questionLine += `\n  Why it matters: ${turn.why}`;
      if (turn.impact) questionLine += `\n  Impact: ${turn.impact}`;
      if (turn.options?.length) {
        const optionList = turn.options
          .map((o, i) => {
            const rec = o.is_recommended ? ' (recommended)' : '';
            const sel = o.is_selected ? ' [selected]' : '';
            return `    ${i + 1}. ${o.content}${rec}${sel}`;
          })
          .join('\n');
        questionLine += `\n  Options:\n${optionList}`;
      }
      lines.push(questionLine);
    }
    if (turn.answer) lines.push(`Answer: ${turn.answer}`);
  }
  if (lines.length === 0) return currentPrompt;
  return `Previous conversation:\n${lines.join('\n')}\n\n---\nUser: ${currentPrompt}`;
}

/** SDK stream event shapes we consume */
interface SDKStreamEvent {
  type: 'stream_event';
  event: {
    type: string;
    index?: number;
    message?: { id: string };
    content_block?: { type: string; name?: string; id?: string };
    delta?: { type: string; text?: string; thinking?: string; partial_json?: string };
  };
}

/**
 * Conduct a turn: create turn, stream agent response, persist result.
 * Yields DomainEvents for adapter consumption.
 */
export async function* conductTurn(
  db: DB,
  projectId: number,
  userMessage: string,
  phase: Turn['phase'] = 'scope',
): AsyncGenerator<DomainEvent> {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const rawActivePath = getActivePath(db, projectId);
  const activePath = rawActivePath.map((t) => ({
    ...t,
    options: getOptionsForTurn(db, t.id),
  }));

  const turn = createTurn(db, projectId, {
    parent_turn_id: project.active_turn_id,
    phase,
    question: '',
    answer: userMessage,
  });

  yield { type: 'turn-created', turn };

  const fullPrompt = formatHistory(activePath, userMessage);
  let assistantText = '';
  let errored = false;

  // Create per-turn MCP server — tool handler persists structured data via closure
  const interviewServer = createInterviewMcpServer(db, turn.id);

  try {
    const stream = query({
      prompt: fullPrompt,
      options: {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        maxTurns: 1,
        includePartialMessages: true,
        systemPrompt: getSystemPrompt(phase),
        mcpServers: { interview: interviewServer },
      },
    });

    const toolUseBlocks = new Map<number, { toolName: string; toolCallId: string }>();

    for await (const sdkMessage of stream) {
      if (sdkMessage.type !== 'stream_event') continue;
      const event = (sdkMessage as SDKStreamEvent).event;

      switch (event.type) {
        case 'message_start':
          yield { type: 'stream-start', messageId: event.message!.id };
          break;

        case 'content_block_start': {
          const block = event.content_block!;
          if (block.type === 'tool_use') {
            toolUseBlocks.set(event.index!, { toolName: block.name!, toolCallId: block.id! });
            yield { type: 'tool-call-start', toolName: block.name!, toolCallId: block.id! };
          }
          break;
        }

        case 'content_block_delta': {
          const delta = event.delta!;
          if (delta.type === 'thinking_delta' && delta.thinking) {
            yield { type: 'thinking', delta: delta.thinking };
          } else if (delta.type === 'text_delta' && delta.text) {
            assistantText += delta.text;
            yield { type: 'text-delta', delta: delta.text };
          } else if (delta.type === 'input_json_delta' && delta.partial_json) {
            const toolBlock = toolUseBlocks.get(event.index!);
            yield {
              type: 'tool-call-delta',
              toolCallId: toolBlock?.toolCallId ?? '',
              delta: delta.partial_json,
            };
          }
          break;
        }

        case 'content_block_stop': {
          const toolBlock = toolUseBlocks.get(event.index!);
          if (toolBlock) {
            yield {
              type: 'tool-call-end',
              toolCallId: toolBlock.toolCallId,
              toolName: toolBlock.toolName,
            };
            toolUseBlocks.delete(event.index!);
          }
          break;
        }

        case 'message_stop':
          yield { type: 'stream-end' };
          break;
      }
    }
  } catch (err) {
    errored = true;
    const message = err instanceof Error ? err.message : 'Unknown error';
    yield { type: 'error', message };
  }

  if (!errored) {
    // Only persist raw text if no structured question was set via MCP tool handler
    const currentTurn = getTurn(db, turn.id);
    if (assistantText && (!currentTurn?.question || currentTurn.question === '')) {
      updateTurn(db, turn.id, { question: assistantText });
    }
    advanceHead(db, projectId, turn.id);
  }
}

/** Get project state: project + active path turns. */
export function getProjectState(db: DB, projectId: number) {
  const project = getProject(db, projectId);
  if (!project) return null;
  const turns = getActivePath(db, projectId);
  return { project, turns };
}

/** List all projects. */
export function listProjectStates(db: DB): Project[] {
  return listProjects(db);
}

/** Create a new project with the given name. */
export function createNewProject(db: DB, name: string): Project {
  return createProject(db, name);
}
