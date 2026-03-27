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
import { createProjectBus } from './projectBus';
import { useResizable } from './useResizable';
import { ResizeHandle, SidebarExpandBtn } from './ResizeHandle';
import { createPortal } from 'preact/compat';

function countAllRequirements(reqs: Requirement[]): number {
    let count = 0;
    function walk(r: Requirement) { count++; r.children.forEach(walk); }
    reqs.forEach(walk);
    return count;
}

export function Home() {
    const [error, setError] = useState('');
    const [projectName, setProjectName] = useState('');
    const [cwd, setCwd] = useState('');
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [models, setModels] = useState<Model[]>([]);
    const bus = useMemo(createProjectBus, []);
    const focused = useFocusedItem();
    const leftSidebar = useResizable({ key: 'sidebar-left', defaultWidth: 270, minWidth: 200, maxWidth: 450, side: 'left' });

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
    }, []);

    const session = useSession({ bus });
    const workflow = useWorkflow({ selectedModel, cwd, projectId: session.currentSessionId, bus });
    const { goal, clarifying, assumptions, req, spec } = workflow;

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

    // Wire bus handlers
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
    bus.createAssumption = (input) => {
        const newAssumption: Assumption = {
            id: input.id || crypto.randomUUID(),
            text: input.text,
            rationale: input.rationale,
            confidence: input.confidence as Assumption['confidence'],
            impact: input.impact as Assumption['impact'],
            status: 'pending',
        };
        assumptions.setAssumptions(prev => [...prev, newAssumption]);
    };
    bus.deleteAssumption = (id) => {
        assumptions.setAssumptions(prev => prev.filter(a => a.id !== id));
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
    bus.createRequirement = (input) => {
        const newReq: Requirement = {
            id: input.id || crypto.randomUUID(),
            title: input.title,
            definition: input.definition,
            confidence: input.confidence ?? 0.5,
            stage: 'proposal',
            tests: [],
            children: [],
        };
        if (input.parent_id) {
            function addChild(reqs: Requirement[]): Requirement[] {
                return reqs.map(r => {
                    if (r.id === input.parent_id) {
                        return { ...r, children: [...r.children, newReq] };
                    }
                    return { ...r, children: addChild(r.children) };
                });
            }
            req.setRequirements(prev => addChild(prev));
        } else {
            req.setRequirements(prev => [...prev, newReq]);
        }
    };
    bus.deleteRequirement = (id) => {
        function removeFromTree(reqs: Requirement[]): Requirement[] {
            return reqs
                .filter(r => r.id !== id)
                .map(r => ({ ...r, children: removeFromTree(r.children) }));
        }
        req.setRequirements(prev => removeFromTree(prev));
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
        hasSpec: !!(spec.spec || spec.loading),
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

    // Compute dashboard stats
    const assumptionCount = assumptions.assumptions.length;
    const confirmedAssumptions = assumptions.assumptions.filter(a => a.status === 'confirmed' || a.status === 'edited').length;
    const requirementCount = countAllRequirements(req.requirements);
    const hasGoal = !!goal.response;
    const hasSpec = !!spec.spec;

    // Determine wizard step for CreateSpec link
    function getCreateSpecUrl(): string {
        if (!session.currentSessionId) return '/create-spec';
        if (requirementCount > 0) return `/create-spec/${session.currentSessionId}/overview`;
        if (assumptionCount > 0) return `/create-spec/${session.currentSessionId}/requirements`;
        if (hasGoal) return `/create-spec/${session.currentSessionId}/clarify`;
        return `/create-spec/${session.currentSessionId}/clarify`;
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
        <div class="home-layout">
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
                    projectName={projectName}
                    onProjectNameChange={setProjectName}
                    cwd={cwd}
                    onCwdChange={setCwd}
                    isCheckedOut={isCheckedOut}
                />
                {!leftSidebar.collapsed && (
                    <ResizeHandle side="left" {...leftSidebar.handleProps} />
                )}
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

                {/* Dashboard — active project overview */}
                {session.currentSessionId && (
                    <div class="dashboard">
                        <div class="dashboard__header">
                            <div>
                                <h1 class="dashboard__title">{projectName || 'Untitled Project'}</h1>
                                {cwd && <p class="dashboard__cwd">{cwd}</p>}
                            </div>
                            <a
                                class="dashboard__open-spec-btn"
                                href={getCreateSpecUrl()}
                            >
                                Open in Spec Editor
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M5.5 3L9.5 7L5.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </a>
                        </div>

                        {/* Stats cards */}
                        <div class="dashboard__stats">
                            <div class={`dashboard__stat-card ${hasGoal ? 'dashboard__stat-card--ok' : ''}`}>
                                <span class="dashboard__stat-value">{hasGoal ? 'Defined' : 'Not set'}</span>
                                <span class="dashboard__stat-label">Goal</span>
                            </div>
                            <div class={`dashboard__stat-card ${assumptionCount > 0 ? 'dashboard__stat-card--ok' : ''}`}>
                                <span class="dashboard__stat-value">
                                    {assumptionCount > 0 ? `${confirmedAssumptions}/${assumptionCount}` : '0'}
                                </span>
                                <span class="dashboard__stat-label">Assumptions confirmed</span>
                            </div>
                            <div class={`dashboard__stat-card ${requirementCount > 0 ? 'dashboard__stat-card--ok' : ''}`}>
                                <span class="dashboard__stat-value">{requirementCount}</span>
                                <span class="dashboard__stat-label">Requirements</span>
                            </div>
                            <div class={`dashboard__stat-card ${hasSpec ? 'dashboard__stat-card--ok' : ''}`}>
                                <span class="dashboard__stat-value">
                                    {spec.loading ? 'Generating...' : hasSpec ? `${spec.progress}%` : 'Not started'}
                                </span>
                                <span class="dashboard__stat-label">Spec</span>
                            </div>
                        </div>

                        {/* Goal summary */}
                        {goal.response && (
                            <div class="dashboard__section">
                                <h3 class="dashboard__section-title">Goal</h3>
                                <p class="dashboard__section-text">{goal.response.slice(0, 300)}{goal.response.length > 300 ? '...' : ''}</p>
                            </div>
                        )}

                        {/* Spec preview */}
                        {spec.spec && (
                            <div class="dashboard__section">
                                <h3 class="dashboard__section-title">Spec Preview</h3>
                                <div class="dashboard__spec-preview">
                                    {spec.spec.slice(0, 500)}{spec.spec.length > 500 ? '...' : ''}
                                </div>
                                <a
                                    class="dashboard__view-full-btn"
                                    href={getCreateSpecUrl()}
                                >
                                    View full spec in editor
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <AssistantTrigger
                isOpen={assistant.isOpen}
                onToggle={() => assistant.toggle()}
                onOpenWithContext={(ctx) => assistant.openWithContext(ctx)}
            />

            {assistant.isOpen && createPortal(
                <div class="assistant-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) { assistant.close(); focused.clear(); } }}>
                    <div class="assistant-modal">
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
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
