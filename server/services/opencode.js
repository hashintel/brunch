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
    return OC_MODELS[modelId] ?? { providerID: 'openai', modelID: modelId };
}

/**
 * Returns the set of connected provider IDs from the running OpenCode server.
 * Cached for 30s to avoid hammering the API.
 */
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

/**
 * Returns the OC_MODELS entries whose providerID is connected.
 */
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
        // Avoid dumping huge Response objects or buffers
        if (v?.constructor?.name === 'Response' || v?.constructor?.name === 'Request') return `[${v.constructor.name}]`;
        if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + '…';
        return v;
    }, 2);
    log(label, json?.slice(0, 2000));
}

/**
 * SDK calls return { data, request, response, error }.
 * .data is the parsed body, .response is the raw Response object.
 */
function unwrap(result, label) {
    if (result.error) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        log(`${label} ERROR:`, msg);
        throw new Error(msg);
    }

    return result.data ?? result;
}

export async function queryStructured(prompt, modelId, schema, cwd, projectId) {
    const client = getClient();
    const start = Date.now();
    let response = null;
    let error = null;

    try {
        const session = unwrap(await client.session.create({ directory: cwd || undefined }), 'session.create');
        log('queryStructured session:', session.id);

        const data = unwrap(await client.session.prompt({
            sessionID: session.id,
            model: ocModel(modelId),
            format: { type: 'json_schema', schema },
            parts: [{ type: 'text', text: prompt }],
        }), 'session.prompt');

        // OpenCode puts structured output in info.structured when using json_schema format
        if (data.info?.structured) {
            log('queryStructured: got structured output from info.structured');
            response = JSON.stringify(data.info.structured);
            return data.info.structured;
        }

        // Fallback: extract text from response parts
        const parts = data.parts ?? [];
        const textParts = (Array.isArray(parts) ? parts : []).filter(p => p.type === 'text');
        log('queryStructured parts:', parts.length, 'text parts:', textParts.length);

        const text = textParts.map(p => p.text).join('');

        if (!text) {
            log('queryStructured: no text parts. All part types:', parts.map(p => p.type));
            dump('queryStructured full response', data);
            throw new Error('No text in OpenCode response');
        }

        response = text;
        return JSON.parse(text);
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

        const partTextLengths = {};

        const sse = await client.event.subscribe();

        unwrap(await client.session.promptAsync({
            sessionID: sessionId,
            model: ocModel(modelId),
            parts: [{ type: 'text', text: prompt }],
        }), 'session.promptAsync');

        for await (const event of sse.stream) {
            // Filter to our session
            const evtSessionId = event.properties?.sessionID ?? event.properties?.part?.sessionID;
            if (evtSessionId && evtSessionId !== sessionId) continue;

            dump('sse event', { type: event.type, props: event.properties });

            if (event.type === 'message.part.updated') {
                const part = event.properties.part;
                const delta = event.properties.delta;
                if (part.type === 'text') {
                    if (delta != null) {
                        sendEvent({ type: 'text', text: delta });
                        fullText += delta;
                    } else {
                        const prevLen = partTextLengths[part.id] ?? 0;
                        if (part.text.length > prevLen) {
                            const textDelta = part.text.slice(prevLen);
                            sendEvent({ type: 'text', text: textDelta });
                            fullText += textDelta;
                        }
                        partTextLengths[part.id] = part.text.length;
                    }
                } else if (part.type === 'tool') {
                    if (part.state.status === 'pending' || part.state.status === 'running') {
                        sendEvent({ type: 'tool_start', tool: part.tool });
                    } else if (part.state.status === 'completed' || part.state.status === 'error') {
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

// Tool names that are our assistant MCP tools
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

        const partTextLengths = {};
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

            if (event.type === 'message.part.updated') {
                const part = event.properties.part;
                const delta = event.properties.delta;

                if (part.type === 'text') {
                    if (delta != null) {
                        sendEvent({ type: 'text', text: delta });
                        fullText += delta;
                    } else {
                        const prevLen = partTextLengths[part.id] ?? 0;
                        if (part.text.length > prevLen) {
                            const textDelta = part.text.slice(prevLen);
                            sendEvent({ type: 'text', text: textDelta });
                            fullText += textDelta;
                        }
                        partTextLengths[part.id] = part.text.length;
                    }
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

/**
 * Extract the base assistant tool name from an OpenCode MCP tool name.
 * OpenCode may prefix tool names with the MCP server name, e.g. "brunch-assistant_set_goal"
 * or use double-underscore format "brunch-assistant__set_goal".
 */
function extractAssistantToolName(toolName) {
    for (const name of ASSISTANT_TOOLS) {
        if (toolName === name) return name;
        if (toolName.endsWith('__' + name)) return name;
        if (toolName.endsWith('_' + name)) return name;
    }
    return null;
}
