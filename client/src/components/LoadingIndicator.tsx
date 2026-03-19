type Props = {
    message?: string;
    toolStatus?: { tool: string } | null;
};

const TOOL_LABELS: Record<string, string> = {
    Read: 'Reading files',
    Glob: 'Searching files',
    Grep: 'Searching code',
};

export function LoadingIndicator({ message, toolStatus }: Props) {
    const toolLabel = toolStatus ? (TOOL_LABELS[toolStatus.tool] ?? `Running ${toolStatus.tool}`) : null;
    const displayMessage = toolLabel ?? message ?? 'Thinking';

    return (
        <div class="loading-indicator">
            <span class="loading-dot" />
            <span class="loading-message">{displayMessage}...</span>
        </div>
    );
}
