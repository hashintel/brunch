import type { FocusedItem } from './types';

interface Props {
    item: FocusedItem;
    variant?: 'banner' | 'inline';
}

export function FocusedItemCard({ item, variant = 'banner' }: Props) {
    const className = variant === 'banner' ? 'assistant-focused-card' : 'assistant-update-card';

    if (item.type === 'assumption') {
        const a = item.item;
        return (
            <div class={className}>
                <div class="assistant-card-header">
                    <span class="assistant-card-type">Assumption</span>
                    <span class={`assumption-badge assumption-badge--${a.confidence}`}>{a.confidence}</span>
                    <span class={`assumption-badge assumption-badge--${a.impact}`}>{a.impact}</span>
                    <span class={`assumption-status assumption-status--${a.status}`}>{a.status}</span>
                </div>
                <div class="assistant-card-body">{a.editedText || a.text}</div>
            </div>
        );
    }

    if (item.type === 'requirement') {
        const r = item.item;
        return (
            <div class={className}>
                <div class="assistant-card-header">
                    <span class="assistant-card-type">Requirement</span>
                    <span class={`requirement-stage requirement-stage--${r.stage}`}>{r.stage}</span>
                    <span class="assistant-card-confidence">{Math.round(r.confidence * 100)}%</span>
                </div>
                <div class="assistant-card-title">{r.title}</div>
                <div class="assistant-card-body">
                    {r.definition.length > 120 ? r.definition.slice(0, 120) + '\u2026' : r.definition}
                </div>
            </div>
        );
    }

    if (item.type === 'clarifying_question') {
        const q = item.item;
        return (
            <div class={className}>
                <div class="assistant-card-header">
                    <span class="assistant-card-type">Question</span>
                </div>
                <div class="assistant-card-title">{q.question}</div>
                <div class="assistant-card-body">{q.why}</div>
                {q.options.length > 0 && (
                    <div class="assistant-card-options">
                        {q.options.map(o => (
                            <span key={o.label} class="assistant-card-option">{o.label}</span>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return null;
}
