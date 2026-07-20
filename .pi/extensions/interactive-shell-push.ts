/**
 * Push-forwarder for pi-interactive-shell quiet updates.
 *
 * Owns: delivering hands-free "running" updates (new output after a quiet
 * period) into LLM context as turn-triggering messages.
 * Input: `interactive-shell:update` events on the shared extension bus.
 * Output: `interactive-shell-quiet-update` custom messages.
 *
 * Why: in non-blocking hands-free mode the stock pi-interactive-shell handler
 * drops `status: "running"` updates before sending context messages
 * (notification-utils.ts buildHandsFreeUpdateMessage returns null), so the
 * agent only hears about session exit/kill/takeover — never about new rendered
 * output. That forces the agent back onto pull-based status queries and their
 * rate-limit floor. The extension does emit every update on `pi.events`
 * before filtering; this forwarder turns the quiet ones into real messages so
 * the agent can send input, end its turn, and be woken by the target's
 * response. `interactive-shell-prune.ts` prunes superseded copies of these
 * messages from context.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface ShellUpdate {
	status: string;
	sessionId: string;
	runtime: number;
	tail: string[];
	tailTruncated: boolean;
	budgetExhausted?: boolean;
}

function isShellUpdate(data: unknown): data is ShellUpdate {
	if (!data || typeof data !== "object") return false;
	const record = data as Record<string, unknown>;
	return typeof record.status === "string"
		&& typeof record.sessionId === "string"
		&& Array.isArray(record.tail);
}

function formatRuntime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export default function (pi: ExtensionAPI) {
	pi.events.on("interactive-shell:update", (data: unknown) => {
		if (!isShellUpdate(data)) return;
		// Lifecycle statuses (exited/killed/user-takeover/agent-resumed) are
		// already delivered by the stock handler; forward only the quiet
		// "running" updates that carry new rendered output.
		if (data.status !== "running" || data.tail.length === 0) return;

		const truncatedNote = data.tailTruncated ? " (truncated)" : "";
		const budgetNote = data.budgetExhausted ? " [update budget exhausted]" : "";
		pi.sendMessage({
			customType: "interactive-shell-quiet-update",
			content: `Session ${data.sessionId} new output after quiet (${formatRuntime(data.runtime)})${truncatedNote}${budgetNote}:\n\n${data.tail.join("\n")}`,
			display: true,
			details: { sessionId: data.sessionId, runtime: data.runtime, tailTruncated: data.tailTruncated, budgetExhausted: data.budgetExhausted },
		}, { triggerTurn: true });
	});
}
