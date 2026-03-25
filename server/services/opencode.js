import { createOpencodeClient } from '@opencode-ai/sdk/v2';
import pool from '../db.js';

const DEBUG = process.env.OPENCODE_DEBUG === '1';

const LOG_SQL = `
    INSERT INTO claude_call (model, caller, prompt, response, input_tokens, output_tokens, turns, duration_ms, status, error, cwd, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// OpenCode model ID → { providerID, modelID }
const OC_MODELS = {
    'big-pickle':           { providerID: 'opencode', modelID: 'big-pickle' },
    'gpt-5-nano':           { providerID: 'opencode', modelID: 'gpt-5-nano' },
    'nemotron-3-super-free': { providerID: 'opencode', modelID: 'nemotron-3-super-free' },
    'minimax-m2.5-free':    { providerID: 'opencode', modelID: 'minimax-m2.5-free' },
};

let _client;
function getClient() {
    if (!_client) {
        const baseUrl = process.env.OPENCODE_URL;
        if (!baseUrl) throw new Error('OPENCODE_URL environment variable is not set. Run `opencode serve` and set OPENCODE_URL.');
        _client = createOpencodeClient({ baseUrl });
    }
    return _client;
}

function ocModel(modelId) {
    return OC_MODELS[modelId] ?? { providerID: 'opencode', modelID: modelId };
}

let _connectedCache = { providers: null, ts: 0 };
export async function getConnectedProviders() {
    const now = Date.now();
    if (_connectedCache.providers && now - _connectedCache.ts < 30_000) {
        return _connectedCache.providers;
    }
    try {
        const client = getClient();
        const result = await client.provider.list();
        const data = result.data ?? result;
        const connected = new Set(data.connected ?? []);
        _connectedCache = { providers: connected, ts: now };
        return connected;
    } catch {
        return _connectedCache.providers ?? new Set();
    }
}

export async function getAvailableModelIds() {
    const connected = await getConnectedProviders();
    return Object.keys(OC_MODELS).filter(id => connected.has(OC_MODELS[id].providerID));
}

function log(...args) {
    console.log('[opencode]', ...args);
}

function dump(label, obj) {
    if (!DEBUG) return;
    const json = JSON.stringify(obj, (_k, v) => {
        if (v?.constructor?.name === 'Response' || v?.constructor?.name === 'Request') return `[${v.constructor.name}]`;
        if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + '…';
        return v;
    }, 2);
    log(label, json?.slice(0, 2000));
}

function unwrap(result, label) {
    if (result.error) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        log(`${label} ERROR:`, msg);
        throw new Error(msg);
    }
    return result.data ?? result;
}

// ── queryStructured (sync prompt with json_schema) ──

export async function queryStructured(prompt, modelId, schema, cwd, projectId) {
    const client = getClient();
    const start = Date.now();
    let response = null;
    let error = null;

    try {
        const session = unwrap(await client.session.create({ directory: cwd || undefined }), 'session.create');
        const sessionId = session.id;
        log('queryStructured session:', sessionId);

        // Use async prompt + SSE instead of sync prompt.
        // The sync session.prompt hangs when the OpenCode agent does multi-turn tool use.
        const sse = await client.event.subscribe();

        unwrap(await client.session.promptAsync({
            sessionID: sessionId,
            model: ocModel(modelId),
            format: { type: 'json_schema', schema },
            parts: [{ type: 'text', text: prompt }],
        }), 'session.promptAsync');

        log('queryStructured: waiting for session.idle via SSE...');

        // Listen for the final message.updated with info.structured, or session.idle
        let structured = null;
        let timedOut = false;
        const timeout = setTimeout(() => { timedOut = true; }, 180_000);

        for await (const event of sse.stream) {
            if (timedOut) throw new Error('OpenCode queryStructured timed out after 180s');

            const evtSessionId = event.properties?.sessionID ?? event.properties?.info?.sessionID;
            if (evtSessionId && evtSessionId !== sessionId) continue;

            if (event.type === 'message.updated') {
                const info = event.properties?.info;
                if (info?.role === 'assistant' && info?.structured) {
                    structured = info.structured;
                    log('queryStructured: got structured from message.updated');
                }
            } else if (event.type === 'session.idle') {
                break;
            } else if (event.type === 'session.error') {
                const errMsg = event.properties?.error || 'OpenCode session error';
                throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
            }
        }
        clearTimeout(timeout);

        if (structured) {
            response = JSON.stringify(structured);
            return structured;
        }

        log('queryStructured: no structured output found in SSE events');
        throw new Error('No structured output in OpenCode response');
    } catch (e) {
        error = e;
        throw e;
    } finally {
        try {
            await pool.execute(LOG_SQL, [
                modelId, 'queryStructured', prompt,
                response,
                null, null, null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log opencode call:', e.message);
        }
    }
}

// ── streamQueryText (async prompt + SSE) ──
//
// OpenCode SSE event flow:
//   message.part.updated  (type=text, textLen=0)  → part created
//   message.part.delta    (field=text, delta=...)  → text chunk (use this for streaming)
//   message.part.updated  (type=text, textLen=N)   → part state updated
//   message.part.updated  (type=tool, status=pending/running) → tool started
//   message.part.updated  (type=tool, status=completed)       → tool finished
//   session.idle                                    → done

export async function streamQueryText(prompt, modelId, res, cwd, projectId) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const client = getClient();
    const start = Date.now();
    let fullText = '';
    let error = null;

    function sendEvent(obj) {
        res.write(JSON.stringify(obj) + '\n');
    }

    try {
        const session = unwrap(await client.session.create({ directory: cwd || undefined }), 'session.create');
        const sessionId = session.id;
        log('streamQueryText session:', sessionId);

        // Track which part IDs are text parts (learned from message.part.updated)
        const textPartIds = new Set();
        const emittedToolStarts = new Set();
        const emittedToolEnds = new Set();

        const sse = await client.event.subscribe();

        unwrap(await client.session.promptAsync({
            sessionID: sessionId,
            model: ocModel(modelId),
            parts: [{ type: 'text', text: prompt }],
        }), 'session.promptAsync');

        for await (const event of sse.stream) {
            const evtSessionId = event.properties?.sessionID ?? event.properties?.part?.sessionID;
            if (evtSessionId && evtSessionId !== sessionId) continue;

            dump('sse event', { type: event.type, props: event.properties });

            if (event.type === 'message.part.delta') {
                const { partID, field, delta } = event.properties;
                // Only stream text field deltas for text parts (not reasoning)
                if (field === 'text' && textPartIds.has(partID)) {
                    sendEvent({ type: 'text', text: delta });
                    fullText += delta;
                }
            } else if (event.type === 'message.part.updated') {
                const part = event.properties.part;
                if (part.type === 'text') {
                    textPartIds.add(part.id);
                } else if (part.type === 'tool') {
                    if ((part.state.status === 'pending' || part.state.status === 'running') && !emittedToolStarts.has(part.id)) {
                        emittedToolStarts.add(part.id);
                        sendEvent({ type: 'tool_start', tool: part.tool });
                    } else if ((part.state.status === 'completed' || part.state.status === 'error') && !emittedToolEnds.has(part.id)) {
                        emittedToolEnds.add(part.id);
                        sendEvent({ type: 'tool_end', tool: part.tool });
                    }
                }
            } else if (event.type === 'session.idle') {
                break;
            } else if (event.type === 'session.error') {
                const errMsg = event.properties?.error || 'OpenCode session error';
                throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
            }
        }

        sendEvent({ type: 'done' });
        res.end();
    } catch (e) {
        error = e;
        throw e;
    } finally {
        log('streamQueryText done in', Date.now() - start, 'ms, text length:', fullText.length);
        try {
            await pool.execute(LOG_SQL, [
                modelId, 'streamQueryText', prompt,
                fullText || null,
                null, null, null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log opencode call:', e.message);
        }
    }
    return fullText;
}

// ── streamQueryWithTools (async prompt + SSE, wizard tools via MCP) ──

const WIZARD_TOOLS = new Set([
    'add_question', 'add_assumption', 'add_requirement', 'set_requirements_meta',
]);

export async function streamQueryWithTools(prompt, modelId, res, tools, cwd, projectId) {
    res.removeHeader('Content-Length');
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const client = getClient();
    const start = Date.now();
    let fullText = '';
    let error = null;

    const toolNames = new Set(tools.map(t => t.name));

    function sendEvent(obj) {
        res.write(JSON.stringify(obj) + '\n');
    }

    try {
        const session = unwrap(await client.session.create({ directory: cwd || undefined }), 'session.create');
        const sessionId = session.id;
        log('streamQueryWithTools session:', sessionId);

        const textPartIds = new Set();
        const emittedToolEnds = new Set();

        const sse = await client.event.subscribe();

        unwrap(await client.session.promptAsync({
            sessionID: sessionId,
            model: ocModel(modelId),
            parts: [{ type: 'text', text: prompt }],
        }), 'session.promptAsync');

        for await (const event of sse.stream) {
            const evtSessionId = event.properties?.sessionID ?? event.properties?.part?.sessionID;
            if (evtSessionId && evtSessionId !== sessionId) continue;

            if (event.type === 'message.part.delta') {
                const { partID, field, delta } = event.properties;
                if (field === 'text' && textPartIds.has(partID)) {
                    sendEvent({ type: 'text', text: delta });
                    fullText += delta;
                }
            } else if (event.type === 'message.part.updated') {
                const part = event.properties.part;
                if (part.type === 'text') {
                    textPartIds.add(part.id);
                } else if (part.type === 'tool') {
                    const wizardName = extractWizardToolName(part.tool, toolNames);
                    if (wizardName && part.state.status === 'completed' && !emittedToolEnds.has(part.id)) {
                        emittedToolEnds.add(part.id);
                        sendEvent({ type: 'tool_use', tool: wizardName, input: part.state.input });
                    }
                }
            } else if (event.type === 'session.idle') {
                break;
            } else if (event.type === 'session.error') {
                const errMsg = event.properties?.error || 'OpenCode session error';
                throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
            }
        }

        sendEvent({ type: 'done' });
        res.end();
    } catch (e) {
        error = e;
        throw e;
    } finally {
        log('streamQueryWithTools done in', Date.now() - start, 'ms');
        try {
            await pool.execute(LOG_SQL, [
                modelId, 'streamQueryWithTools', prompt,
                fullText || null,
                null, null, null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log opencode call:', e.message);
        }
    }
    return fullText;
}

function extractWizardToolName(toolName, toolNames) {
    for (const name of toolNames) {
        if (toolName === name) return name;
        if (toolName.endsWith('__' + name)) return name;
        if (toolName.endsWith('_' + name)) return name;
    }
    return null;
}

// ── streamQueryTextWithTools (async prompt + SSE + MCP tools) ──

const ASSISTANT_TOOLS = new Set([
    'set_goal', 'update_assumption', 'create_assumption', 'delete_assumption',
    'update_requirement', 'create_requirement', 'delete_requirement',
]);

export async function streamQueryTextWithTools(prompt, modelId, res, cwd, projectId, _mcpServers, mcpToolNames, toolResults) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const client = getClient();
    const start = Date.now();
    let fullText = '';
    let error = null;

    const augmentedPrompt = `When using assistant tools, always pass project_id: '${projectId}'\n\n${prompt}`;

    function sendEvent(obj) {
        res.write(JSON.stringify(obj) + '\n');
    }

    try {
        const session = unwrap(await client.session.create({ directory: cwd || undefined }), 'session.create');
        const sessionId = session.id;
        log('streamQueryTextWithTools session:', sessionId);

        const textPartIds = new Set();
        const emittedToolStarts = new Set();
        const emittedToolEnds = new Set();

        const sse = await client.event.subscribe();

        unwrap(await client.session.promptAsync({
            sessionID: sessionId,
            model: ocModel(modelId),
            parts: [{ type: 'text', text: augmentedPrompt }],
        }), 'session.promptAsync');

        for await (const event of sse.stream) {
            const evtSessionId = event.properties?.sessionID ?? event.properties?.part?.sessionID;
            if (evtSessionId && evtSessionId !== sessionId) continue;

            dump('sse event', { type: event.type, props: event.properties });

            if (event.type === 'message.part.delta') {
                const { partID, field, delta } = event.properties;
                if (field === 'text' && textPartIds.has(partID)) {
                    sendEvent({ type: 'text', text: delta });
                    fullText += delta;
                }
            } else if (event.type === 'message.part.updated') {
                const part = event.properties.part;

                if (part.type === 'text') {
                    textPartIds.add(part.id);
                } else if (part.type === 'tool') {
                    const toolName = extractAssistantToolName(part.tool);
                    log('tool event:', part.tool, '→', toolName, 'status:', part.state.status);

                    if (toolName && ASSISTANT_TOOLS.has(toolName)) {
                        if (part.state.status === 'completed' && !emittedToolEnds.has(part.id)) {
                            emittedToolEnds.add(part.id);
                            const evt = { type: 'tool_use', tool: toolName, input: part.state.input };
                            if (toolName.startsWith('create_') && part.state.output) {
                                const match = part.state.output.match(/id ([0-9a-f-]{36})/);
                                if (match) evt.createdId = match[1];
                            }
                            sendEvent(evt);
                        }
                    } else {
                        if ((part.state.status === 'pending' || part.state.status === 'running') && !emittedToolStarts.has(part.id)) {
                            emittedToolStarts.add(part.id);
                            sendEvent({ type: 'tool_start', tool: part.tool });
                        } else if ((part.state.status === 'completed' || part.state.status === 'error') && !emittedToolEnds.has(part.id)) {
                            emittedToolEnds.add(part.id);
                            sendEvent({ type: 'tool_end', tool: part.tool });
                        }
                    }
                }
            } else if (event.type === 'session.idle') {
                break;
            } else if (event.type === 'session.error') {
                const errMsg = event.properties?.error || 'OpenCode session error';
                throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
            }
        }

        sendEvent({ type: 'done' });
        res.end();
    } catch (e) {
        error = e;
        throw e;
    } finally {
        log('streamQueryTextWithTools done in', Date.now() - start, 'ms, text length:', fullText.length);
        try {
            await pool.execute(LOG_SQL, [
                modelId, 'streamQueryTextWithTools', prompt,
                fullText || null,
                null, null, null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
                projectId ?? null,
            ]);
        } catch (e) {
            console.error('[db] failed to log opencode call:', e.message);
        }
    }
    return fullText;
}

function extractAssistantToolName(toolName) {
    for (const name of ASSISTANT_TOOLS) {
        if (toolName === name) return name;
        if (toolName.endsWith('__' + name)) return name;
        if (toolName.endsWith('_' + name)) return name;
    }
    return null;
}
