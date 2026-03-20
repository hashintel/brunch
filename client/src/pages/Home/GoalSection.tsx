import type { useGoal } from './useGoal';
import type { useClarifying } from './useClarifying';
import type { ClarifyingQuestion } from './types';
import { ClarifyingQuestions } from './ClarifyingQuestions';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { formatAnswer } from './utils';

const GOAL_SUGGESTIONS = [
    'Build a todo list app',
    'Build a weather app',
    'Build a chat application',
    'Build a blog platform',
];

type Props = {
    goal: ReturnType<typeof useGoal>;
    clarifying: ReturnType<typeof useClarifying>;
    ui: { openSections: Set<number>; toggleSection: (i: number) => void };
    showInvalidGoalSuggestions: boolean;
    onDismissInvalidSuggestions: () => void;
    onUpdateGoal: () => void;
    onOpenAssistantHelp: () => void;
    onChatQuestion: (q: ClarifyingQuestion) => void;
    isCheckedOut: boolean;
    anyBusy: boolean;
};

export function GoalSection({
    goal, clarifying, ui, showInvalidGoalSuggestions,
    onDismissInvalidSuggestions, onUpdateGoal, onOpenAssistantHelp,
    onChatQuestion, isCheckedOut, anyBusy,
}: Props) {
    return (
        <div class="collapsible">
            <button class="collapsible-header" onClick={() => ui.toggleSection(0)}>
                <span class="collapsible-title">Goal</span>
                {clarifying.goalIterations.length > 0 && (
                    <span class="collapsible-badge">{clarifying.goalIterations.length} revision{clarifying.goalIterations.length !== 1 ? 's' : ''}</span>
                )}
                <span class={`collapsible-chevron ${ui.openSections.has(0) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
            </button>
            <div class={`collapsible-body ${ui.openSections.has(0) ? 'collapsible-body--open' : ''}`}>
                <div class="collapsible-content">
                    {/* Previous iterations (read-only) */}
                    {clarifying.goalIterations.map((iter, i) => (
                        <div key={i} class="goal-iteration">
                            {iter.goalText && (
                                <textarea
                                    class="textarea textarea--readonly"
                                    value={iter.goalText}
                                    readOnly
                                />
                            )}
                            {iter.questions.length > 0 && (
                                <div class="clarifying-round-summary">
                                    <h4>Clarification Round {i + 1}</h4>
                                    {iter.questions.map((q, qi) => (
                                        <div key={qi} class="clarifying-round-qa">
                                            <div class="clarifying-round-q">{q.question}</div>
                                            <div class="clarifying-round-a">{formatAnswer(iter.answers[qi])}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Current goal textarea */}
                    <textarea
                        ref={goal.goalTextareaRef}
                        class="textarea"
                        value={goal.prompt}
                        onInput={e => { goal.setPrompt(e.currentTarget.value); onDismissInvalidSuggestions(); }}
                        placeholder="Describe your goal. What do you want to build?"
                        disabled={isCheckedOut || goal.loading || goal.updatingGoal || goal.generatingDetailedGoal}
                    />

                    {/* Tool status during goal generation */}
                    {(goal.loading || goal.updatingGoal || goal.generatingDetailedGoal) && (
                        <LoadingIndicator
                            message={goal.generatingDetailedGoal ? 'Generating detailed goal' : goal.updatingGoal ? 'Updating goal' : 'Checking goal'}
                            toolStatus={goal.toolStatus}
                        />
                    )}

                    {/* Invalid goal suggestions */}
                    {showInvalidGoalSuggestions && (
                        <div class="invalid-goal-suggestions">
                            <p class="invalid-goal-message">Your prompt needs more detail to start the spec process. Try one of these:</p>
                            <div class="invalid-goal-buttons">
                                {GOAL_SUGGESTIONS.map(suggestion => (
                                    <button
                                        key={suggestion}
                                        class="invalid-goal-suggestion"
                                        onClick={() => { goal.setPrompt(suggestion); onDismissInvalidSuggestions(); }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                            <button
                                class="button button--secondary"
                                onClick={onOpenAssistantHelp}
                            >
                                Open Assistant
                            </button>
                        </div>
                    )}

                    {/* Loading indicator for initial clarifying questions fetch */}
                    {clarifying.loadingQuestions && clarifying.allQuestions.length === 0 && !goal.loading && !goal.generatingDetailedGoal && (
                        <LoadingIndicator message="Analyzing goal" toolStatus={null} />
                    )}

                    {/* Clarifying questions (after questions received, before done) */}
                    {clarifying.allQuestions.length > 0 && !clarifying.clarifyingDone && (
                        <ClarifyingQuestions
                            questions={clarifying.allQuestions}
                            answers={clarifying.allAnswers}
                            onUpdateAnswer={clarifying.updateAnswer}
                            onUpdateGoal={onUpdateGoal}
                            onGenerateRequirements={clarifying.done}
                            loading={clarifying.loadingQuestions}
                            updatingGoal={goal.updatingGoal}
                            onChat={onChatQuestion}
                        />
                    )}

                    {/* Done message */}
                    {clarifying.clarifyingDone && (
                        <div class="clarifying-done-message">
                            Clarification complete — proceed to review assumptions.
                        </div>
                    )}

                    {/* Initial generate button (only before clarifying questions or goal generated) */}
                    {!goal.response && clarifying.allQuestions.length === 0 && !clarifying.loadingQuestions && (
                        <button class="button" onClick={goal.go} disabled={isCheckedOut || anyBusy || !goal.prompt.trim()}>
                            {goal.loading ? 'Generating\u2026' : 'Generate'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
