// Test raw SSE via fetch - bypass SDK
const BASE = process.env.OPENCODE_URL || "http://localhost:4096";

// First create a session
const sessionRes = await fetch(`${BASE}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
const session = await sessionRes.json();
console.log("session:", session.id);

// Subscribe to raw SSE
console.log("subscribing to /event ...");
const sseRes = await fetch(`${BASE}/event`);
const reader = sseRes.body.getReader();
const decoder = new TextDecoder();

// Fire async prompt
console.log("sending prompt...");
await fetch(`${BASE}/session/${session.id}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        model: { providerID: "opencode", modelID: "big-pickle" },
        parts: [{ type: "text", text: "Say hi" }],
    }),
});
console.log("prompt sent, reading SSE...");

const start = Date.now();
let buf = "";
let eventCount = 0;

setTimeout(() => {
    console.log(`\nTimeout. ${eventCount} SSE events in 15s.`);
    process.exit(0);
}, 15000);

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split("\n\n");
    buf = lines.pop();

    for (const block of lines) {
        if (!block.trim()) continue;
        const dataLine = block.split("\n").find(l => l.startsWith("data: "));
        if (!dataLine) continue;

        const data = JSON.parse(dataLine.slice(6));
        eventCount++;
        const type = data.type;
        const sid = data.properties?.sessionID ?? data.properties?.part?.sessionID ?? data.properties?.info?.sessionID;
        const ours = sid === session.id ? "<<< OURS" : "";

        if (["server.heartbeat", "lsp.client.diagnostics"].includes(type)) continue;
        console.log(`[${Date.now() - start}ms] ${type} ${ours}`);

        if (type === "session.idle" && sid === session.id) {
            console.log("Got session.idle!");
            process.exit(0);
        }
    }
}
