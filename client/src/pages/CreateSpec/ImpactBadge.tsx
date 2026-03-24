interface Props {
    impact: 'high' | 'medium' | 'low';
}

export function ImpactBadge({ impact }: Props) {
    return (
        <span class={`create-spec__impact-badge create-spec__impact-badge--${impact}`}>
            {impact === 'high' ? 'High Impact' : impact === 'medium' ? 'Medium Impact' : 'Low Impact'}
        </span>
    );
}
