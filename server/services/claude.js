import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import pool from '../db.js';

const READ_TOOLS = ['Read', 'Glob', 'Grep'];
const CWD_SYSTEM_PROMPT = 'You have access to a project directory. Use the Read, Glob, and Grep tools to explore the codebase and answer questions based on the actual files. Always investigate the project before responding.';

export function cwdOptions(cwd) {
    if (!cwd) return {};
    return { cwd, allowedTools: READ_TOOLS, systemPrompt: CWD_SYSTEM_PROMPT };
}

const LOG_SQL = `
    INSERT INTO claude_call (model, caller, prompt, response, input_tokens, output_tokens, turns, duration_ms, status, error, cwd, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

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
    let isThinking = false;

    function sendEvent(obj) {
        if (obj.type !== 'text') {
            console.log(`[stream] ▸ ${JSON.stringify(obj)}`);
        }
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
                msg.event.type === 'content_block_start' &&
                msg.event.content_block?.type === 'thinking'
            ) {
                isThinking = true;
                sendEvent({ type: 'thinking_start' });
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_stop' &&
                isThinking
            ) {
                isThinking = false;
                sendEvent({ type: 'thinking_end' });
            } else if (
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
            await pool.execute(LOG_SQL, [
                modelId, 'streamQueryText', prompt,
                fullText || null,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
    return fullText;
}

export function createAssistantMcpServer(projectId) {
    // Side-channel for passing generated UUIDs from create tools to the stream
    const toolResults = {};
    const server = createSdkMcpServer({
        name: 'assistant-tools',
        version: '1.0.0',
        tools: [
            tool(
                'set_goal',
                'Set the goal text in the spec elicitation form. Use this when the user has agreed on a goal definition.',
                { goal: z.string().describe('The goal text to set in the form') },
                async ({ goal }) => {
                    console.log('[set_goal] Tool called with goal:', goal.slice(0, 80));
                    if (projectId) {
                        await pool.execute('UPDATE project SET goal = ?, updated_at = NOW() WHERE pk = ?', [goal, projectId]);
                    }
                    return { content: [{ type: 'text', text: 'Goal has been set successfully in the form.' }] };
                },
            ),
            tool(
                'update_assumption',
                'Update an assumption in the spec. Use this when the user wants to change the text, status, confidence, or impact of an assumption.',
                {
                    id: z.string().describe('The assumption ID to update'),
                    text: z.string().optional().describe('New text for the assumption'),
                    status: z.enum(['pending', 'confirmed', 'edited', 'rejected']).optional().describe('New status'),
                    confidence: z.enum(['high', 'medium', 'low']).optional().describe('New confidence level'),
                    impact: z.enum(['high', 'medium', 'low']).optional().describe('New impact level'),
                },
                async ({ id, text, status, confidence, impact }) => {
                    console.log('[update_assumption] Tool called for id:', id);
                    if (projectId) {
                        const sets = [];
                        const params = [];
                        if (text != null) { sets.push('`text` = ?', '`edited_text` = ?'); params.push(text, text); }
                        if (status != null) { sets.push('`status` = ?'); params.push(status); }
                        if (confidence != null) { sets.push('`confidence` = ?'); params.push(confidence); }
                        if (impact != null) { sets.push('`impact` = ?'); params.push(impact); }
                        if (sets.length > 0) {
                            sets.push('`updated_at` = NOW()');
                            params.push(id, projectId);
                            await pool.execute(`UPDATE assumption SET ${sets.join(', ')} WHERE uuid = ? AND project_id = ?`, params);
                        }
                    }
                    return { content: [{ type: 'text', text: `Assumption ${id} has been updated successfully.` }] };
                },
            ),
            tool(
                'create_assumption',
                'Create a new assumption in the spec. Use this when the user wants to add a new assumption.',
                {
                    text: z.string().describe('The assumption text'),
                    rationale: z.string().describe('Why this assumption is being made'),
                    confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level'),
                    impact: z.enum(['high', 'medium', 'low']).describe('Impact level'),
                },
                async ({ text, rationale, confidence, impact }) => {
                    const uuid = crypto.randomUUID();
                    toolResults.lastCreateId = uuid;
                    console.log('[create_assumption] Tool called, uuid:', uuid);
                    if (projectId) {
                        const [maxRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM assumption WHERE project_id = ?', [projectId]);
                        const sortOrder = maxRows[0].next_order;
                        await pool.execute(
                            'INSERT INTO assumption (uuid, project_id, `text`, rationale, confidence, impact, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [uuid, projectId, text, rationale, confidence, impact, 'pending', sortOrder],
                        );
                    }
                    return { content: [{ type: 'text', text: `Assumption created with id ${uuid}.` }] };
                },
            ),
            tool(
                'delete_assumption',
                'Delete an assumption from the spec. Use this when the user wants to remove an assumption.',
                {
                    id: z.string().describe('The assumption ID to delete'),
                },
                async ({ id }) => {
                    console.log('[delete_assumption] Tool called for id:', id);
                    if (projectId) {
                        await pool.execute('DELETE FROM assumption WHERE uuid = ? AND project_id = ?', [id, projectId]);
                    }
                    return { content: [{ type: 'text', text: `Assumption ${id} has been deleted.` }] };
                },
            ),
            tool(
                'update_requirement',
                'Update a requirement in the spec. Use this when the user wants to change the title, definition, confidence, or stage of a requirement.',
                {
                    id: z.string().describe('The requirement ID to update'),
                    title: z.string().optional().describe('New title for the requirement'),
                    definition: z.string().optional().describe('New definition for the requirement'),
                    confidence: z.number().min(0).max(1).optional().describe('New confidence level (0-1)'),
                    stage: z.enum(['proposal', 'approved', 'completed']).optional().describe('New stage'),
                },
                async ({ id, title, definition, confidence, stage }) => {
                    console.log('[update_requirement] Tool called for id:', id);
                    if (projectId) {
                        const sets = [];
                        const params = [];
                        if (title != null) { sets.push('`title` = ?'); params.push(title); }
                        if (definition != null) { sets.push('`description` = ?'); params.push(definition); }
                        if (confidence != null) { sets.push('`confidence` = ?'); params.push(confidence); }
                        if (stage != null) { sets.push('`stage` = ?'); params.push(stage); }
                        if (sets.length > 0) {
                            sets.push('`updated_at` = NOW()');
                            params.push(id, projectId);
                            await pool.execute(`UPDATE entry SET ${sets.join(', ')} WHERE uuid = ? AND project_id = ?`, params);
                        }
                    }
                    return { content: [{ type: 'text', text: `Requirement ${id} has been updated successfully.` }] };
                },
            ),
            tool(
                'create_requirement',
                'Create a new requirement in the spec. Use this when the user wants to add a new requirement.',
                {
                    title: z.string().describe('The requirement title'),
                    definition: z.string().describe('The requirement definition/description'),
                    confidence: z.number().min(0).max(1).optional().describe('Confidence level (0-1), defaults to 0.5'),
                    parent_id: z.string().optional().describe('Parent requirement ID for nesting'),
                },
                async ({ title, definition, confidence, parent_id }) => {
                    const uuid = crypto.randomUUID();
                    toolResults.lastCreateId = uuid;
                    console.log('[create_requirement] Tool called, uuid:', uuid);
                    if (projectId) {
                        let parentPk = null;
                        if (parent_id) {
                            const [parentRows] = await pool.execute('SELECT pk FROM entry WHERE uuid = ? AND project_id = ?', [parent_id, projectId]);
                            if (parentRows.length > 0) parentPk = parentRows[0].pk;
                        }
                        const [maxRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM entry WHERE project_id = ?', [projectId]);
                        const sortOrder = maxRows[0].next_order;
                        await pool.execute(
                            'INSERT INTO entry (uuid, project_id, title, `description`, confidence, stage, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [uuid, projectId, title, definition, confidence ?? 0.5, 'proposal', parentPk, sortOrder],
                        );
                    }
                    return { content: [{ type: 'text', text: `Requirement created with id ${uuid}.` }] };
                },
            ),
            tool(
                'delete_requirement',
                'Delete a requirement from the spec. Use this when the user wants to remove a requirement.',
                {
                    id: z.string().describe('The requirement ID to delete'),
                },
                async ({ id }) => {
                    console.log('[delete_requirement] Tool called for id:', id);
                    if (projectId) {
                        await pool.execute('DELETE FROM entry WHERE uuid = ? AND project_id = ?', [id, projectId]);
                    }
                    return { content: [{ type: 'text', text: `Requirement ${id} has been deleted.` }] };
                },
            ),
        ],
    });
    return { server, toolResults };
}

export async function streamQueryTextWithTools(prompt, modelId, res, cwd, projectId, mcpServers, mcpToolNames = new Set(), toolResults = {}) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const start = Date.now();
    const allMessages = [];
    let fullText = '';
    let error = null;
    let currentTool = null;
    let currentToolInput = '';
    let isThinking = false;
    let pendingMcpEvents = []; // Queue MCP tool_use events until after tool handler executes

    function sendEvent(obj) {
        if (obj.type !== 'text') {
            console.log(`[stream+tools] ▸ ${JSON.stringify(obj)}`);
        }
        res.write(JSON.stringify(obj) + '\n');
    }

    function flushPendingMcpEvents() {
        for (const evt of pendingMcpEvents) {
            // For create tools, attach the server-generated UUID
            if (evt.tool.startsWith('create_') && toolResults.lastCreateId) {
                evt.createdId = toolResults.lastCreateId;
                toolResults.lastCreateId = null;
            }
            sendEvent(evt);
        }
        pendingMcpEvents = [];
    }

    try {
        for await (const msg of query({
            prompt,
            options: {
                model: modelId,
                maxTurns: 10,
                includePartialMessages: true,
                mcpServers: mcpServers ?? {},
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
                ...cwdOptions(cwd),
            },
        })) {
            allMessages.push(msg);

            // Flush pending MCP events when a new turn starts (tool handler has executed)
            if (msg.type === 'stream_event' && msg.event.type === 'message_start' && pendingMcpEvents.length > 0) {
                flushPendingMcpEvents();
            }

            if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_start' &&
                msg.event.content_block?.type === 'thinking'
            ) {
                isThinking = true;
                sendEvent({ type: 'thinking_start' });
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_stop' &&
                isThinking
            ) {
                isThinking = false;
                sendEvent({ type: 'thinking_end' });
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_delta' &&
                msg.event.delta.type === 'text_delta'
            ) {
                sendEvent({ type: 'text', text: msg.event.delta.text });
                fullText += msg.event.delta.text;
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_delta' &&
                msg.event.delta.type === 'input_json_delta' &&
                currentTool && mcpToolNames.has(currentTool)
            ) {
                currentToolInput += msg.event.delta.partial_json ?? '';
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_start' &&
                msg.event.content_block?.type === 'tool_use'
            ) {
                currentTool = msg.event.content_block.name;
                currentToolInput = '';
                if (!mcpToolNames.has(currentTool)) {
                    sendEvent({ type: 'tool_start', tool: currentTool });
                }
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_stop' &&
                currentTool
            ) {
                if (mcpToolNames.has(currentTool)) {
                    // Extract the original tool name (strip mcp__serverName__ prefix)
                    const parts = currentTool.split('__');
                    const originalName = parts.length >= 3 ? parts.slice(2).join('__') : currentTool;
                    try {
                        const input = JSON.parse(currentToolInput);
                        // Queue the event — it will be flushed after the tool handler executes
                        pendingMcpEvents.push({ type: 'tool_use', tool: originalName, input });
                    } catch {
                        // If we can't parse the input, skip
                    }
                } else {
                    sendEvent({ type: 'tool_end', tool: currentTool });
                }
                currentTool = null;
                currentToolInput = '';
            }
        }
        // Flush any remaining pending events (e.g., if the last tool was an MCP tool)
        flushPendingMcpEvents();
        sendEvent({ type: 'done' });
        res.end();
    } catch (e) {
        error = e;
        throw e;
    } finally {
        const { inputTokens, outputTokens, turns } = extractUsage(allMessages);
        try {
            await pool.execute(LOG_SQL, [
                modelId, 'streamQueryTextWithTools', prompt,
                fullText || null,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
    return fullText;
}

export async function streamQueryWithTools(prompt, modelId, res, tools, cwd, projectId) {
    res.removeHeader('Content-Length');
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const start = Date.now();
    const allMessages = [];
    let fullText = '';
    let error = null;
    let currentTool = null;
    let currentToolInput = '';
    let isThinking = false;
    let toolCounter = 0;

    // Convert JSON Schema tool defs to SDK tool() helpers
    const sdkTools = tools.map(t =>
        tool(t.name, t.description, buildZodSchema(t.inputSchema), async (input) => {
            toolCounter++;
            return { content: [{ type: 'text', text: `Added ${t.name} #${toolCounter}` }] };
        })
    );

    function sendEvent(obj) {
        if (obj.type !== 'text') {
            console.log(`[wizard-tools] ▸ ${JSON.stringify(obj)}`);
        }
        res.write(JSON.stringify(obj) + '\n');
    }

    try {
        const mcpServer = createSdkMcpServer({
            name: 'wizard-tools',
            version: '1.0.0',
            tools: sdkTools,
        });

        for await (const msg of query({
            prompt,
            options: {
                model: modelId,
                maxTurns: 10,
                includePartialMessages: true,
                mcpServers: { 'wizard-tools': mcpServer },
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
                ...cwdOptions(cwd),
            },
        })) {
            allMessages.push(msg);

            if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_start' &&
                msg.event.content_block?.type === 'thinking'
            ) {
                isThinking = true;
                sendEvent({ type: 'thinking_start' });
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_stop' &&
                isThinking
            ) {
                isThinking = false;
                sendEvent({ type: 'thinking_end' });
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_delta' &&
                msg.event.delta.type === 'text_delta'
            ) {
                sendEvent({ type: 'text', text: msg.event.delta.text });
                fullText += msg.event.delta.text;
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_delta' &&
                msg.event.delta.type === 'input_json_delta' &&
                currentTool
            ) {
                currentToolInput += msg.event.delta.partial_json ?? '';
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_start' &&
                msg.event.content_block?.type === 'tool_use'
            ) {
                currentTool = msg.event.content_block.name;
                currentToolInput = '';
            } else if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_stop' &&
                currentTool
            ) {
                // Strip mcp__serverName__ prefix
                const parts = currentTool.split('__');
                const originalName = parts.length >= 3 ? parts.slice(2).join('__') : currentTool;
                try {
                    const input = JSON.parse(currentToolInput);
                    sendEvent({ type: 'tool_use', tool: originalName, input });
                } catch {
                    // skip unparseable
                }
                currentTool = null;
                currentToolInput = '';
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
            await pool.execute(LOG_SQL, [
                modelId, 'streamQueryWithTools', prompt,
                fullText || null,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
    return fullText;
}

// Convert JSON Schema to Zod schema (basic subset needed for wizard tools)
function buildZodSchema(jsonSchema) {
    if (!jsonSchema || jsonSchema.type !== 'object') return z.object({});
    const shape = {};
    for (const [key, prop] of Object.entries(jsonSchema.properties ?? {})) {
        shape[key] = jsonSchemaPropToZod(prop);
        if (!jsonSchema.required?.includes(key)) {
            shape[key] = shape[key].optional();
        }
    }
    return z.object(shape);
}

function jsonSchemaPropToZod(prop) {
    if (prop.enum) return z.enum(prop.enum);
    if (prop.type === 'string') return z.string();
    if (prop.type === 'number') return z.number();
    if (prop.type === 'boolean') return z.boolean();
    if (prop.type === 'array') {
        if (prop.items?.type === 'object') return z.array(buildZodSchema(prop.items));
        if (prop.items?.type === 'string') return z.array(z.string());
        return z.array(z.any());
    }
    if (prop.type === 'object') return buildZodSchema(prop);
    return z.any();
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
            await pool.execute(LOG_SQL, [
                modelId, 'queryStructured', prompt,
                response,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
}
