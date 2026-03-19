import { query } from '@anthropic-ai/claude-agent-sdk';
import db from '../db.js';

const READ_TOOLS = ['Read', 'Glob', 'Grep'];
const CWD_SYSTEM_PROMPT = 'You have access to a project directory. Use the Read, Glob, and Grep tools to explore the codebase and answer questions based on the actual files. Always investigate the project before responding.';

export function cwdOptions(cwd) {
    if (!cwd) return {};
    return { cwd, allowedTools: READ_TOOLS, systemPrompt: CWD_SYSTEM_PROMPT };
}

const logClaudeCall = db.prepare(`
    INSERT INTO claude_call (model, caller, prompt, response, input_tokens, output_tokens, turns, duration_ms, status, error, cwd, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export function extractUsage(messages) {
    let inputTokens = 0;
    let outputTokens = 0;
    let turns = 0;
    for (const msg of messages) {
        if (msg.type === 'stream_event' && msg.event.type === 'message_delta' && msg.event.usage) {
            outputTokens += msg.event.usage.output_tokens ?? 0;
        }
        if (msg.type === 'stream_event' && msg.event.type === 'message_start' && msg.event.message?.usage) {
            inputTokens += msg.event.message.usage.input_tokens ?? 0;
            turns++;
        }
    }
    return { inputTokens, outputTokens, turns };
}

export async function streamQueryText(prompt, modelId, res, cwd, projectId) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const start = Date.now();
    const allMessages = [];
    let fullText = '';
    let error = null;
    let currentTool = null;

    function sendEvent(obj) {
        res.write(JSON.stringify(obj) + '\n');
    }

    try {
        for await (const msg of query({
            prompt,
            options: {
                model: modelId,
                maxTurns: 100,
                includePartialMessages: true,
                ...cwdOptions(cwd),
            },
        })) {
            allMessages.push(msg);
            if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_delta' &&
                msg.event.delta.type === 'text_delta'
            ) {
                sendEvent({ type: 'text', text: msg.event.delta.text });
                fullText += msg.event.delta.text;
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_start' &&
                msg.event.content_block?.type === 'tool_use'
            ) {
                currentTool = msg.event.content_block.name;
                sendEvent({ type: 'tool_start', tool: currentTool });
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_stop' &&
                currentTool
            ) {
                sendEvent({ type: 'tool_end', tool: currentTool });
                currentTool = null;
            }
        }
        sendEvent({ type: 'done' });
        res.end();
    } catch (e) {
        error = e;
        throw e;
    } finally {
        const { inputTokens, outputTokens, turns } = extractUsage(allMessages);
        try {
            logClaudeCall.run(
                modelId, 'streamQueryText', prompt,
                fullText || null,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            );
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
    return fullText;
}

export async function queryStructured(prompt, modelId, schema, cwd, projectId) {
    const start = Date.now();
    const allMessages = [];
    let result;
    let error = null;

    try {
        for await (const msg of query({
            prompt,
            options: {
                model: modelId,
                maxTurns: 100,
                outputFormat: { type: 'json_schema', schema },
                ...cwdOptions(cwd),
            },
        })) {
            allMessages.push(msg);
            if (msg.type === 'result') {
                result = msg;
            }
        }
        if (result?.subtype === 'success' && result.structured_output) {
            return result.structured_output;
        }
        // Fallback: parse the result text as JSON
        if (result?.subtype === 'success' && result.result) {
            return JSON.parse(result.result);
        }
        throw new Error(result?.subtype ?? 'Unknown error');
    } catch (e) {
        error = e;
        throw e;
    } finally {
        const { inputTokens, outputTokens, turns } = extractUsage(allMessages);
        const response = result?.structured_output
            ? JSON.stringify(result.structured_output)
            : result?.result ?? null;
        try {
            logClaudeCall.run(
                modelId, 'queryStructured', prompt,
                response,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            );
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
}
