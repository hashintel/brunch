import { useState, useEffect } from 'preact/hooks';
import type { ClarifyingQuestion, ClarifyingAnswer } from './types';
import { LoadingIndicator } from '../../components/LoadingIndicator';

type Props = {
    questions: ClarifyingQuestion[];
    answers: ClarifyingAnswer[];
    onUpdateAnswer: (index: number, answer: ClarifyingAnswer) => void;
    onUpdateGoal: () => void;
    onGenerateRequirements: () => void;
    loading: boolean;
    updatingGoal: boolean;
    onChat?: (question: ClarifyingQuestion) => void;
};

function isAnswered(a: ClarifyingAnswer | undefined): boolean {
    if (!a) return false;
    return a.skipped || a.selectedLabels.length > 0 || a.otherText.length > 0;
}

export function ClarifyingQuestions({
    questions,
    answers,
    onUpdateAnswer,
    onUpdateGoal,
    onGenerateRequirements,
    loading,
    updatingGoal,
    onChat,
}: Props) {
    const [activeIndex, setActiveIndex] = useState(0);

    // Clamp active index when questions shrink (e.g. after Update Goal resets)
    useEffect(() => {
        if (questions.length > 0 && activeIndex >= questions.length) {
            setActiveIndex(questions.length - 1);
        }
        if (questions.length === 0) {
            setActiveIndex(0);
        }
    }, [questions.length]);

    if (questions.length === 0 && !loading) return null;

    const q = questions[activeIndex];
    const answer = answers[activeIndex] ?? { selectedLabels: [], otherText: '', skipped: false };
    const isIdk = answer.skipped;
    const answeredCount = answers.filter(isAnswered).length;
    const anyAnswered = answeredCount > 0;

    return (
        <div class="clarifying-questions">
            {loading && questions.length === 0 && (
                <LoadingIndicator message="Generating questions" />
            )}

            {questions.length > 0 && q && (
                <>
                    {/* Dot navigation + counter */}
                    <div class="clarifying-nav">
                        <div class="clarifying-dots">
                            {questions.map((_, i) => (
                                <button
                                    key={i}
                                    class={`clarifying-dot${i === activeIndex ? ' clarifying-dot--active' : ''}${isAnswered(answers[i]) ? ' clarifying-dot--answered' : ''}`}
                                    onClick={() => setActiveIndex(i)}
                                />
                            ))}
                        </div>
                        <span class="clarifying-counter">
                            {answeredCount}/{questions.length} answered
                        </span>
                    </div>

                    {/* Single question card */}
                    <div key={activeIndex} class="clarifying-card">
                        <div class="clarifying-card-question">
                            {q.question}
                            {onChat && (
                                <button
                                    class="clarifying-chat-btn"
                                    onClick={() => onChat(q)}
                                    title="Discuss with AI"
                                >
                                    &#128172;
                                </button>
                            )}
                        </div>
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
                                        const newSkipped = !isIdk;
                                        onUpdateAnswer(activeIndex, {
                                            selectedLabels: [],
                                            otherText: '',
                                            skipped: newSkipped,
                                        });
                                    }}
                                />
                                I don't know
                            </label>
                        </div>
                        <div class="clarifying-card-nav">
                            <button
                                class="button button-small button-secondary"
                                onClick={() => setActiveIndex(prev => prev - 1)}
                                disabled={activeIndex === 0}
                            >
                                Previous
                            </button>
                            <button
                                class="button button-small"
                                onClick={() => setActiveIndex(prev => prev + 1)}
                                disabled={activeIndex >= questions.length - 1}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Action buttons — always visible once we have questions */}
            {(questions.length > 0 || loading) && (
                <div class="clarifying-actions">
                    <button
                        class="button"
                        onClick={onUpdateGoal}
                        disabled={!anyAnswered || loading || updatingGoal}
                    >
                        {updatingGoal ? 'Updating Goal\u2026' : 'Update Goal'}
                    </button>
                    <button
                        class="button button-secondary"
                        onClick={onGenerateRequirements}
                        disabled={loading || updatingGoal}
                    >
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
