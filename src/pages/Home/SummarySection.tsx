interface Props {
    summary: string;
    loading: boolean;
    onGenerate: () => void;
}

export function SummarySection({ summary, loading, onGenerate }: Props) {
    return (
        <>
            <button
                class="button"
                onClick={onGenerate}
                disabled={loading}
            >
                {loading ? 'Generating\u2026' : 'Generate Summary'}
            </button>
            {summary && (
                <div class="summary">
                    <strong>Roadmap Summary</strong>
                    <div class="summary-content">{summary}</div>
                </div>
            )}
        </>
    );
}
