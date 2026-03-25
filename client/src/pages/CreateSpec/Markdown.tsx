import { useMemo } from 'preact/hooks';
import { marked } from 'marked';

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
        return marked.parse(content, { async: false }) as string;
    }, [content]);

    return (
        <div
            class={`cs-markdown ${className ?? ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
