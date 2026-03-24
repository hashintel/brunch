import { useState } from 'preact/hooks';

interface Props {
    onSubmit: (text: string) => void;
}

export function LandingScreen({ onSubmit }: Props) {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function handleSubmit(e: Event) {
        e.preventDefault();
        if (!text.trim() || submitting) return;
        setSubmitting(true);
        onSubmit(text.trim());
    }

    return (
        <div class="create-spec__landing">
            <div class="create-spec__landing-illustration">
                <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
                    <rect x="10" y="10" width="100" height="60" rx="8" fill="#e8f0fe" stroke="#2070e6" stroke-width="1.5" />
                    <rect x="22" y="24" width="50" height="4" rx="2" fill="#2070e6" opacity="0.5" />
                    <rect x="22" y="34" width="70" height="4" rx="2" fill="#2070e6" opacity="0.3" />
                    <rect x="22" y="44" width="40" height="4" rx="2" fill="#2070e6" opacity="0.2" />
                    <circle cx="95" cy="55" r="10" fill="#2070e6" opacity="0.15" />
                    <path d="M92 55l3 3 6-6" stroke="#2070e6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>

            <h1 class="create-spec__landing-title">Create a Project Spec</h1>
            <p class="create-spec__landing-subtitle">
                Describe your project idea and we'll guide you through clarifying questions to build a comprehensive specification.
            </p>

            <form class="create-spec__landing-form" onSubmit={handleSubmit}>
                <textarea
                    class="create-spec__landing-textarea"
                    placeholder="Describe your project idea..."
                    value={text}
                    onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
                    rows={5}
                    autoFocus
                />
                <button
                    type="submit"
                    class={`create-spec__btn create-spec__btn--primary create-spec__btn--large ${submitting ? 'create-spec__btn--loading' : ''}`}
                    disabled={!text.trim() || submitting}
                >
                    {submitting ? 'Thinking...' : 'Generate Spec'}
                </button>
            </form>
        </div>
    );
}
