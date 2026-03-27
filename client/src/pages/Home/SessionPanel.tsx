import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Model, SessionMeta, ClaudeCall, DoltDiffRow } from './types';
import type { SaveStatus } from './useAutoSave';
import type { VersionsHandle } from './useVersions';
import { CallDetailModal, callerLabel, formatDuration, formatNumber } from '../../shared/CallDetailModal';
import { DiffModal } from '../../shared/DiffModal';


type Props = {
    sessions: SessionMeta[];
    currentSessionId: string | null;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
    saveStatus: SaveStatus;
    models: Model[];
    selectedModel: string;
    onModelChange: (v: string) => void;
    callHistory: ClaudeCall[];
    disabled: boolean;
    versions: VersionsHandle;
    onVersionRevert: (hash: string) => void;
    onVersionCheckout: (hash: string) => void;
    specProgress: number;
    specLoading: boolean;
    projectName: string;
    onProjectNameChange: (v: string) => void;
    cwd: string;
    onCwdChange: (v: string) => void;
    isCheckedOut: boolean;
};



export function SessionPanel({
    sessions, currentSessionId, onLoad, onDelete, onNew, saveStatus,
    models, selectedModel, onModelChange, callHistory, disabled,
    versions, onVersionRevert, onVersionCheckout,
    specProgress, specLoading,
    projectName, onProjectNameChange, cwd, onCwdChange, isCheckedOut,
}: Props) {
    const [activeTab, setActiveTab] = useState<'list' | 'detail'>(currentSessionId ? 'detail' : 'list');
    const [showCallModal, setShowCallModal] = useState(false);
    const prevSessionId = useRef(currentSessionId);

    // Switch to detail tab when a project is created (null → id)
    useEffect(() => {
        if (prevSessionId.current === null && currentSessionId !== null) {
            setActiveTab('detail');
        }
        prevSessionId.current = currentSessionId;
    }, [currentSessionId]);

    // Compute summary stats
    const totalCalls = callHistory.length;
    const totalInputTokens = callHistory.reduce((sum, c) => sum + (c.input_tokens ?? 0), 0);
    const totalOutputTokens = callHistory.reduce((sum, c) => sum + (c.output_tokens ?? 0), 0);
    const totalDuration = callHistory.reduce((sum, c) => sum + (c.duration_ms ?? 0), 0);
    const recentCalls = callHistory.slice(0, 3);

    function handleLoad(id: string) {
        onLoad(id);
        setActiveTab('detail');
    }

    function handleNew() {
        onNew();
        setActiveTab('list');
    }

    return (
        <div class="sidebar-inner">
            <div class="sidebar-tabs">
                <button
                    class={`sidebar-tab${activeTab === 'list' ? ' sidebar-tab--active' : ''}`}
                    onClick={() => setActiveTab('list')}
                >
                    Projects
                </button>
                <button
                    class={`sidebar-tab${activeTab === 'detail' ? ' sidebar-tab--active' : ''}`}
                    onClick={() => setActiveTab('detail')}
                >
                    Detail
                </button>
            </div>

            {activeTab === 'list' && (
                <div class="sidebar-section">
                    <div class="session-panel-header">
                        <strong class="sidebar-section-title">Projects</strong>
                        <div class="session-panel-actions">
                            <button class="button button-small" onClick={handleNew}>New</button>
                        </div>
                    </div>
                    {sessions.length === 0 && <p class="session-empty">No saved projects.</p>}
                    <ul class="session-list">
                        {sessions.map(s => (
                            <li key={s.id} class={`session-item${s.id === currentSessionId ? ' session-item-active' : ''}`}>
                                <button class="session-item-name" onClick={() => handleLoad(s.id)}>
                                    {s.name}
                                </button>
                                <span class="session-item-date">{new Date(s.updatedAt).toLocaleDateString()}</span>
                                <button
                                    class="session-item-delete"
                                    onClick={() => onDelete(s.id)}
                                    title="Delete project"
                                >×</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {activeTab === 'detail' && (
                <>
                    <div class="sidebar-section">
                        <strong class="sidebar-section-title">Project</strong>
                        <input
                            class="sidebar-input"
                            type="text"
                            value={projectName}
                            onInput={e => onProjectNameChange(e.currentTarget.value)}
                            placeholder="Project name"
                            disabled={isCheckedOut}
                        />
                        <input
                            class="sidebar-input"
                            type="text"
                            value={cwd}
                            onInput={e => onCwdChange(e.currentTarget.value)}
                            placeholder="Project folder (optional)"
                            disabled={isCheckedOut}
                        />
                    </div>

                    <div class="sidebar-section">
                        <strong class="sidebar-section-title">Configuration</strong>
                        <label class="sidebar-label">Model</label>
                        <select
                            class="sidebar-select"
                            value={selectedModel}
                            onChange={e => onModelChange(e.currentTarget.value)}
                            disabled={disabled}
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id}>{m.provider} — {m.label}</option>
                            ))}
                        </select>
                        <span class={`save-status save-status--${saveStatus}`}>
                            {saveStatus === 'saving' ? 'Saving\u2026' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'unsaved' ? 'Unsaved changes' : ''}
                        </span>
                    </div>

                    {(specProgress > 0 || specLoading) && (
                        <div class="sidebar-section">
                            <strong class="sidebar-section-title">Spec Progress</strong>
                            <div class="spec-progress-bar">
                                <div
                                    class={`spec-progress-fill ${specLoading ? 'spec-progress-fill--loading' : ''}`}
                                    style={{ width: `${specProgress}%` }}
                                />
                            </div>
                            <span class="spec-progress-label">
                                {specLoading ? 'Generating...' : `${specProgress}%`}
                            </span>
                        </div>
                    )}

                    <div class="sidebar-section">
                        <strong class="sidebar-section-title">LLM Calls</strong>
                        {totalCalls === 0 && <p class="session-empty">No calls yet.</p>}
                        {totalCalls > 0 && (
                            <>
                                <div class="call-summary-stats">
                                    <div class="call-summary-stat">
                                        <span class="call-summary-stat-value">{totalCalls}</span>
                                        <span class="call-summary-stat-label">calls</span>
                                    </div>
                                    <div class="call-summary-stat">
                                        <span class="call-summary-stat-value">{formatNumber(totalInputTokens + totalOutputTokens)}</span>
                                        <span class="call-summary-stat-label">tokens</span>
                                    </div>
                                    <div class="call-summary-stat">
                                        <span class="call-summary-stat-value">{formatDuration(totalDuration)}</span>
                                        <span class="call-summary-stat-label">total</span>
                                    </div>
                                </div>
                                <div class="call-summary-recent">
                                    {recentCalls.map(call => (
                                        <div key={call.pk} class="call-summary-recent-item">
                                            <span class={`call-history-status ${call.status === 'success' ? 'call-history-status--ok' : 'call-history-status--err'}`} />
                                            <span class="call-summary-recent-caller">{callerLabel(call.caller)}</span>
                                            <span class="call-summary-recent-duration">{formatDuration(call.duration_ms)}</span>
                                        </div>
                                    ))}
                                </div>
                                <button class="button button-small button-secondary" onClick={() => setShowCallModal(true)}>
                                    View All
                                </button>
                            </>
                        )}
                    </div>

                    <div class="sidebar-section">
                        <strong class="sidebar-section-title">Version History</strong>
                        {versions.realChangeCount > 0 && (
                            <div class="version-uncommitted">
                                <button
                                    class="version-uncommitted-btn"
                                    onClick={versions.viewWorkingDiff}
                                    title="View uncommitted changes"
                                >
                                    <span class="version-status-badge">
                                        {`${versions.realChangeCount} uncommitted change${versions.realChangeCount !== 1 ? 's' : ''}`}
                                    </span>
                                    <span class="version-uncommitted-tables">
                                        {versions.changedTableNames.join(', ')}
                                    </span>
                                </button>
                            </div>
                        )}
                        <div class="version-commit-form">
                            <input
                                class="sidebar-input"
                                type="text"
                                placeholder="Commit message..."
                                value={versions.commitMessage}
                                onInput={e => versions.setCommitMessage(e.currentTarget.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && versions.commitMessage.trim()) versions.commit(versions.commitMessage); }}
                                disabled={versions.committing || !!versions.checkedOutHash}
                            />
                            <button
                                class="button button-small"
                                onClick={() => versions.commit(versions.commitMessage)}
                                disabled={versions.committing || !versions.commitMessage.trim() || !!versions.checkedOutHash}
                            >
                                {versions.committing ? '...' : 'Commit'}
                            </button>
                        </div>
                        {versions.commits.length === 0 && <p class="session-empty">No commits yet.</p>}
                        {versions.commits.length > 0 && (
                            <div class="version-log">
                                {versions.commits.slice(0, 8).map(c => {
                                    const isChecked = versions.checkedOutHash === c.commit_hash;
                                    const isLoadingCheckout = versions.loadingCheckoutHash === c.commit_hash;
                                    return (
                                        <div key={c.commit_hash} class={`version-log-item${isChecked ? ' version-log-item--checked-out' : ''}`}>
                                            <span class="version-log-hash">{c.commit_hash.slice(0, 7)}</span>
                                            <span class="version-log-message">{c.message}</span>
                                            <span class="version-log-date">{new Date(c.date).toLocaleDateString()}</span>
                                            <span class="version-log-actions">
                                                <button
                                                    class={`requirement-action${isChecked ? ' requirement-action--active' : ''}`}
                                                    title={isChecked ? 'Exit checkout' : 'View at this version'}
                                                    onClick={() => onVersionCheckout(c.commit_hash)}
                                                >
                                                    {isLoadingCheckout ? '...' : isChecked ? '\u25C9' : '\u25CB'}
                                                </button>
                                                <button class="requirement-action" title="View diff" onClick={() => versions.viewDiff(c.commit_hash)}>
                                                    {versions.loadingDiffHash === c.commit_hash ? '...' : '\u0394'}
                                                </button>
                                                <button class="requirement-action requirement-action-remove" title="Revert to this commit" onClick={() => onVersionRevert(c.commit_hash)}>
                                                    &#x21A9;
                                                </button>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
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
