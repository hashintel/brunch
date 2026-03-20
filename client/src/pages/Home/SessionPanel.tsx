import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Model, SessionMeta, ClaudeCall, DoltCommit, DoltChange, DoltDiffRow } from './types';
import type { SaveStatus } from './useAutoSave';

function callerLabel(caller: string): string {
    if (caller === 'streamQueryText') return 'Goal / Summary';
    if (caller === 'queryStructured') return 'Questions / Requirements / Tasks';
    return caller;
}

function formatDuration(ms: number | null): string {
    if (ms == null) return '\u2014';
    return (ms / 1000).toFixed(1) + 's';
}

function formatTokens(input: number | null, output: number | null): string {
    const parts: string[] = [];
    if (input != null) parts.push(`${input} in`);
    if (output != null) parts.push(`${output} out`);
    return parts.length > 0 ? parts.join(' / ') : '\u2014';
}

function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}

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
    assumptionCount: number;
    confirmedAssumptionCount: number;
    requirementCount: number;
    clarifyingRoundCount: number;
    // Version control
    versionCommits: DoltCommit[];
    versionChanges: DoltChange[];
    versionCommitMessage: string;
    onVersionCommitMessageChange: (v: string) => void;
    versionCommitting: boolean;
    onVersionCommit: (msg: string) => void;
    onVersionViewDiff: (hash: string) => void;
    onVersionRevert: (hash: string) => void;
    versionSelectedDiff: { tables: Record<string, DoltDiffRow[]>; from: string; to: string } | null;
    onVersionCloseDiff: () => void;
    versionLoadingDiffHash: string | null;
    // Checkout (time-travel)
    versionCheckedOutHash: string | null;
    versionLoadingCheckoutHash: string | null;
    onVersionCheckout: (hash: string) => void;
};

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: any }) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div class="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div class="modal" style="width: 1000px; max-width: 95vw;">
                <div class="modal-header">
                    <strong>{title}</strong>
                    <button class="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div class="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}

function CallDetailModal({ calls, onClose }: { calls: ClaudeCall[]; onClose: () => void }) {
    const [expandedPk, setExpandedPk] = useState<number | null>(null);

    return (
        <ModalShell title={`LLM Calls (${calls.length})`} onClose={onClose}>
            {calls.length === 0 && <p class="session-empty">No calls recorded.</p>}
            <div class="call-modal-list">
                {calls.map(call => {
                    const isExpanded = expandedPk === call.pk;
                    return (
                        <div key={call.pk} class="call-modal-row" onClick={() => setExpandedPk(isExpanded ? null : call.pk)}>
                            <div class="call-modal-row-summary">
                                <span class={`call-history-status ${call.status === 'success' ? 'call-history-status--ok' : 'call-history-status--err'}`} />
                                <span class="call-modal-caller">{callerLabel(call.caller)}</span>
                                <span class="call-history-model">{call.model}</span>
                                <span class="call-modal-stat">{formatDuration(call.duration_ms)}</span>
                                <span class="call-modal-stat">{formatTokens(call.input_tokens, call.output_tokens)}</span>
                                <span class="call-modal-time">{new Date(call.created_at).toLocaleString()}</span>
                                <span class="call-modal-chevron">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                            </div>
                            {isExpanded && (
                                <div class="call-modal-detail" onClick={e => e.stopPropagation()}>
                                    {call.error && (
                                        <div class="call-modal-error">
                                            <strong>Error:</strong> {call.error}
                                        </div>
                                    )}
                                    <div class="call-modal-section">
                                        <strong class="call-modal-section-title">Prompt</strong>
                                        <div class="call-modal-content">{call.prompt ?? '(no prompt)'}</div>
                                    </div>
                                    <div class="call-modal-section">
                                        <strong class="call-modal-section-title">Response</strong>
                                        <div class="call-modal-content">{call.response ?? '(no response)'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </ModalShell>
    );
}

function DiffModal({ diff, onClose }: { diff: { tables: Record<string, DoltDiffRow[]>; from: string; to: string }; onClose: () => void }) {
    const tableNames = Object.keys(diff.tables);
    return (
        <ModalShell title={`Diff ${diff.from?.slice(0, 7) ?? '?'} → ${diff.to?.slice(0, 7) ?? '?'}`} onClose={onClose}>
            {tableNames.length === 0 && <p class="session-empty">No changes in this commit.</p>}
            {tableNames.map(table => {
                const rows = diff.tables[table];
                return (
                    <div key={table} class="diff-table-section">
                        <div class="diff-table-header">
                            <strong>{table}</strong>
                            <span class="diff-table-count">{rows.length} change{rows.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="diff-table-rows">
                            {rows.map((row, i) => (
                                <div key={i} class={`diff-row diff-row--${row.diff_type}`}>
                                    <span class="diff-row-type">{row.diff_type}</span>
                                    <span class="diff-row-detail">
                                        {row.diff_type === 'modified'
                                            ? Object.keys(row)
                                                .filter(k => k.startsWith('from_') && row[k] !== row[k.replace('from_', 'to_')])
                                                .map(k => {
                                                    const field = k.replace('from_', '');
                                                    const from = String(row[k] ?? '').slice(0, 80);
                                                    const to = String(row[k.replace('from_', 'to_')] ?? '').slice(0, 80);
                                                    return `${field}: ${from} → ${to}`;
                                                })
                                                .join('; ') || '(no visible changes)'
                                            : Object.keys(row)
                                                .filter(k => k.startsWith('to_') && row[k] != null)
                                                .map(k => `${k.replace('to_', '')}: ${String(row[k]).slice(0, 80)}`)
                                                .join('; ') || JSON.stringify(row).slice(0, 200)
                                        }
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </ModalShell>
    );
}

export function SessionPanel({
    sessions, currentSessionId, onLoad, onDelete, onNew, saveStatus,
    models, selectedModel, onModelChange, callHistory, disabled,
    assumptionCount, confirmedAssumptionCount, requirementCount, clarifyingRoundCount,
    versionCommits, versionChanges, versionCommitMessage, onVersionCommitMessageChange,
    versionCommitting, onVersionCommit, onVersionViewDiff, onVersionRevert,
    versionSelectedDiff, onVersionCloseDiff, versionLoadingDiffHash,
    versionCheckedOutHash, versionLoadingCheckoutHash, onVersionCheckout,
}: Props) {
    const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
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

                    <div class="sidebar-section">
                        <strong class="sidebar-section-title">Stats</strong>
                        <div class="project-stats">
                            <div class="project-stat">
                                <span class="project-stat-value">{confirmedAssumptionCount}/{assumptionCount}</span>
                                <span class="project-stat-label">Assumptions</span>
                            </div>
                            <div class="project-stat">
                                <span class="project-stat-value">{requirementCount}</span>
                                <span class="project-stat-label">Requirements</span>
                            </div>
                            <div class="project-stat">
                                <span class="project-stat-value">{clarifyingRoundCount}</span>
                                <span class="project-stat-label">Rounds</span>
                            </div>
                        </div>
                    </div>

                    <div class="sidebar-section">
                        <strong class="sidebar-section-title">Version History</strong>
                        {versionChanges.length > 0 && (
                            <div class="version-uncommitted">
                                <span class="version-status-badge">{versionChanges.length} uncommitted change{versionChanges.length !== 1 ? 's' : ''}</span>
                                <div class="version-uncommitted-list">
                                    {versionChanges.map(c => (
                                        <div key={c.table_name} class="version-uncommitted-item">
                                            <span class={`version-uncommitted-status version-uncommitted-status--${c.status}`}>{c.status}</span>
                                            <span class="version-uncommitted-table">{c.table_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div class="version-commit-form">
                            <input
                                class="sidebar-input"
                                type="text"
                                placeholder="Commit message..."
                                value={versionCommitMessage}
                                onInput={e => onVersionCommitMessageChange(e.currentTarget.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && versionCommitMessage.trim()) onVersionCommit(versionCommitMessage); }}
                                disabled={versionCommitting || !!versionCheckedOutHash}
                            />
                            <button
                                class="button button-small"
                                onClick={() => onVersionCommit(versionCommitMessage)}
                                disabled={versionCommitting || !versionCommitMessage.trim() || !!versionCheckedOutHash}
                            >
                                {versionCommitting ? '...' : 'Commit'}
                            </button>
                        </div>
                        {versionCommits.length === 0 && <p class="session-empty">No commits yet.</p>}
                        {versionCommits.length > 0 && (
                            <div class="version-log">
                                {versionCommits.slice(0, 8).map(c => {
                                    const isChecked = versionCheckedOutHash === c.commit_hash;
                                    const isLoadingCheckout = versionLoadingCheckoutHash === c.commit_hash;
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
                                                <button class="requirement-action" title="View diff" onClick={() => onVersionViewDiff(c.commit_hash)}>
                                                    {versionLoadingDiffHash === c.commit_hash ? '...' : '\u0394'}
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
                </>
            )}

            {showCallModal && createPortal(
                <CallDetailModal calls={callHistory} onClose={() => setShowCallModal(false)} />,
                document.body,
            )}
            {versionSelectedDiff && createPortal(
                <DiffModal diff={versionSelectedDiff} onClose={onVersionCloseDiff} />,
                document.body,
            )}
        </div>
    );
}
