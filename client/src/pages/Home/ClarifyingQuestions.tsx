import { useState, useEffect } from 'preact/hooks';
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

function isAnswered(answer: ClarifyingAnswer | undefined): boolean {
    if (!answer) return false;
    return answer.skipped || answer.selectedLabels.length > 0 || answer.otherText.length > 0;
}

export function ClarifyingQuestions({
    currentQuestions,
    currentAnswers,
    onUpdateAnswer,
    previousRounds,
    onSubmitAnswers,
    onSkipAll,
    loading,
}: Props) {
    const [activeIndex, setActiveIndex] = useState(0);

    // Reset to first question when a new set of questions arrives
    useEffect(() => {
        setActiveIndex(0);
    }, [currentQuestions]);

    // Auto-advance when current question gets answered
    useEffect(() => {
        if (currentQuestions.length === 0) return;
        const answer = currentAnswers[activeIndex];
        if (isAnswered(answer) && activeIndex < currentQuestions.length - 1) {
            const timer = setTimeout(() => setActiveIndex(prev => prev + 1), 400);
            return () => clearTimeout(timer);
        }
    }, [currentAnswers, activeIndex, currentQuestions.length]);

    if (currentQuestions.length === 0 && previousRounds.length === 0) return null;

    const q = currentQuestions[activeIndex];
    const answer = currentAnswers[activeIndex] ?? { selectedLabels: [], otherText: '', skipped: false };
    const isIdk = answer.skipped;
    const answeredCount = currentAnswers.filter(isAnswered).length;

    return (
        <div class="clarifying-questions">
            {/* Previous rounds as compact pills */}
            {previousRounds.map((round, ri) => (
                <div key={ri} class="clarifying-round-summary">
                    <h4>Round {ri + 1}</h4>
                    {round.questions.map((rq, qi) => {
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
                                <div class="clarifying-round-q">{rq.question}</div>
                                <div class="clarifying-round-a">{answerText}</div>
                            </div>
                        );
                    })}
                </div>
            ))}

            {currentQuestions.length > 0 && q && (
                <>
                    {/* Horizontal dots + counter */}
                    <div class="clarifying-nav">
                        <div class="clarifying-dots">
                            {currentQuestions.map((_, i) => (
                                <button
                                    key={i}
                                    class={`clarifying-dot${i === activeIndex ? ' clarifying-dot--active' : ''}${isAnswered(currentAnswers[i]) ? ' clarifying-dot--answered' : ''}`}
                                    onClick={() => setActiveIndex(i)}
                                />
                            ))}
                        </div>
                        <span class="clarifying-counter">
                            {answeredCount}/{currentQuestions.length} answered
                        </span>
                    </div>

                    {/* Single question card */}
                    <div key={activeIndex} class="clarifying-card">
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
                                                onUpdateAnswer(activeIndex, { ...answer, selectedLabels: labels, skipped: false });
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
                                            onUpdateAnswer(activeIndex, { ...answer, otherText: '' });
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
                                        onUpdateAnswer(activeIndex, { ...answer, otherText: (e.target as HTMLInputElement).value, skipped: false });
                                    }}
                                />
                            </label>

                            {/* I don't know */}
                            <label class={`clarifying-option clarifying-option--idk${isIdk ? ' clarifying-option--selected' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={isIdk}
                                    onChange={() => {
                                        onUpdateAnswer(activeIndex, {
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

                    {/* Action buttons */}
                    <div class="clarifying-actions">
                        <button class="button" onClick={onSubmitAnswers} disabled={loading}>
                            {loading ? 'Regenerating\u2026' : 'Regenerate'}
                        </button>
                        <button class="button button-secondary" onClick={onSkipAll} disabled={loading}>
                            Continue
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
