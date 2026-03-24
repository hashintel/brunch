interface Props {
    lines?: number;
}

export function SkeletonLoader({ lines = 3 }: Props) {
    return (
        <div class="create-spec__skeleton">
            {Array.from({ length: lines }, (_, i) => (
                <div
                    key={i}
                    class="create-spec__skeleton-line"
                    style={{ width: `${70 + Math.random() * 30}%` }}
                />
            ))}
        </div>
    );
}
