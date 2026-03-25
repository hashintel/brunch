import { useState } from 'preact/hooks';
import { ImpactBadge } from './ImpactBadge';
import type { SpecQuestion, SpecAnswer } from './types';

interface Props {
    questions: SpecQuestion[];
    answers: SpecAnswer[];
    currentIndex: number;
    onAnswer: (index: number, answer: SpecAnswer) => void;
    onSkip: (index: number) => void;
    onNext: () => void;
    onBack: () => void;
    onSkipAll: () => void;
    answeredCount: number;
    remainingCount: number;
}

export function QuestionPanel({
    questions, answers, currentIndex,
    onAnswer, onSkip, onNext, onBack, onSkipAll,
    answeredCount, remainingCount,
}: Props) {
    const question = questions[currentIndex];

    const currentAnswer = question ? answers[currentIndex] : null;
    const [selected, setSelected] = useState<string[]>(currentAnswer?.selectedLabels ?? []);
    const [otherText, setOtherText] = useState(currentAnswer?.otherText ?? '');

    // Reset local state when question changes
    const [prevIndex, setPrevIndex] = useState(currentIndex);
    if (currentIndex !== prevIndex) {
        setPrevIndex(currentIndex);
        const ans = answers[currentIndex];
        setSelected(ans?.selectedLabels ?? []);
        setOtherText(ans?.otherText ?? '');
    }

    function toggleOption(label: string) {
        if (question.selectionType === 'single') {
            setSelected([label]);
        } else {
            setSelected(prev =>
                prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
            );
        }
    }

    function handleContinue() {
        onAnswer(currentIndex, { selectedLabels: selected, otherText, skipped: false });
        onNext();
    }

    const canContinue = selected.length > 0 || otherText.trim().length > 0;
    const allAnswered = questions.length > 0 && remainingCount === 0;
    const isLastQuestion = currentIndex === questions.length - 1;

    // No questions loaded yet — show placeholder
    if (questions.length === 0) {
        return (
            <div class="create-spec__question-panel">
                <div class="create-spec__question-panel-header">
                    <h2 class="create-spec__question-panel-title">Clarifying Questions</h2>
                    <p class="create-spec__question-panel-subtitle">Generating questions about your project...</p>
                </div>
                <div class="create-spec__question-placeholder">
                    <div class="create-spec__skeleton-line" style={{ width: '70%' }} />
                    <div class="create-spec__skeleton-line" style={{ width: '90%' }} />
                    <div class="create-spec__skeleton-line" style={{ width: '60%' }} />
                    <div class="create-spec__skeleton-line" style={{ width: '80%' }} />
                </div>
            </div>
        );
    }

    return (
        <div class="create-spec__question-panel">
            <div class="create-spec__question-panel-header">
                <h2 class="create-spec__question-panel-title">Clarifying Questions</h2>
                <p class="create-spec__question-panel-subtitle">Help us understand your project better</p>
            </div>

            <div class="create-spec__progress">
                <div class="create-spec__progress-bar-track">
                    <div
                        class="create-spec__progress-bar-fill"
                        style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                    />
                </div>
                <div class="create-spec__progress-info">
                    <span>Question {currentIndex + 1} / {questions.length}</span>
                    <span>{answeredCount} answered &middot; {remainingCount} remaining</span>
                </div>
            </div>

            {question && (
                <div class="create-spec__question-card">
                    <div class="create-spec__question-card-header">
                        <ImpactBadge impact={question.impact} />
                    </div>
                    <h3 class="create-spec__question-text">{question.question}</h3>

                    <div class="create-spec__options">
                        {question.options.map(opt => {
                            const isSelected = selected.includes(opt.label);
                            const inputType = question.selectionType === 'single' ? 'radio' : 'checkbox';
                            return (
                                <label key={opt.label} class={`create-spec__option ${isSelected ? 'create-spec__option--selected' : ''}`}>
                                    <input
                                        type={inputType}
                                        name={`q-${question.id}`}
                                        checked={isSelected}
                                        onChange={() => toggleOption(opt.label)}
                                    />
                                    <span class="create-spec__option-label">{opt.label}</span>
                                </label>
                            );
                        })}
                    </div>

                    <div class="create-spec__why-card">
                        <strong>Why this matters:</strong> {question.why}
                    </div>
                </div>
            )}

            {allAnswered ? (
                <div class="create-spec__question-actions">
                    <button
                        class="create-spec__btn create-spec__btn--secondary"
                        onClick={onBack}
                        disabled={currentIndex === 0}
                    >
                        Back
                    </button>
                    <button
                        class="create-spec__btn create-spec__btn--primary"
                        onClick={onSkipAll}
                    >
                        Continue to Assumptions
                    </button>
                </div>
            ) : (
                <>
                    <div class="create-spec__question-actions">
                        <button
                            class="create-spec__btn create-spec__btn--secondary"
                            onClick={onBack}
                            disabled={currentIndex === 0}
                        >
                            Back
                        </button>
                        {!isLastQuestion && (
                            <button
                                class="create-spec__btn create-spec__btn--ghost"
                                onClick={() => onSkip(currentIndex)}
                            >
                                Skip question
                            </button>
                        )}
                        {isLastQuestion ? (
                            <button
                                class="create-spec__btn create-spec__btn--primary"
                                onClick={() => {
                                    if (canContinue) onAnswer(currentIndex, { selectedLabels: selected, otherText, skipped: false });
                                    onSkipAll();
                                }}
                            >
                                {canContinue ? 'Finish & Continue' : 'Skip & Continue'}
                            </button>
                        ) : (
                            <button
                                class="create-spec__btn create-spec__btn--primary"
                                onClick={handleContinue}
                                disabled={!canContinue}
                            >
                                Continue
                            </button>
                        )}
                    </div>

                    <button class="create-spec__skip-all-btn" onClick={onSkipAll}>
                        Skip remaining &amp; continue to assumptions
                    </button>
                </>
            )}
        </div>
    );
}
