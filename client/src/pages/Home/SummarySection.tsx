import { useMemo } from 'preact/hooks';
import { marked } from 'marked';

interface Props {
    summary: string;
}

export function SummarySection({ summary }: Props) {
    const html = useMemo(() => {
        if (!summary) return '';
        return marked.parse(summary, { async: false }) as string;
    }, [summary]);

    return (
        <div class="summary">
            <strong>Roadmap Summary</strong>
            <div class="summary-content" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
}
