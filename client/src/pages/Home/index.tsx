import './style.css';
import { useEffect, useState } from 'preact/hooks';
import type { Model } from './types';
import { RequirementList } from './RequirementList';
import { SessionPanel } from './SessionPanel';
import { ClarifyingQuestions } from './ClarifyingQuestions';
import { AssumptionReview } from './AssumptionReview';
import { buildPreviousRounds, formatAnswer } from './utils';
import { useSession } from './useSession';
import { useGoal } from './useGoal';
import { useClarifying } from './useClarifying';
import { useAssumptions } from './useAssumptions';
import { useRequirements } from './useRequirements';
import { useElicitation } from './useElicitation';

const STEPS = ['Goal', 'Assumptions', 'Requirements'] as const;

export function Home() {
    const [error, setError] = useState('');
    const [projectName, setProjectName] = useState('');
    const [cwd, setCwd] = useState('');
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [models, setModels] = useState<Model[]>([]);

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
    }, []);

    const session = useSession({ onError: setError });

    const goal = useGoal({
        selectedModel,
        cwd,
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
        onGoalReady: (goalText, iterations, questions, answers) => {
            clarifying.fetchQuestions(goalText, iterations, questions, answers);
        },
    });

    const clarifying = useClarifying({
        selectedModel,
        cwd,
        response: goal.response,
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
        onClarifyingDone: (iterations, questions, answers) => {
            const rounds = buildPreviousRounds(iterations, questions, answers);
            assumptions.generate(rounds);
        },
    });

    const assumptions = useAssumptions({
        selectedModel,
        cwd,
        response: goal.response,
        clarifyingDone: clarifying.clarifyingDone,
        assumptionsDone: false, // initial; useAssumptions tracks its own done state
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
    });

    const req = useRequirements({
        selectedModel,
        cwd,
        response: goal.response,
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
    });

    const ui = useElicitation({
        response: goal.response,
        clarifyingDone: clarifying.clarifyingDone,
        assumptionsDone: assumptions.assumptionsDone,
        requirementsCount: req.requirements.length,
    });

    async function handleUpdateGoal() {
        const result = await goal.updateGoal(
            clarifying.goalIterations,
            clarifying.allQuestions,
            clarifying.allAnswers,
        );
        if (result) {
            clarifying.resetForNewRound(result.newIterations);
            await clarifying.fetchQuestions(result.goalText, result.newIterations, [], []);
        }
    }

    function handleSave() {
        session.save({
            prompt: goal.prompt,
            cwd,
            response: goal.response,
            selectedModel,
            goalIterations: clarifying.goalIterations,
            allQuestions: clarifying.allQuestions,
            allAnswers: clarifying.allAnswers,
            questionsExhausted: clarifying.questionsExhausted,
            clarifyingDone: clarifying.clarifyingDone,
            assumptions: assumptions.assumptions,
            assumptionsDone: assumptions.assumptionsDone,
            requirements: req.requirements,
        });
    }

    async function handleLoadSession(id: string) {
        const data = await session.load(id);
        if (!data) return;
        goal.restore(data);
        clarifying.restore(data);
        assumptions.restore(data);
        req.restore(data);
        setCwd(data.cwd);
        setSelectedModel(data.selectedModel);
    }

    function handleNewSession() {
        goal.reset();
        clarifying.reset();
        assumptions.reset();
        req.reset();
        setError('');
        setProjectName('');
        setCwd('');
        session.setCurrentSessionId(null);
    }

    function handleGenerateRequirements() {
        req.generate(
            clarifying.goalIterations,
            clarifying.allQuestions,
            clarifying.allAnswers,
            assumptions.assumptions,
        );
    }

    const anyBusy = goal.loading || goal.updatingGoal || clarifying.loadingQuestions;

    return (
        <div class="home-layout">
            <aside class="sidebar">
                <SessionPanel
                    sessions={session.sessions}
                    currentSessionId={session.currentSessionId}
                    onLoad={handleLoadSession}
                    onDelete={session.deleteSession}
                    onNew={handleNewSession}
                    onSave={handleSave}
                    saving={session.saving}
                    projectName={projectName}
                    onProjectNameChange={setProjectName}
                    cwd={cwd}
                    onCwdChange={setCwd}
                    models={models}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    callHistory={session.callHistory}
                    disabled={goal.loading}
                />
            </aside>
            <div class="home">
                {/* Progress Stepper */}
                <div class="stepper">
                    {STEPS.map((label, i) => (
                        <div key={label} class="stepper-step">
                            {i > 0 && (
                                <div class={`stepper-line ${ui.stepCompleted[i - 1] ? 'stepper-line--filled' : ''}`} />
                            )}
                            <div class={`stepper-circle ${ui.stepCompleted[i] ? 'stepper-circle--completed' : ui.stepActive[i] ? 'stepper-circle--active' : ''}`}>
                                {i + 1}
                            </div>
                            <span class={`stepper-label ${ui.stepActive[i] ? 'stepper-label--active' : ''}`}>{label}</span>
                        </div>
                    ))}
                </div>

                {error && <div class="error">{error}</div>}

                {/* Section 0: Goal + Clarifying Questions */}
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
                                onInput={e => goal.setPrompt(e.currentTarget.value)}
                                placeholder="Describe your goal. What do you want to build?"
                                disabled={goal.loading || goal.updatingGoal}
                            />

                            {/* Clarifying questions (after first generation, before done) */}
                            {goal.response && !clarifying.clarifyingDone && (
                                <ClarifyingQuestions
                                    questions={clarifying.allQuestions}
                                    answers={clarifying.allAnswers}
                                    onUpdateAnswer={clarifying.updateAnswer}
                                    onUpdateGoal={handleUpdateGoal}
                                    onGenerateRequirements={clarifying.done}
                                    loading={clarifying.loadingQuestions}
                                    updatingGoal={goal.updatingGoal}
                                />
                            )}

                            {/* Done message */}
                            {clarifying.clarifyingDone && (
                                <div class="clarifying-done-message">
                                    Clarification complete — proceed to review assumptions.
                                </div>
                            )}

                            {/* Initial generate button (only before first response) */}
                            {!goal.response && (
                                <button class="button" onClick={goal.go} disabled={anyBusy || !goal.prompt.trim()}>
                                    {goal.loading ? 'Generating\u2026' : 'Generate'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section 1: Assumptions */}
                {ui.stepActive[1] && (
                    <div class="collapsible" ref={assumptions.assumptionsSectionRef}>
                        <button class="collapsible-header" onClick={() => ui.toggleSection(1)}>
                            <span class="collapsible-title">Assumptions</span>
                            {assumptions.assumptions.length > 0 && (
                                <span class="collapsible-badge">
                                    {assumptions.assumptions.filter(a => a.status !== 'pending').length}/{assumptions.assumptions.length}
                                </span>
                            )}
                            <span class={`collapsible-chevron ${ui.openSections.has(1) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
                        </button>
                        <div class={`collapsible-body ${ui.openSections.has(1) ? 'collapsible-body--open' : ''}`}>
                            <div class="collapsible-content">
                                <AssumptionReview
                                    assumptions={assumptions.assumptions}
                                    onUpdate={assumptions.setAssumptions}
                                    onDone={assumptions.markDone}
                                    onRegenerate={() => assumptions.generate()}
                                    loading={assumptions.loadingAssumptions}
                                    done={assumptions.assumptionsDone}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Section 2: Requirements */}
                {ui.stepActive[2] && (
                    <div class="collapsible">
                        <button class="collapsible-header" onClick={() => ui.toggleSection(2)}>
                            <span class="collapsible-title">Requirements</span>
                            <span class={`collapsible-chevron ${ui.openSections.has(2) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
                        </button>
                        <div class={`collapsible-body ${ui.openSections.has(2) ? 'collapsible-body--open' : ''}`}>
                            <div class="collapsible-content">
                                {req.requirements.length > 0 && (
                                    <RequirementList
                                        requirements={req.requirements}
                                        onUpdate={req.setRequirements}
                                        onGenerateChildren={req.generateChildren}
                                        onGenerateTests={req.generateTests}
                                        generatingChildrenId={req.generatingChildrenId}
                                        generatingTestsId={req.generatingTestsId}
                                        pendingTests={req.pendingTests}
                                        onApprovePendingTests={req.approvePendingTests}
                                        onCancelPendingTests={req.cancelPendingTests}
                                    />
                                )}
                                <button
                                    class="button"
                                    onClick={handleGenerateRequirements}
                                    disabled={req.loadingRequirements}
                                >
                                    {req.loadingRequirements ? 'Generating\u2026' : req.requirements.length > 0 ? 'Generate More' : 'Generate Requirements'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
