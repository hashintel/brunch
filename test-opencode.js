/**
 * Test OpenCode integration end-to-end.
 * Run: node --env-file=.env test-opencode.js [test]
 *
 * Tests:
 *   sdk-structured     - SDK queryStructured via async+SSE (bypasses Express)
 *   api-clarifying      - Hit /api/clarifyingquestions via HTTP
 *   api-requirements    - Hit /api/streamrequirements via HTTP
 *   api-spec            - Hit /api/generatespec via HTTP
 *   api-stream          - Hit /api/stream via HTTP (streaming text)
 */

const API = process.env.API_URL || 'http://localhost:3001';
const MODEL = process.env.TEST_MODEL || 'gpt-5-nano';
const GOAL = 'Build a simple todo list API with CRUD operations';

async function timed(label, fn) {
    const start = Date.now();
    process.stdout.write(`[${label}] starting... `);
    try {
        const result = await fn();
        console.log(`OK (${Date.now() - start}ms)`);
        return result;
    } catch (e) {
        console.log(`FAILED (${Date.now() - start}ms): ${e.message}`);
        throw e;
    }
}

async function apiPost(path, body, { stream = false, timeout = 300_000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
    }

    if (stream) {
        // Read NDJSON stream
        const text = await res.text();
        const lines = text.split('\n').filter(l => l.trim());
        return lines.map(l => JSON.parse(l));
    }

    return res.json();
}

const tests = {
    async 'sdk-structured'() {
        const { createOpencodeClient } = await import('@opencode-ai/sdk/v2');
        const client = createOpencodeClient({ baseUrl: process.env.OPENCODE_URL });

        const session = await timed('create session', async () => {
            const r = await client.session.create({});
            return r.data ?? r;
        });

        console.log(`  session: ${session.id}`);

        const sse = await client.event.subscribe();

        await timed('promptAsync', async () => {
            const r = await client.session.promptAsync({
                sessionID: session.id,
                model: { providerID: 'opencode', modelID: MODEL },
                format: {
                    type: 'json_schema',
                    schema: {
                        type: 'object',
                        properties: { items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false } } },
                        required: ['items'],
                        additionalProperties: false,
                    },
                },
                parts: [{ type: 'text', text: 'List 3 fruits.' }],
            });
            if (r.error) throw new Error(JSON.stringify(r.error));
        });

        let structured = null;
        let events = 0;
        const start = Date.now();

        for await (const event of sse.stream) {
            const sid = event.properties?.sessionID ?? event.properties?.info?.sessionID;
            if (sid && sid !== session.id) continue;
            events++;

            if (event.type === 'message.updated') {
                const info = event.properties?.info;
                if (info?.role === 'assistant' && info?.structured) {
                    structured = info.structured;
                }
            } else if (event.type === 'session.idle') {
                break;
            } else if (event.type === 'session.error') {
                throw new Error(`session.error: ${JSON.stringify(event.properties?.error)}`);
            }
        }

        console.log(`  SSE: ${events} events in ${Date.now() - start}ms`);
        console.log(`  structured: ${JSON.stringify(structured)}`);
        if (!structured) throw new Error('No structured output');
    },

    async 'api-clarifying'() {
        const result = await timed('POST /api/clarifyingquestions', () =>
            apiPost('/api/clarifyingquestions', { prompt: GOAL, model: MODEL })
        );
        console.log(`  questions: ${result.questions?.length ?? 0}, done: ${result.done}`);
        if (!result.questions) throw new Error('No questions in response');
    },

    async 'api-requirements'() {
        const result = await timed('POST /api/streamrequirements', () =>
            apiPost('/api/streamrequirements', { prompt: GOAL, model: MODEL })
        );
        console.log(`  requirements: ${result.requirements?.length ?? 0}`);
        if (!result.requirements) throw new Error('No requirements in response');
    },

    async 'api-spec'() {
        const result = await timed('POST /api/generatespec', () =>
            apiPost('/api/generatespec', { prompt: GOAL, model: MODEL })
        );
        console.log(`  spec length: ${result.spec?.length ?? 0}, progress: ${result.progress}`);
        if (!result.spec) throw new Error('No spec in response');
    },

    async 'api-stream'() {
        const events = await timed('POST /api/stream (text)', () =>
            apiPost('/api/stream', { prompt: `Describe "${GOAL}" in one sentence.`, model: MODEL }, { stream: true })
        );
        const textEvents = events.filter(e => e.type === 'text');
        const doneEvents = events.filter(e => e.type === 'done');
        const text = textEvents.map(e => e.text).join('');
        console.log(`  events: ${events.length} (${textEvents.length} text, ${doneEvents.length} done)`);
        console.log(`  text: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
        if (!doneEvents.length) throw new Error('No done event');
    },

    async 'all'() {
        const names = ['sdk-structured', 'api-clarifying', 'api-requirements', 'api-spec', 'api-stream'];
        const results = [];
        for (const name of names) {
            try {
                await tests[name]();
                results.push({ name, status: 'PASS' });
            } catch (e) {
                results.push({ name, status: 'FAIL', error: e.message });
            }
            console.log('');
        }
        console.log('\n=== Summary ===');
        for (const r of results) {
            console.log(`  ${r.status === 'PASS' ? '✓' : '✗'} ${r.name}${r.error ? ': ' + r.error : ''}`);
        }
        const failed = results.filter(r => r.status === 'FAIL');
        if (failed.length) process.exitCode = 1;
    },
};

const testName = process.argv[2] || 'all';
if (!tests[testName]) {
    console.log('Usage: node --env-file=.env test-opencode.js [test]');
    console.log('Tests:', Object.keys(tests).join(', '));
    process.exit(1);
}

await tests[testName]();
