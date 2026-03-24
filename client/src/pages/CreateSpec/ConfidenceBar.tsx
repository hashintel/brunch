interface Props {
    confidence: number;
    message?: string;
}

export function ConfidenceBar({ confidence, message }: Props) {
    const level = confidence >= 67 ? 'high' : confidence >= 34 ? 'medium' : 'low';
    const defaultMessage = level === 'high'
        ? 'Spec is well-defined'
        : level === 'medium'
            ? 'Answer more questions to improve confidence'
            : 'More information needed';

    return (
        <div class="create-spec__confidence-bar">
            <div class="create-spec__confidence-bar-header">
                <span class="create-spec__confidence-bar-label">Spec Confidence</span>
                <span class="create-spec__confidence-bar-value">{Math.round(confidence)}%</span>
            </div>
            <div class="create-spec__confidence-bar-track">
                <div
                    class={`create-spec__confidence-bar-fill create-spec__confidence-bar-fill--${level}`}
                    style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                />
            </div>
            <p class="create-spec__confidence-bar-message">{message || defaultMessage}</p>
        </div>
    );
}
