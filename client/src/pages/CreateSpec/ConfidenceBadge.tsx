interface Props {
    confidence: number;
}

export function ConfidenceBadge({ confidence }: Props) {
    const level = confidence >= 67 ? 'high' : confidence >= 34 ? 'medium' : 'low';
    const label = level === 'high' ? 'High Confidence' : level === 'medium' ? 'Medium Confidence' : 'Low Confidence';

    return (
        <span class={`create-spec__confidence-badge create-spec__confidence-badge--${level}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                {level === 'high' ? (
                    <path d="M6 1l1.5 3.2L11 4.6 8.5 7l.6 3.4L6 8.8 2.9 10.4l.6-3.4L1 4.6l3.5-.4z" fill="currentColor" />
                ) : (
                    <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.5" fill="none" />
                )}
            </svg>
            {label}
        </span>
    );
}
