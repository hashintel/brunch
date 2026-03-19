interface AssistantTriggerProps {
    isOpen: boolean;
    onToggle: () => void;
    onOpenWithContext: (ctx: { selectedText?: string; elementType?: string }) => void;
}

export function AssistantTrigger({ isOpen, onToggle, onOpenWithContext }: AssistantTriggerProps) {
    if (isOpen) return null;

    function handleClick() {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText) {
            onOpenWithContext({ selectedText });
            selection?.removeAllRanges();
        } else {
            onToggle();
        }
    }

    return (
        <button
            class="assistant-trigger"
            onClick={handleClick}
            title="AI Assistant"
        >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        </button>
    );
}
