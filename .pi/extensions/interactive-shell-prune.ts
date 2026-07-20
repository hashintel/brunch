/**
 * Context pruning for pi-interactive-shell output.
 *
 * Owns: collapsing superseded interactive-shell screen reads before each LLM call.
 * Input: the `context` event message list (deep copy, safe to mutate).
 * Output: same list with older per-session shell output stubbed to one line.
 *
 * Why: driving a TUI target through interactive_shell produces many rendered-
 * viewport reads (tool results from queries, custom "interactive-shell-update"
 * push messages). Each read supersedes the previous one for the same session,
 * but by default they all stay in context verbatim. This hook keeps the most
 * recent reads per session at full fidelity and replaces older ones with a
 * short stub. Messages are stubbed in place, never removed, so assistant
 * toolCall/toolResult pairing stays intact.
 *
 * Pruning only touches this extension's message shapes; transfers
 * ("interactive-shell-transfer") carry final session output and are never
 * pruned. Session history on disk is untouched — this rewrites the outgoing
 * LLM context only.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Full-fidelity reads kept per session (most recent first). */
const KEEP_RECENT_PER_SESSION = 2;
/** Don't bother stubbing content already smaller than the stub itself. */
const MIN_PRUNE_CHARS = 240;

const PRUNABLE_CUSTOM_TYPES = new Set([
	"interactive-shell-update",
	// emitted by the sibling interactive-shell-push.ts forwarder
	"interactive-shell-quiet-update",
]);
const SHELL_TOOL_NAME = "interactive_shell";

interface PrunableRef {
	sessionId: string;
	stub: (note: string) => void;
	contentChars: number;
}

function contentLength(content: unknown): number {
	if (typeof content === "string") return content.length;
	if (!Array.isArray(content)) return 0;
	let total = 0;
	for (const block of content) {
		if (block && typeof block === "object" && "text" in block && typeof block.text === "string") {
			total += block.text.length;
		}
	}
	return total;
}

function sessionIdFromDetails(details: unknown): string {
	if (details && typeof details === "object" && "sessionId" in details && typeof details.sessionId === "string") {
		return details.sessionId;
	}
	return "unknown-session";
}

function collectPrunable(messages: unknown[]): PrunableRef[] {
	const refs: PrunableRef[] = [];
	for (const message of messages) {
		if (!message || typeof message !== "object") continue;
		const record = message as {
			role?: string;
			customType?: string;
			toolName?: string;
			isError?: boolean;
			details?: unknown;
			content?: unknown;
		};

		const isShellUpdate = record.role === "custom"
			&& typeof record.customType === "string"
			&& PRUNABLE_CUSTOM_TYPES.has(record.customType);
		const isShellRead = record.role === "toolResult"
			&& record.toolName === SHELL_TOOL_NAME
			&& record.isError !== true;
		if (!isShellUpdate && !isShellRead) continue;

		refs.push({
			sessionId: sessionIdFromDetails(record.details),
			contentChars: contentLength(record.content),
			stub: (note) => {
				if (record.role === "toolResult") {
					record.content = [{ type: "text", text: note }];
				} else {
					record.content = note;
				}
			},
		});
	}
	return refs;
}

export default function (pi: ExtensionAPI) {
	pi.on("context", (event) => {
		const refs = collectPrunable(event.messages as unknown[]);
		if (refs.length === 0) return undefined;

		// Newest-last order matches message order; count survivors per session
		// from the end so the most recent reads stay verbatim.
		const seenPerSession = new Map<string, number>();
		let pruned = 0;
		for (let i = refs.length - 1; i >= 0; i--) {
			const ref = refs[i];
			if (!ref) continue;
			const seen = seenPerSession.get(ref.sessionId) ?? 0;
			seenPerSession.set(ref.sessionId, seen + 1);
			if (seen < KEEP_RECENT_PER_SESSION) continue;
			if (ref.contentChars < MIN_PRUNE_CHARS) continue;
			ref.stub(
				`[interactive-shell output pruned: superseded by ${seen} later read(s) of session ${ref.sessionId}; ~${ref.contentChars} chars removed from context]`,
			);
			pruned++;
		}

		return pruned > 0 ? { messages: event.messages } : undefined;
	});
}
