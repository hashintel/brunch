import './style.css';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Model, Assumption, Requirement } from './types';
import { SessionPanel } from './SessionPanel';
import { useSession } from './useSession';
import { useWorkflow } from './useWorkflow';
import { useElicitation } from './useElicitation';
import { useAssistant } from './useAssistant';
import { useAutoSave } from './useAutoSave';
import { useFocusedItem } from './useFocusedItem';
import { useVersions } from './useVersions';
import { AssistantPane } from './AssistantPane';
import { AssistantTrigger } from './AssistantTrigger';
import { SpecPane } from './SpecPane';
import { GoalSection } from './GoalSection';
import { AssumptionSection } from './AssumptionSection';
import { RequirementSection } from './RequirementSection';
import { createProjectBus } from './projectBus';
import { useResizable } from './useResizable';
import { ResizeHandle, SidebarExpandBtn } from './ResizeHandle';

const STEPS = ['Goal', 'Assumptions', 'Requirements'] as const;

export function Home() {
    const [error, setError] = useState('');
    const [projectName, setProjectName] = useState('');
    const [cwd, setCwd] = useState('');
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [models, setModels] = useState<Model[]>([]);
    const bus = useMemo(createProjectBus, []);
    const focused = useFocusedItem();
    const leftSidebar = useResizable({ key: 'sidebar-left', defaultWidth: 270, minWidth: 200, maxWidth: 450, side: 'left' });
    const rightPane = useResizable({ key: 'sidebar-right', defaultWidth: 380, minWidth: 280, maxWidth: 600, side: 'right' });

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
    }, []);

    const session = useSession({ bus });
    const workflow = useWorkflow({ selectedModel, cwd, projectId: session.currentSessionId, bus });
    const { goal, clarifying, assumptions, req, spec } = workflow;
    const [rightTab, setRightTab] = useState<'spec' | 'assistant'>('spec');

    const assistant = useAssistant({
        selectedModel,
        cwd,
        projectId: session.currentSessionId,
        bus,
        getGoalResponse: () => goal.response,
        getAssumptions: () => assumptions.assumptions,
        getRequirements: () => req.requirements,
        getFocusedItem: focused.getFocused,
    });

    // Wire bus handlers — reassigned each render so closures stay fresh
    bus.error = setError;
    bus.callHistoryChanged = session.refreshCallHistory;
    bus.setGoal = (goalText) => {
        goal.setPrompt(goalText);
        workflow.setShowInvalidGoalSuggestions(false);
        assistant.close();
    };
    bus.updateAssumption = (update) => {
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
    };
    bus.updateRequirement = (update) => {
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
    };

    focused.bindOpenWithMessage(assistant.openWithMessage);

    const versions = useVersions();
    const isCheckedOut = !!versions.checkedOutHash;

    const autoSaveData = {
        name: projectName,
        cwd,
        selectedModel,
        ...workflow.data,
    };

    // Load session from URL on mount / navigation
    useEffect(() => {
        if (session.pendingUrlSessionId) {
            session.clearPendingUrlSession();
            session.load(session.pendingUrlSessionId).then(data => {
                if (data) restoreSessionData(data);
            }).finally(() => session.setInitializing(false));
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
        busy: workflow.anyBusy || assumptions.loadingAssumptions || req.loadingRequirements || isCheckedOut,
        onSaved: versions.refreshStatus,
    });

    const ui = useElicitation({
        response: goal.response,
        clarifyingDone: clarifying.clarifyingDone,
        assumptionsDone: assumptions.assumptionsDone,
        requirementsCount: req.requirements.length,
    });

    async function handleLoadSession(id: string) {
        const data = await session.load(id);
        if (!data) return;
        restoreSessionData(data);
    }

    function handleNewSession() {
        workflow.reset();
        assistant.reset();
        setError('');
        setProjectName('');
        setCwd('');
        session.setCurrentSessionId(null);
        session.setCallHistory([]);
    }

    const [creatingProject, setCreatingProject] = useState(false);

    async function handleCreateProject() {
        if (!projectName.trim()) return;
        setCreatingProject(true);
        await session.createProject(projectName.trim(), cwd, selectedModel);
        setCreatingProject(false);
    }

    function restoreSessionData(data: any, { refetch = true } = {}) {
        workflow.restore(data, { refetch });
        setProjectName(data.name);
        setCwd(data.cwd);
        setSelectedModel(data.selectedModel);
    }

    async function handleVersionCheckout(hash: string) {
        if (!session.currentSessionId) return;
        if (versions.checkedOutHash === hash) {
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
        if (session.currentSessionId) {
            await handleLoadSession(session.currentSessionId);
        }
    }

    if (session.initializing) {
        return (
            <div class="loading-screen">
                <div class="loading-spinner" />
                <p class="loading-text">Loading...</p>
            </div>
        );
    }

    return (
        <div class={`home-layout ${assistant.isOpen || (spec.spec || spec.loading) ? 'home-layout--assistant-open' : ''}`}>
            {leftSidebar.collapsed && (
                <SidebarExpandBtn side="left" onClick={leftSidebar.toggle} />
            )}
            <aside
                class={`sidebar ${leftSidebar.collapsed ? 'sidebar--collapsed' : ''}`}
                style={leftSidebar.collapsed ? undefined : { width: `${leftSidebar.width}px` }}
            >
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
                    versions={versions}
                    onVersionRevert={handleVersionRevert}
                    onVersionCheckout={handleVersionCheckout}
                    specProgress={spec.progress}
                    specLoading={spec.loading}
                />
                {!leftSidebar.collapsed && (
                    <ResizeHandle side="left" {...leftSidebar.handleProps} />
                )}
            </aside>
            <div class="home" style={(assistant.isOpen || spec.spec || spec.loading) && !rightPane.collapsed ? { marginRight: `${rightPane.width}px` } : undefined}>
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

                        <GoalSection
                            goal={goal}
                            clarifying={clarifying}
                            ui={ui}
                            showInvalidGoalSuggestions={workflow.showInvalidGoalSuggestions}
                            onDismissInvalidSuggestions={() => workflow.setShowInvalidGoalSuggestions(false)}
                            onUpdateGoal={workflow.handleUpdateGoal}
                            onOpenAssistantHelp={() => {
                                assistant.openWithMessage(
                                    'Your prompt was too vague for me to generate clarifying questions. Let\u2019s work together to define a clear project goal.\n\nWhat kind of project are you thinking about? Tell me:\n\u2022 What problem are you solving?\n\u2022 Who are the users?\n\u2022 What are the key features?\n\nOnce we have a solid goal, I\u2019ll set it in the form for you.'
                                );
                                workflow.setShowInvalidGoalSuggestions(false);
                            }}
                            onChatQuestion={focused.chatQuestion}
                            isCheckedOut={isCheckedOut}
                            anyBusy={workflow.anyBusy}
                        />

                        {ui.stepActive[1] && (
                            <AssumptionSection
                                assumptions={assumptions}
                                ui={ui}
                                onChatAssumption={focused.chatAssumption}
                            />
                        )}

                        {ui.stepActive[2] && (
                            <RequirementSection
                                req={req}
                                ui={ui}
                                onGenerateRequirements={workflow.handleGenerateRequirements}
                                onChatRequirement={focused.chatRequirement}
                                isCheckedOut={isCheckedOut}
                            />
                        )}
                    </>
                )}
            </div>

            <AssistantTrigger
                isOpen={assistant.isOpen}
                onToggle={() => { assistant.toggle(); setRightTab('assistant'); }}
                onOpenWithContext={(ctx) => { assistant.openWithContext(ctx); setRightTab('assistant'); }}
            />

            {/* Right sidebar with Spec/Assistant tabs */}
            {(assistant.isOpen || (spec.spec || spec.loading)) && rightPane.collapsed && (
                <SidebarExpandBtn side="right" onClick={rightPane.toggle} />
            )}
            {(assistant.isOpen || (spec.spec || spec.loading)) && (
                <div
                    class={`right-pane ${assistant.isOpen || spec.spec || spec.loading ? 'right-pane--open' : ''} ${rightPane.collapsed ? 'sidebar--collapsed' : ''}`}
                    style={rightPane.collapsed ? undefined : { width: `${rightPane.width}px` }}
                >
                    {!rightPane.collapsed && (
                        <ResizeHandle side="right" {...rightPane.handleProps} />
                    )}
                    <div class="right-pane-tabs">
                        {(spec.spec || spec.loading) && (
                            <button
                                class={`right-pane-tab ${rightTab === 'spec' ? 'right-pane-tab--active' : ''}`}
                                onClick={() => setRightTab('spec')}
                            >
                                Spec
                            </button>
                        )}
                        <button
                            class={`right-pane-tab ${rightTab === 'assistant' ? 'right-pane-tab--active' : ''}`}
                            onClick={() => { setRightTab('assistant'); if (!assistant.isOpen) assistant.toggle(); }}
                        >
                            Assistant
                        </button>
                    </div>

                    {rightTab === 'spec' && (
                        <SpecPane
                            spec={spec.spec}
                            progress={spec.progress}
                            loading={spec.loading}
                            editable={req.requirements.length > 0}
                            onSpecChange={spec.setSpec}
                        />
                    )}

                    {rightTab === 'assistant' && (
                        <AssistantPane
                            isOpen={true}
                            messages={assistant.messages}
                            loading={assistant.loading}
                            toolStatus={assistant.toolStatus}
                            streamingContent={assistant.streamingContent}
                            pendingContext={assistant.pendingContext}
                            goalJustSet={assistant.goalJustSet}
                            focusedItem={focused.focusedItem}
                            toolUpdates={assistant.toolUpdates}
                            onSend={assistant.send}
                            onClose={() => { assistant.close(); focused.clear(); }}
                            onDismissContext={assistant.dismissContext}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
