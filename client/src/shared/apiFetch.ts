export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error: ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
}

export async function apiFetchStream(url: string, options?: RequestInit): Promise<ReadableStream<Uint8Array>> {
    const res = await fetch(url, options);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error: ${res.status}`);
    }
    return res.body!;
}

export type NDJSONEvent =
    | { type: 'text'; text: string }
    | { type: 'thinking_start' }
    | { type: 'thinking_end' }
    | { type: 'tool_start'; tool: string }
    | { type: 'tool_end'; tool: string }
    | { type: 'tool_use'; tool: string; input: Record<string, unknown>; createdId?: string }
    | { type: 'done' };

export async function* streamNDJSON(stream: ReadableStream<Uint8Array>): AsyncGenerator<NDJSONEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            // Keep the last (possibly incomplete) line in the buffer
            buffer = lines.pop()!;

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    yield JSON.parse(trimmed) as NDJSONEvent;
                } catch {
                    // skip malformed lines
                }
            }
        }
        // Process any remaining buffer
        if (buffer.trim()) {
            try {
                yield JSON.parse(buffer.trim()) as NDJSONEvent;
            } catch {
                // skip
            }
        }
    } finally {
        reader.releaseLock();
    }
}
