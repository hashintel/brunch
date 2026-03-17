import { useMemo } from 'preact/hooks';
import { marked } from 'marked';

interface Props {
    summary: string;
    loading: boolean;
    onGenerate: () => void;
}

export function SummarySection({ summary, loading, onGenerate }: Props) {
    const html = useMemo(() => {
        if (!summary) return '';
        return marked.parse(summary, { async: false }) as string;
    }, [summary]);

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
                    <div class="summary-content" dangerouslySetInnerHTML={{ __html: html }} />
                </div>
            )}
        </>
    );
}
