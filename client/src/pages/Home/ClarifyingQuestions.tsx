import type { ClarifyingQuestion, ClarifyingAnswer, ClarifyingRound } from './types';

type Props = {
    currentQuestions: ClarifyingQuestion[];
    currentAnswers: ClarifyingAnswer[];
    onUpdateAnswer: (index: number, answer: ClarifyingAnswer) => void;
    previousRounds: ClarifyingRound[];
    onSubmitAnswers: () => void;
    onSkipAll: () => void;
    loading: boolean;
};

export function ClarifyingQuestions({
    currentQuestions,
    currentAnswers,
    onUpdateAnswer,
    previousRounds,
    onSubmitAnswers,
    onSkipAll,
    loading,
}: Props) {
    return (
        <div class="clarifying-questions">
            {previousRounds.map((round, ri) => (
                <div key={ri} class="clarifying-round-summary">
                    <h4>Round {ri + 1}</h4>
                    {round.questions.map((q, qi) => {
                        const ans = round.answers[qi];
                        let answerText = 'Skipped';
                        if (ans && !ans.skipped) {
                            const parts: string[] = [];
                            if (ans.selectedLabels.length) parts.push(ans.selectedLabels.join(', '));
                            if (ans.otherText) parts.push(`Other: ${ans.otherText}`);
                            answerText = parts.length ? parts.join(' — ') : 'Skipped';
                        }
                        return (
                            <div key={qi} class="clarifying-round-qa">
                                <div class="clarifying-round-q">{q.question}</div>
                                <div class="clarifying-round-a">{answerText}</div>
                            </div>
                        );
                    })}
                </div>
            ))}

            {currentQuestions.map((q, qi) => {
                const answer = currentAnswers[qi] ?? { selectedLabels: [], otherText: '', skipped: false };
                const isIdk = answer.skipped;

                return (
                    <div key={qi} class="clarifying-card">
                        <div class="clarifying-card-question">{q.question}</div>
                        <div class="clarifying-card-why">{q.why}</div>
                        <div class="clarifying-options">
                            {q.options.map((opt) => {
                                const selected = answer.selectedLabels.includes(opt.label);
                                return (
                                    <label
                                        key={opt.label}
                                        class={`clarifying-option${selected ? ' clarifying-option--selected' : ''}${isIdk ? ' clarifying-option--disabled' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            disabled={isIdk}
                                            onChange={() => {
                                                const labels = selected
                                                    ? answer.selectedLabels.filter(l => l !== opt.label)
                                                    : [...answer.selectedLabels, opt.label];
                                                onUpdateAnswer(qi, { ...answer, selectedLabels: labels, skipped: false });
                                            }}
                                        />
                                        {opt.label}
                                    </label>
                                );
                            })}

                            {/* Other option */}
                            <label class={`clarifying-option${answer.otherText ? ' clarifying-option--selected' : ''}${isIdk ? ' clarifying-option--disabled' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={answer.otherText.length > 0}
                                    disabled={isIdk}
                                    onChange={() => {
                                        if (answer.otherText) {
                                            onUpdateAnswer(qi, { ...answer, otherText: '' });
                                        }
                                    }}
                                />
                                Other:
                                <input
                                    type="text"
                                    class="clarifying-other-input"
                                    value={answer.otherText}
                                    disabled={isIdk}
                                    placeholder="Type your answer..."
                                    onInput={(e) => {
                                        onUpdateAnswer(qi, { ...answer, otherText: (e.target as HTMLInputElement).value, skipped: false });
                                    }}
                                />
                            </label>

                            {/* I don't know */}
                            <label class={`clarifying-option clarifying-option--idk${isIdk ? ' clarifying-option--selected' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={isIdk}
                                    onChange={() => {
                                        onUpdateAnswer(qi, {
                                            selectedLabels: [],
                                            otherText: '',
                                            skipped: !isIdk,
                                        });
                                    }}
                                />
                                I don't know
                            </label>
                        </div>
                    </div>
                );
            })}

            {currentQuestions.length > 0 && (
                <div class="clarifying-actions">
                    <button class="button" onClick={onSubmitAnswers} disabled={loading}>
                        {loading ? 'Processing\u2026' : 'Submit Answers'}
                    </button>
                    <button class="clarifying-skip" onClick={onSkipAll} disabled={loading}>
                        Skip All
                    </button>
                </div>
            )}
        </div>
    );
}
