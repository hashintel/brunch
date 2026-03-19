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
