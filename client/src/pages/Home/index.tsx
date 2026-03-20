import './style.css';
import { useEffect, useState, useRef } from 'preact/hooks';
import type { Model, Assumption, Requirement } from './types';
import { RequirementList } from './RequirementList';
import { SessionPanel } from './SessionPanel';
import { ClarifyingQuestions } from './ClarifyingQuestions';
import { AssumptionReview } from './AssumptionReview';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { buildPreviousRounds, formatAnswer } from './utils';
import { useSession } from './useSession';
import { useGoal } from './useGoal';
import { useClarifying } from './useClarifying';
import { useAssumptions } from './useAssumptions';
import { useRequirements } from './useRequirements';
import { useElicitation } from './useElicitation';
import { useAssistant } from './useAssistant';
import { useAutoSave } from './useAutoSave';
import { useVersions } from './useVersions';
import { AssistantPane } from './AssistantPane';
import { AssistantTrigger } from './AssistantTrigger';

const STEPS = ['Goal', 'Assumptions', 'Requirements'] as const;

const GOAL_SUGGESTIONS = [
    'Build a todo list app',
    'Build a weather app',
    'Build a chat application',
    'Build a blog platform',
];

export function Home() {
    const [error, setError] = useState('');
    const [projectName, setProjectName] = useState('');
    const [cwd, setCwd] = useState('');
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [models, setModels] = useState<Model[]>([]);
    const [showInvalidGoalSuggestions, setShowInvalidGoalSuggestions] = useState(false);
    const [focusedAssumption, setFocusedAssumption] = useState<Assumption | null>(null);
    const focusedAssumptionRef = useRef<Assumption | null>(null);
    focusedAssumptionRef.current = focusedAssumption;
    const [focusedRequirement, setFocusedRequirement] = useState<Requirement | null>(null);
    const focusedRequirementRef = useRef<Requirement | null>(null);
    focusedRequirementRef.current = focusedRequirement;

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
    }, []);

    const session = useSession({ onError: setError });

    const goal = useGoal({
        selectedModel,
        cwd,
        projectId: session.currentSessionId,
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
        onGoalReady: (goalText, iterations, questions, answers) => {
            clarifying.fetchQuestions(goalText, iterations, questions, answers);
        },
    });

    const clarifying = useClarifying({
        selectedModel,
        cwd,
        projectId: session.currentSessionId,
        response: goal.response,
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
        onClarifyingDone: (iterations, questions, answers) => {
            // Pass raw prompt + Q&A rounds directly to assumptions (no goal regeneration)
            const rawPrompt = goal.prompt || goal.response;
            goal.setResponse(rawPrompt);
            const rounds = buildPreviousRounds(iterations, questions, answers);
            assumptions.generate(rounds, rawPrompt);
        },
        onGoalClear: (rawPrompt) => {
            // Goal is already clear — go straight to assumptions with the raw prompt
            goal.setResponse(rawPrompt);
            clarifying.done({ skipCallback: true });
            assumptions.generate(undefined, rawPrompt);
        },
        onGoalInvalid: () => {
            // Prompt is too vague/invalid — show suggestions
            setShowInvalidGoalSuggestions(true);
            goal.setResponse('');
            clarifying.reset();
        },
    });

    const assumptions = useAssumptions({
        selectedModel,
        cwd,
        projectId: session.currentSessionId,
        response: goal.response,
        clarifyingDone: clarifying.clarifyingDone,
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
    });

    const req = useRequirements({
        selectedModel,
        cwd,
        projectId: session.currentSessionId,
        response: goal.response,
        onError: setError,
        onCallHistoryRefresh: session.refreshCallHistory,
    });

    const assistant = useAssistant({
        selectedModel,
        cwd,
        projectId: session.currentSessionId,
        getGoalResponse: () => goal.response,
        getAssumptions: () => assumptions.assumptions,
        getRequirements: () => req.requirements,
        onSetGoal: (goalText) => {
            goal.setPrompt(goalText);
            setShowInvalidGoalSuggestions(false);
            assistant.close();
        },
        getFocusedAssumption: () => focusedAssumptionRef.current,
        onUpdateAssumption: (update) => {
            assumptions.setAssumptions(prev =>
                prev.map(a => {
                    if (a.id !== update.id) return a;
                    return {
                        ...a,
                        ...(update.text != null ? { text: update.text, editedText: update.text, status: 'edited' as const } : {}),
                        ...(update.status != null ? { status: update.status as Assumption['status'] } : {}),
                        ...(update.confidence != null ? { confidence: update.confidence as Assumption['confidence'] } : {}),
                        ...(update.impact != null ? { impact: update.impact as Assumption['impact'] } : {}),
                    };
                }),
            );
        },
        getFocusedRequirement: () => focusedRequirementRef.current,
        onUpdateRequirement: (update) => {
            function updateReqInTree(reqs: Requirement[]): Requirement[] {
                return reqs.map(r => {
                    if (r.id === update.id) {
                        return {
                            ...r,
                            ...(update.title != null ? { title: update.title } : {}),
                            ...(update.definition != null ? { definition: update.definition } : {}),
                            ...(update.confidence != null ? { confidence: update.confidence } : {}),
                            ...(update.stage != null ? { stage: update.stage as Requirement['stage'] } : {}),
                        };
                    }
                    return { ...r, children: updateReqInTree(r.children) };
                });
            }
            req.setRequirements(prev => updateReqInTree(prev));
        },
    });

    const versions = useVersions();
    const isCheckedOut = !!versions.checkedOutHash;

    const anyBusy = goal.loading || goal.updatingGoal || goal.generatingDetailedGoal || clarifying.loadingQuestions;

    const autoSaveData = {
        name: projectName,
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
    };

    // Load session from URL on mount / navigation
    useEffect(() => {
        if (session.pendingUrlSessionId) {
            session.clearPendingUrlSession();
            session.load(session.pendingUrlSessionId).then(data => {
                if (data) restoreSessionData(data);
            });
        }
    }, [session.pendingUrlSessionId]);

    // Refresh version control when session changes
    useEffect(() => {
        versions.setProjectId(session.currentSessionId);
        if (session.currentSessionId) {
            versions.refresh();
        }
    }, [session.currentSessionId]);

    const { saveStatus } = useAutoSave({
        currentSessionId: session.currentSessionId,
        save: session.save,
        data: autoSaveData,
        busy: anyBusy || assumptions.loadingAssumptions || req.loadingRequirements || isCheckedOut,
        onSaved: versions.refreshStatus,
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

    async function handleLoadSession(id: string) {
        const data = await session.load(id);
        if (!data) return;
        restoreSessionData(data);
    }

    function handleNewSession() {
        goal.reset();
        clarifying.reset();
        assumptions.reset();
        req.reset();
        assistant.reset();
        setError('');
        setProjectName('');
        setCwd('');
        setShowInvalidGoalSuggestions(false);
        session.setCurrentSessionId(null);
        session.setCallHistory([]);
    }

    function handleGenerateRequirements() {
        req.generate(
            clarifying.goalIterations,
            clarifying.allQuestions,
            clarifying.allAnswers,
            assumptions.assumptions,
        );
    }

    const [creatingProject, setCreatingProject] = useState(false);

    async function handleCreateProject() {
        if (!projectName.trim()) return;
        setCreatingProject(true);
        await session.createProject(projectName.trim(), cwd, selectedModel);
        setCreatingProject(false);
    }

    function restoreSessionData(data: any, { refetch = true } = {}) {
        goal.restore(data);
        clarifying.restore(data);
        assumptions.restore(data);
        req.restore(data);
        setProjectName(data.name);
        setCwd(data.cwd);
        setSelectedModel(data.selectedModel);

        // Recover from stuck state: have a goal response, clarifying not done, but no questions
        if (refetch && data.response && !data.clarifyingDone && (data.allQuestions ?? []).length === 0) {
            clarifying.fetchQuestions(
                data.response,
                data.goalIterations ?? [],
                [],
                [],
            );
        }
    }

    async function handleVersionCheckout(hash: string) {
        if (!session.currentSessionId) return;
        if (versions.checkedOutHash === hash) {
            // Toggle off — reload live data
            versions.exitCheckout();
            await handleLoadSession(session.currentSessionId);
            return;
        }
        const data = await versions.checkout(hash, session.currentSessionId);
        if (data) {
            restoreSessionData(data, { refetch: false });
        }
    }

    async function handleVersionRevert(hash: string) {
        await versions.revert(hash);
        // Reload session data after revert
        if (session.currentSessionId) {
            await handleLoadSession(session.currentSessionId);
        }
    }

    return (
        <div class={`home-layout ${assistant.isOpen ? 'home-layout--assistant-open' : ''}`}>
            <aside class="sidebar">
                <SessionPanel
                    sessions={session.sessions}
                    currentSessionId={session.currentSessionId}
                    onLoad={handleLoadSession}
                    onDelete={session.deleteSession}
                    onNew={handleNewSession}
                    saveStatus={saveStatus}
                    models={models}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    callHistory={session.callHistory}
                    disabled={goal.loading}
                    assumptionCount={assumptions.assumptions.length}
                    confirmedAssumptionCount={assumptions.assumptions.filter(a => a.status === 'confirmed').length}
                    requirementCount={req.requirements.length}
                    clarifyingRoundCount={clarifying.goalIterations.length}
                    versionCommits={versions.commits}
                    versionRealChangeCount={versions.realChangeCount}
                    versionChangedTableNames={versions.changedTableNames}
                    versionCommitMessage={versions.commitMessage}
                    onVersionCommitMessageChange={versions.setCommitMessage}
                    versionCommitting={versions.committing}
                    onVersionCommit={versions.commit}
                    onVersionViewDiff={versions.viewDiff}
                    onVersionViewWorkingDiff={versions.viewWorkingDiff}
                    onVersionRevert={handleVersionRevert}
                    versionSelectedDiff={versions.selectedDiff}
                    onVersionCloseDiff={() => versions.setSelectedDiff(null)}
                    versionLoadingDiffHash={versions.loadingDiffHash}
                    versionCheckedOutHash={versions.checkedOutHash}
                    versionLoadingCheckoutHash={versions.loadingCheckoutHash}
                    onVersionCheckout={handleVersionCheckout}
                />
            </aside>
            <div class="home">
                {error && <div class="error">{error}</div>}

                {isCheckedOut && (
                    <div class="checkout-banner">
                        Viewing version <span class="checkout-banner-hash">{versions.checkedOutHash!.slice(0, 7)}</span> — read only
                        <button class="checkout-banner-back" onClick={() => handleVersionCheckout(versions.checkedOutHash!)}>Back to current</button>
                    </div>
                )}

                {/* Project creation form when no project is active */}
                {!session.currentSessionId && (
                    <div class="project-setup">
                        <h2 class="project-setup-title">New Project</h2>
                        <label class="project-setup-label">Project name <span class="project-setup-required">*</span></label>
                        <input
                            class="sidebar-input"
                            type="text"
                            value={projectName}
                            onInput={e => setProjectName(e.currentTarget.value)}
                            placeholder="My Project"
                        />
                        <label class="project-setup-label">Project folder <span class="project-setup-optional">(optional)</span></label>
                        <input
                            class="sidebar-input"
                            type="text"
                            value={cwd}
                            onInput={e => setCwd(e.currentTarget.value)}
                            placeholder="/path/to/project or URL"
                        />
                        <button
                            class="button"
                            onClick={handleCreateProject}
                            disabled={!projectName.trim() || creatingProject}
                        >
                            {creatingProject ? 'Creating\u2026' : 'Create Project'}
                        </button>
                    </div>
                )}

                {/* Active project */}
                {session.currentSessionId && (
                    <>
                        {/* Project header */}
                        <div class="project-header">
                            <div class="project-header-fields">
                                <input
                                    class="project-header-name"
                                    type="text"
                                    value={projectName}
                                    onInput={e => setProjectName(e.currentTarget.value)}
                                    placeholder="Project name"
                                    disabled={isCheckedOut}
                                />
                                <input
                                    class="project-header-folder"
                                    type="text"
                                    value={cwd}
                                    onInput={e => setCwd(e.currentTarget.value)}
                                    placeholder="Project folder (optional)"
                                    disabled={isCheckedOut}
                                />
                            </div>
                        </div>

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
                                onInput={e => { goal.setPrompt(e.currentTarget.value); setShowInvalidGoalSuggestions(false); }}
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
                                                onClick={() => { goal.setPrompt(suggestion); setShowInvalidGoalSuggestions(false); }}
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        class="button button--secondary"
                                        onClick={() => {
                                            assistant.openWithMessage(
                                                'Your prompt was too vague for me to generate clarifying questions. Let\u2019s work together to define a clear project goal.\n\nWhat kind of project are you thinking about? Tell me:\n\u2022 What problem are you solving?\n\u2022 Who are the users?\n\u2022 What are the key features?\n\nOnce we have a solid goal, I\u2019ll set it in the form for you.'
                                            );
                                            setShowInvalidGoalSuggestions(false);
                                        }}
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

                            {/* Initial generate button (only before clarifying questions or goal generated) */}
                            {!goal.response && clarifying.allQuestions.length === 0 && !clarifying.loadingQuestions && (
                                <button class="button" onClick={goal.go} disabled={isCheckedOut || anyBusy || !goal.prompt.trim()}>
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
                                    onChat={(a) => {
                                        setFocusedAssumption(a);
                                        assistant.openWithMessage(
                                            `Let's discuss this assumption:\n\n**"${a.editedText || a.text}"**\n\nConfidence: ${a.confidence} | Impact: ${a.impact} | Status: ${a.status}\n\nRationale: ${a.rationale}\n\nWhat would you like to know or change about this assumption?`
                                        );
                                    }}
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
                                                onChat={(r) => {
                                                    setFocusedRequirement(r);
                                                    assistant.openWithMessage(
                                                        `Let's discuss this requirement:\n\n**"${r.title}"**\n\n${r.definition}\n\nConfidence: ${Math.round(r.confidence * 100)}% | Stage: ${r.stage}${r.tests.length > 0 ? `\n\nTests: ${r.tests.map(t => `${t.type}: ${t.description}`).join('; ')}` : ''}\n\nWhat would you like to know or change about this requirement?`
                                                    );
                                                }}
                                            />
                                        )}
                                        <button
                                            class="button"
                                            onClick={handleGenerateRequirements}
                                            disabled={isCheckedOut || req.loadingRequirements}
                                        >
                                            {req.loadingRequirements ? 'Generating\u2026' : req.requirements.length > 0 ? 'Generate More' : 'Generate Requirements'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <AssistantTrigger
                isOpen={assistant.isOpen}
                onToggle={assistant.toggle}
                onOpenWithContext={assistant.openWithContext}
            />
            <AssistantPane
                isOpen={assistant.isOpen}
                messages={assistant.messages}
                loading={assistant.loading}
                toolStatus={assistant.toolStatus}
                streamingContent={assistant.streamingContent}
                pendingContext={assistant.pendingContext}
                goalJustSet={assistant.goalJustSet}
                onSend={assistant.send}
                onClose={() => { assistant.close(); setFocusedAssumption(null); setFocusedRequirement(null); }}
                onDismissContext={assistant.dismissContext}
            />
        </div>
    );
}
