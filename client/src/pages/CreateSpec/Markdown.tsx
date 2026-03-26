import { useMemo } from 'preact/hooks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
    breaks: false,
    gfm: true,
});

interface Props {
    content: string;
    class?: string;
}

export function Markdown({ content, class: className }: Props) {
    const html = useMemo(() => {
        if (!content) return '';
        const raw = marked.parse(content, { async: false }) as string;
        return DOMPurify.sanitize(raw);
    }, [content]);

    return (
        <div
            class={`cs-markdown ${className ?? ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
