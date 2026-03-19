import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Model, SessionMeta, ClaudeCall } from './types';

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
    onSave: () => void;
    saving: boolean;
    models: Model[];
    selectedModel: string;
    onModelChange: (v: string) => void;
    callHistory: ClaudeCall[];
    disabled: boolean;
    assumptionCount: number;
    confirmedAssumptionCount: number;
    requirementCount: number;
    clarifyingRoundCount: number;
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

export function SessionPanel({
    sessions, currentSessionId, onLoad, onDelete, onNew, onSave, saving,
    models, selectedModel, onModelChange, callHistory, disabled,
    assumptionCount, confirmedAssumptionCount, requirementCount, clarifyingRoundCount,
}: Props) {
    const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
    const [showCallModal, setShowCallModal] = useState(false);

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
                        <button class="button button-small" onClick={onSave} disabled={saving}>
                            {saving ? 'Saving\u2026' : 'Save'}
                        </button>
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
        </div>
    );
}
