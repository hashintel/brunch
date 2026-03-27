import { useState } from 'preact/hooks';
import { QuestionPanel } from './QuestionPanel';
import { SpecPreviewPanel } from './SpecPreviewPanel';
import type { SpecQuestion, SpecAnswer, StructuredSpec, SpecSection } from './types';

interface Props {
    questions: SpecQuestion[];
    answers: SpecAnswer[];
    currentIndex: number;
    answeredCount: number;
    remainingCount: number;
    onAnswer: (index: number, answer: SpecAnswer) => void;
    onSkip: (index: number) => void;
    onNext: () => void;
    onBack: () => void;
    onSkipAll: () => void;
    spec: StructuredSpec | null;
    specLoading: boolean;
    onUpdateSection: (index: number, updates: Partial<SpecSection>) => void;
    prompt?: string;
    onUpdatePrompt?: (newPrompt: string) => void;
    goalIterations?: Array<{ goalText: string }>;
}

export function ClarifyScreen({
    questions, answers, currentIndex,
    answeredCount, remainingCount,
    onAnswer, onSkip, onNext, onBack, onSkipAll,
    spec, specLoading, onUpdateSection,
    prompt, onUpdatePrompt, goalIterations,
}: Props) {
    const [editingGoal, setEditingGoal] = useState(false);
    const [goalDraft, setGoalDraft] = useState(prompt ?? '');
    const [showIterations, setShowIterations] = useState(false);

    function handleSaveGoal() {
        if (goalDraft.trim() && goalDraft !== prompt) {
            onUpdatePrompt?.(goalDraft.trim());
        }
        setEditingGoal(false);
    }

    return (
        <div class="create-spec__clarify">
            <div class="create-spec__clarify-left">
                {/* Goal section */}
                {prompt && (
                    <div class="cs-goal-section">
                        <div class="cs-goal-section__header">
                            <h3 class="cs-goal-section__title">Project Goal</h3>
                            {goalIterations && goalIterations.length > 1 && (
                                <button
                                    class="cs-goal-section__history-btn"
                                    onClick={() => setShowIterations(!showIterations)}
                                >
                                    {showIterations ? 'Hide' : 'Show'} history ({goalIterations.length})
                                </button>
                            )}
                        </div>

                        {showIterations && goalIterations && goalIterations.length > 1 && (
                            <div class="cs-goal-section__iterations">
                                {goalIterations.slice(0, -1).map((iter, i) => (
                                    <div key={i} class="cs-goal-section__iteration">
                                        <span class="cs-goal-section__iteration-label">v{i + 1}</span>
                                        <span class="cs-goal-section__iteration-text">{iter.goalText}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {editingGoal ? (
                            <div class="cs-goal-section__edit">
                                <textarea
                                    class="cs-goal-section__textarea"
                                    value={goalDraft}
                                    onInput={(e) => setGoalDraft((e.target as HTMLTextAreaElement).value)}
                                    rows={3}
                                    autoFocus
                                />
                                <div class="cs-goal-section__edit-actions">
                                    <button class="cs-goal-section__save-btn" onClick={handleSaveGoal}>Update Goal</button>
                                    <button class="cs-goal-section__cancel-btn" onClick={() => { setEditingGoal(false); setGoalDraft(prompt ?? ''); }}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div class="cs-goal-section__display" onClick={() => { setEditingGoal(true); setGoalDraft(prompt ?? ''); }}>
                                <p class="cs-goal-section__text">{prompt}</p>
                                <button class="cs-goal-section__edit-btn">Edit</button>
                            </div>
                        )}
                    </div>
                )}

                <QuestionPanel
                    questions={questions}
                    answers={answers}
                    currentIndex={currentIndex}
                    onAnswer={onAnswer}
                    onSkip={onSkip}
                    onNext={onNext}
                    onBack={onBack}
                    onSkipAll={onSkipAll}
                    answeredCount={answeredCount}
                    remainingCount={remainingCount}
                />
            </div>
            <SpecPreviewPanel
                spec={spec}
                loading={specLoading}
                onUpdateSection={onUpdateSection}
            />
        </div>
    );
}
