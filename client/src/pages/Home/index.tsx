import './style.css';
import { useEffect, useState } from 'preact/hooks';
import type { Model } from './types';
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
            const rounds = buildPreviousRounds(iterations, questions, answers);
            assumptions.generate(rounds);
        },
        onNoQuestions: () => {
            // Reset goal so user can edit and re-generate
            goal.setResponse('');
            clarifying.reset();
            assistant.openWithMessage(
                'I wasn\'t able to generate clarifying questions from your input \u2014 it may need more detail to kick off the spec process.\n\nTry describing a concrete project or feature you want to build. For example:\n\u2022 What problem are you solving?\n\u2022 Who are the users?\n\u2022 What are the key features?\n\nEdit your goal in the text box and hit Generate again, or chat with me here and I\'ll help you shape it.'
            );
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
    });

    const versions = useVersions();

    const anyBusy = goal.loading || goal.updatingGoal || clarifying.loadingQuestions;

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

    // Refresh version control when session changes
    useEffect(() => {
        if (session.currentSessionId) {
            versions.refresh();
        }
    }, [session.currentSessionId]);

    const { saveStatus } = useAutoSave({
        currentSessionId: session.currentSessionId,
        save: session.save,
        data: autoSaveData,
        busy: anyBusy || assumptions.loadingAssumptions || req.loadingRequirements,
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
        goal.restore(data);
        clarifying.restore(data);
        assumptions.restore(data);
        req.restore(data);
        setProjectName(data.name);
        setCwd(data.cwd);
        setSelectedModel(data.selectedModel);
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
                    versionChanges={versions.changes}
                    versionCommitMessage={versions.commitMessage}
                    onVersionCommitMessageChange={versions.setCommitMessage}
                    versionCommitting={versions.committing}
                    onVersionCommit={versions.commit}
                    onVersionViewDiff={versions.viewDiff}
                    onVersionRevert={versions.revert}
                    versionSelectedDiff={versions.selectedDiff}
                    onVersionCloseDiff={() => versions.setSelectedDiff(null)}
                    versionLoadingDiffHash={versions.loadingDiffHash}
                />
            </aside>
            <div class="home">
                {error && <div class="error">{error}</div>}

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
                                />
                                <input
                                    class="project-header-folder"
                                    type="text"
                                    value={cwd}
                                    onInput={e => setCwd(e.currentTarget.value)}
                                    placeholder="Project folder (optional)"
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
                                onInput={e => goal.setPrompt(e.currentTarget.value)}
                                placeholder="Describe your goal. What do you want to build?"
                                disabled={goal.loading || goal.updatingGoal}
                            />

                            {/* Tool status during goal generation */}
                            {(goal.loading || goal.updatingGoal) && (
                                <LoadingIndicator
                                    message={goal.updatingGoal ? 'Updating goal' : 'Generating goal'}
                                    toolStatus={goal.toolStatus}
                                />
                            )}

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
                onSend={assistant.send}
                onClose={assistant.close}
                onDismissContext={assistant.dismissContext}
            />
        </div>
    );
}
