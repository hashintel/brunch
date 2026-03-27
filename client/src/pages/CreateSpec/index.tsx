import './style.css';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useRoute } from 'preact-iso';
import { useSpecWizard } from './useSpecWizard';
import { useAssistantChat } from './useAssistantChat';
import { LandingScreen } from './LandingScreen';
import { ClarifyScreen } from './ClarifyScreen';
import { AssumptionsScreen } from './AssumptionsScreen';
import { RequirementsScreen } from './RequirementsScreen';
import { OverviewScreen } from './OverviewScreen';
import { SkeletonLoader } from './SkeletonLoader';
import { ProgressSidebar } from './ProgressSidebar';
import { AssistantPanel, AssistantToggle } from './AssistantPanel';
import { useVersions } from '../../shared/useVersions';
import { apiFetch } from '../../shared/apiFetch';
import { CallDetailModal, callerLabel, formatDuration, formatNumber } from '../../shared/CallDetailModal';
import { DiffModal } from '../../shared/DiffModal';
import type { Model, ClaudeCall } from '../../shared/types';
import type { FocusedItem } from './types';

export function CreateSpec() {
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [models, setModels] = useState<Model[]>([]);
    const [assistantOpen, setAssistantOpen] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [infoPanelOpen, setInfoPanelOpen] = useState(false);
    const [infoTab, setInfoTab] = useState<'versions' | 'calls'>('versions');
    const [callHistory, setCallHistory] = useState<ClaudeCall[]>([]);
    const [showCallModal, setShowCallModal] = useState(false);

    const { params } = useRoute();

    // Version control
    const versions = useVersions();

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
    }, []);

    // Refresh versions & call history when projectId changes
    useEffect(() => {
        const pid = params.projectId ?? null;
        versions.setProjectId(pid);
        if (pid) {
            versions.refresh();
            refreshCallHistory(pid);
        }
    }, [params.projectId]);

    async function refreshCallHistory(pid?: string) {
        const id = pid ?? wizard?.projectId;
        if (!id) { setCallHistory([]); return; }
        try {
            const url = `/api/history/claude?limit=50&projectId=${encodeURIComponent(id)}`;
            const data = await apiFetch<{ rows?: ClaudeCall[] }>(url);
            setCallHistory(data.rows ?? []);
        } catch {}
    }

    const wizard = useSpecWizard({
        selectedModel,
        projectId: params.projectId,
        routeStep: params.step,
    });

    const chat = useAssistantChat({
        screen: wizard.screen,
        prompt: wizard.prompt,
        selectedModel,
        getQuestions: useCallback(() => wizard.questions.questions, [wizard.questions.questions]),
        getAnswers: useCallback(() => wizard.questions.answers, [wizard.questions.answers]),
        getSpec: useCallback(() => wizard.spec.spec, [wizard.spec.spec]),
        getAssumptions: useCallback(() => wizard.assumptions.assumptions, [wizard.assumptions.assumptions]),
        getRequirements: useCallback(() => wizard.requirements.data, [wizard.requirements.data]),
        getWizardStatus: useCallback(() => {
            const parts: string[] = [];

            // Questions / Clarify phase
            if (wizard.screen === 'clarify') {
                const total = wizard.questions.questions.length;
                const answered = wizard.questions.answeredCount;
                if (wizard.questions.loading) {
                    parts.push('Generating clarifying questions...');
                } else if (total > 0) {
                    parts.push(`Clarify step: ${answered}/${total} questions answered.`);
                }
            }

            // Spec
            if (wizard.spec.loading) {
                parts.push('Generating project spec...');
            } else if (wizard.spec.spec) {
                parts.push(`Spec ready (${wizard.spec.spec.sections.length} sections, ${Math.round(wizard.spec.spec.overallConfidence)}% confidence).`);
            }

            // Assumptions
            if (wizard.screen === 'assumptions' || wizard.assumptions.assumptions.length > 0) {
                if (wizard.assumptions.loading && wizard.assumptions.assumptions.length === 0) {
                    parts.push('Generating assumptions...');
                } else if (wizard.assumptions.loading) {
                    parts.push(`Generating assumptions... (${wizard.assumptions.assumptions.length} so far)`);
                } else if (wizard.assumptions.assumptions.length > 0) {
                    const confirmed = wizard.assumptions.assumptions.filter(a => a.status === 'confirmed').length;
                    const pending = wizard.assumptions.assumptions.filter(a => a.status === 'pending').length;
                    parts.push(`${wizard.assumptions.assumptions.length} assumptions (${confirmed} confirmed, ${pending} pending).`);
                }
            }

            // Requirements
            if (wizard.screen === 'requirements' || wizard.requirements.data) {
                if (wizard.requirements.loading && !wizard.requirements.data) {
                    parts.push('Generating requirements...');
                } else if (wizard.requirements.loading) {
                    parts.push(`Generating requirements... (${wizard.requirements.data?.requirements.length ?? 0} so far)`);
                } else if (wizard.requirements.data) {
                    const s = wizard.requirements.data.stats;
                    parts.push(`${s.totalRequirements} requirements (${s.uncertain} uncertain, ${s.checksTotal} checks).`);
                }
            }

            // Overview
            if (wizard.screen === 'overview') {
                parts.push('User is reviewing the final spec overview.');
            }

            return parts.join(' ');
        }, [
            wizard.screen,
            wizard.questions.loading, wizard.questions.questions.length, wizard.questions.answeredCount,
            wizard.spec.loading, wizard.spec.spec,
            wizard.assumptions.loading, wizard.assumptions.assumptions,
            wizard.requirements.loading, wizard.requirements.data,
        ]),
        getFocusedItem: useCallback((): FocusedItem => {
            if (wizard.screen === 'assumptions' && wizard.assumptions.selected) {
                return { type: 'assumption', item: wizard.assumptions.selected };
            }
            if (wizard.screen === 'requirements' && wizard.requirements.selected) {
                return { type: 'requirement', item: wizard.requirements.selected };
            }
            if (wizard.screen === 'clarify' && wizard.questions.questions.length > 0) {
                const idx = wizard.questions.currentIndex;
                const q = wizard.questions.questions[idx];
                if (q) return { type: 'question', item: q, answer: wizard.questions.answers[idx] };
            }
            return null;
        }, [
            wizard.screen,
            wizard.assumptions.selected,
            wizard.requirements.selected,
            wizard.questions.questions, wizard.questions.currentIndex, wizard.questions.answers,
        ]),
        toolCallbacks: wizard.toolCallbacks,
    });

    const focusedItem: FocusedItem = (() => {
        if (wizard.screen === 'assumptions' && wizard.assumptions.selected) {
            return { type: 'assumption', item: wizard.assumptions.selected };
        }
        if (wizard.screen === 'requirements' && wizard.requirements.selected) {
            return { type: 'requirement', item: wizard.requirements.selected };
        }
        if (wizard.screen === 'clarify' && wizard.questions.questions.length > 0) {
            const idx = wizard.questions.currentIndex;
            const q = wizard.questions.questions[idx];
            if (q) return { type: 'question', item: q, answer: wizard.questions.answers[idx] };
        }
        return null;
    })();

    // Refresh versions & calls when wizard creates a new session
    useEffect(() => {
        if (wizard.projectId) {
            versions.setProjectId(wizard.projectId);
            versions.refresh();
            refreshCallHistory(wizard.projectId);
        }
    }, [wizard.projectId]);

    const showStepIndicator = wizard.screen !== 'landing' && wizard.screen !== 'loading';

    // Computed LLM call stats
    const totalCalls = callHistory.length;
    const totalInputTokens = callHistory.reduce((sum, c) => sum + (c.input_tokens ?? 0), 0);
    const totalOutputTokens = callHistory.reduce((sum, c) => sum + (c.output_tokens ?? 0), 0);
    const totalDuration = callHistory.reduce((sum, c) => sum + (c.duration_ms ?? 0), 0);
    const recentCalls = callHistory.slice(0, 3);

    async function handleSave() {
        if (saveState === 'saving') return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaveState('saving');
        try {
            await wizard.save();
            setSaveState('saved');
            saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
            versions.refreshStatus();
            refreshCallHistory();
        } catch {
            setSaveState('error');
            saveTimerRef.current = setTimeout(() => setSaveState('idle'), 3000);
        }
    }

    return (
        <div class="create-spec">
            <div class="create-spec__header">
                <a href="/" class="create-spec__back-link">&larr; Home</a>
                <div class="create-spec__header-right">
                    <select
                        class="create-spec__model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel((e.target as HTMLSelectElement).value)}
                    >
                        {models.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                    </select>
                    {showStepIndicator && (
                        <>
                            <button
                                class={`create-spec__info-btn ${infoPanelOpen ? 'create-spec__info-btn--active' : ''}`}
                                onClick={() => setInfoPanelOpen(!infoPanelOpen)}
                                title="Version History & LLM Calls"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 1v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                    <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" fill="none" />
                                </svg>
                            </button>
                            <button
                                class={`create-spec__save-draft-btn ${saveState !== 'idle' ? `create-spec__save-draft-btn--${saveState}` : ''}`}
                                onClick={handleSave}
                                disabled={saveState === 'saving'}
                            >
                                {saveState === 'saving' ? 'Saving...' :
                                 saveState === 'saved' ? '\u2713 Saved' :
                                 saveState === 'error' ? 'Failed' :
                                 'Save draft'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div class="create-spec__body">
              <div class="create-spec__body-inner">
                {showStepIndicator && (
                    <ProgressSidebar
                        screen={wizard.screen}
                        specLoading={wizard.spec.loading}
                        assumptionsLoading={wizard.assumptions.loading}
                        requirementsLoading={wizard.requirements.loading}
                    />
                )}

                <div class="create-spec__content">
                    {wizard.resuming && (
                        <div class="create-spec__loading">
                            <h2>Restoring session...</h2>
                            <SkeletonLoader lines={5} />
                        </div>
                    )}

                    {!wizard.resuming && wizard.screen === 'landing' && (
                        <LandingScreen onSubmit={wizard.submit} />
                    )}

                    {!wizard.resuming && wizard.screen === 'loading' && (
                        <div class="create-spec__loading">
                            <h2>Analyzing your project idea...</h2>
                            <SkeletonLoader lines={5} />
                            <SkeletonLoader lines={4} />
                        </div>
                    )}

                    {!wizard.resuming && wizard.screen === 'clarify' && (
                        <ClarifyScreen
                            questions={wizard.questions.questions}
                            answers={wizard.questions.answers}
                            currentIndex={wizard.questions.currentIndex}
                            answeredCount={wizard.questions.answeredCount}
                            remainingCount={wizard.questions.remainingCount}
                            onAnswer={wizard.questions.answerQuestion}
                            onSkip={wizard.questions.skipQuestion}
                            onNext={wizard.questions.goNext}
                            onBack={wizard.questions.goBack}
                            onSkipAll={wizard.goToAssumptions}
                            spec={wizard.spec.spec}
                            specLoading={wizard.spec.loading}
                            onUpdateSection={wizard.spec.updateSection}
                            prompt={wizard.prompt}
                            onUpdatePrompt={wizard.updatePrompt}
                            goalIterations={wizard.goalIterations}
                        />
                    )}

                    {!wizard.resuming && wizard.screen === 'assumptions' && (
                        wizard.assumptions.loading && wizard.assumptions.assumptions.length === 0 ? (
                            <div class="create-spec__loading">
                                <h2>Generating assumptions...</h2>
                                <SkeletonLoader lines={5} />
                                <SkeletonLoader lines={4} />
                            </div>
                        ) : (
                            <AssumptionsScreen
                                assumptions={wizard.assumptions.assumptions}
                                selectedId={wizard.assumptions.selectedId}
                                onSelect={wizard.assumptions.setSelectedId}
                                onConfirm={wizard.assumptions.confirmAssumption}
                                onConfirmAll={wizard.assumptions.confirmAll}
                                onEdit={wizard.assumptions.editAssumption}
                                onContinue={wizard.goToRequirements}
                                loading={wizard.assumptions.loading}
                            />
                        )
                    )}

                    {!wizard.resuming && wizard.screen === 'requirements' && (
                        !wizard.requirements.data ? (
                            <div class="create-spec__loading">
                                <h2>Building requirements...</h2>
                                <SkeletonLoader lines={5} />
                                <SkeletonLoader lines={4} />
                            </div>
                        ) : (
                            <RequirementsScreen
                                data={wizard.requirements.data}
                                onToggle={wizard.requirements.toggleExpand}
                                onContinue={wizard.goToOverview}
                                loading={wizard.requirements.loading}
                                selectedId={wizard.requirements.selectedId}
                                onSelect={wizard.requirements.setSelectedId}
                                onUpdate={wizard.requirements.updateRequirement}
                                onAddChild={(parentId, title) => wizard.requirements.addRequirement({ title, id: `R${Date.now()}` })}
                                onDelete={wizard.requirements.deleteRequirement}
                            />
                        )
                    )}

                    {!wizard.resuming && wizard.screen === 'overview' && wizard.spec.spec && (
                        <OverviewScreen
                            title={wizard.requirements.data?.title ?? 'Project Spec'}
                            spec={wizard.spec.spec}
                            requirements={wizard.requirements.data}
                            onUpdateSection={wizard.spec.updateSection}
                            onApprove={() => { /* TODO: final approval action */ }}
                        />
                    )}

                    {!wizard.resuming && wizard.screen === 'overview' && !wizard.spec.spec && (
                        <div class="create-spec__loading">
                            <h2>Finalizing spec...</h2>
                            <SkeletonLoader lines={5} />
                        </div>
                    )}

                    {(wizard.questions.error || wizard.spec.error || wizard.assumptions.error || wizard.requirements.error) && (
                        <div class="create-spec__error">
                            {wizard.questions.error || wizard.spec.error || wizard.assumptions.error || wizard.requirements.error}
                        </div>
                    )}
                </div>
              </div>

                {!wizard.resuming && wizard.screen !== 'landing' && wizard.screen !== 'loading' && (
                    <div class="create-spec__toolbar">
                        <button class="create-spec__toolbar-back" onClick={wizard.goBack}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L4.5 7L8.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            Back
                        </button>
                        {wizard.screen !== 'overview' && (
                            <button
                                class="create-spec__toolbar-review"
                                onClick={
                                    wizard.screen === 'clarify' ? wizard.goToAssumptions
                                    : wizard.screen === 'assumptions' ? wizard.goToRequirements
                                    : wizard.goToOverview
                                }
                            >
                                {wizard.screen === 'requirements' ? 'Review Spec' : 'Continue'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Info Panel — Version History & LLM Calls */}
            {infoPanelOpen && showStepIndicator && (
                <div class="cs-info-panel">
                    <div class="cs-info-panel__tabs">
                        <button
                            class={`cs-info-panel__tab ${infoTab === 'versions' ? 'cs-info-panel__tab--active' : ''}`}
                            onClick={() => setInfoTab('versions')}
                        >
                            Versions
                        </button>
                        <button
                            class={`cs-info-panel__tab ${infoTab === 'calls' ? 'cs-info-panel__tab--active' : ''}`}
                            onClick={() => setInfoTab('calls')}
                        >
                            LLM Calls
                            {totalCalls > 0 && <span class="cs-info-panel__badge">{totalCalls}</span>}
                        </button>
                        <button class="cs-info-panel__close" onClick={() => setInfoPanelOpen(false)}>
                            &times;
                        </button>
                    </div>

                    {infoTab === 'versions' && (
                        <div class="cs-info-panel__content">
                            {versions.realChangeCount > 0 && (
                                <div class="cs-info-panel__uncommitted">
                                    <button
                                        class="cs-info-panel__uncommitted-btn"
                                        onClick={versions.viewWorkingDiff}
                                    >
                                        <span class="cs-info-panel__change-badge">
                                            {versions.realChangeCount} uncommitted change{versions.realChangeCount !== 1 ? 's' : ''}
                                        </span>
                                        <span class="cs-info-panel__change-tables">
                                            {versions.changedTableNames.join(', ')}
                                        </span>
                                    </button>
                                </div>
                            )}
                            <div class="cs-info-panel__commit-form">
                                <input
                                    class="cs-info-panel__input"
                                    type="text"
                                    placeholder="Commit message..."
                                    value={versions.commitMessage}
                                    onInput={e => versions.setCommitMessage((e.target as HTMLInputElement).value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && versions.commitMessage.trim()) versions.commit(versions.commitMessage); }}
                                    disabled={versions.committing}
                                />
                                <button
                                    class="cs-info-panel__commit-btn"
                                    onClick={() => versions.commit(versions.commitMessage)}
                                    disabled={versions.committing || !versions.commitMessage.trim()}
                                >
                                    {versions.committing ? '...' : 'Commit'}
                                </button>
                            </div>
                            {versions.commits.length === 0 && <p class="cs-info-panel__empty">No commits yet.</p>}
                            {versions.commits.length > 0 && (
                                <div class="cs-info-panel__log">
                                    {versions.commits.slice(0, 10).map(c => (
                                        <div key={c.commit_hash} class="cs-info-panel__log-item">
                                            <span class="cs-info-panel__log-hash">{c.commit_hash.slice(0, 7)}</span>
                                            <span class="cs-info-panel__log-msg">{c.message}</span>
                                            <span class="cs-info-panel__log-date">{new Date(c.date).toLocaleDateString()}</span>
                                            <span class="cs-info-panel__log-actions">
                                                <button
                                                    class="cs-info-panel__action-btn"
                                                    title="View diff"
                                                    onClick={() => versions.viewDiff(c.commit_hash)}
                                                >
                                                    {versions.loadingDiffHash === c.commit_hash ? '...' : '\u0394'}
                                                </button>
                                                <button
                                                    class="cs-info-panel__action-btn cs-info-panel__action-btn--danger"
                                                    title="Revert to this commit"
                                                    onClick={() => versions.revert(c.commit_hash)}
                                                >
                                                    &#x21A9;
                                                </button>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {infoTab === 'calls' && (
                        <div class="cs-info-panel__content">
                            {totalCalls === 0 && <p class="cs-info-panel__empty">No calls yet.</p>}
                            {totalCalls > 0 && (
                                <>
                                    <div class="cs-info-panel__call-stats">
                                        <div class="cs-info-panel__stat">
                                            <span class="cs-info-panel__stat-value">{totalCalls}</span>
                                            <span class="cs-info-panel__stat-label">calls</span>
                                        </div>
                                        <div class="cs-info-panel__stat">
                                            <span class="cs-info-panel__stat-value">{formatNumber(totalInputTokens + totalOutputTokens)}</span>
                                            <span class="cs-info-panel__stat-label">tokens</span>
                                        </div>
                                        <div class="cs-info-panel__stat">
                                            <span class="cs-info-panel__stat-value">{formatDuration(totalDuration)}</span>
                                            <span class="cs-info-panel__stat-label">total</span>
                                        </div>
                                    </div>
                                    <div class="cs-info-panel__recent-calls">
                                        {recentCalls.map(call => (
                                            <div key={call.pk} class="cs-info-panel__recent-item">
                                                <span class={`cs-info-panel__call-status ${call.status === 'success' ? 'cs-info-panel__call-status--ok' : 'cs-info-panel__call-status--err'}`} />
                                                <span class="cs-info-panel__call-caller">{callerLabel(call.caller)}</span>
                                                <span class="cs-info-panel__call-duration">{formatDuration(call.duration_ms)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button class="cs-info-panel__view-all-btn" onClick={() => setShowCallModal(true)}>
                                        View All
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {assistantOpen ? (
                <AssistantPanel
                    open={assistantOpen}
                    onClose={() => setAssistantOpen(false)}
                    messages={chat.messages}
                    loading={chat.loading}
                    streamingContent={chat.streamingContent}
                    activity={chat.activity}
                    wizardActivity={wizard.wizardActivity}
                    aiQueue={wizard.aiQueue}
                    onRemoveFromAiQueue={wizard.removeFromAiQueue}
                    queue={chat.queue}
                    onSend={chat.send}
                    onStop={chat.stop}
                    onRemoveFromQueue={chat.removeFromQueue}
                    onNewChat={chat.newChat}
                    toolUpdates={chat.toolUpdates}
                    focusedItem={focusedItem}
                />
            ) : (
                <AssistantToggle onClick={() => setAssistantOpen(true)} />
            )}

            {showCallModal && createPortal(
                <CallDetailModal calls={callHistory} onClose={() => setShowCallModal(false)} />,
                document.body,
            )}
            {versions.selectedDiff && createPortal(
                <DiffModal diff={versions.selectedDiff} onClose={() => versions.setSelectedDiff(null)} />,
                document.body,
            )}
        </div>
    );
}
