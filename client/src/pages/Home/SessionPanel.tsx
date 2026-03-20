import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Model, SessionMeta, ClaudeCall, DoltCommit, DoltDiffRow } from './types';
import type { SaveStatus } from './useAutoSave';
import type { VersionsHandle } from './useVersions';
import { Modal } from './Modal';

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
    versions: VersionsHandle;
    onVersionRevert: (hash: string) => void;
    onVersionCheckout: (hash: string) => void;
};

function CallDetailModal({ calls, onClose }: { calls: ClaudeCall[]; onClose: () => void }) {
    const [expandedPk, setExpandedPk] = useState<number | null>(null);

    return (
        <Modal title={`LLM Calls (${calls.length})`} onClose={onClose}>
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
        </Modal>
    );
}

/** Fields to hide from diffs — internal/noisy columns */
const DIFF_HIDDEN_FIELDS = new Set([
    'pk', 'diff_type', 'project_id', 'parent_id', 'sort_order', 'created_at', 'updated_at',
    'commit', 'commit_date',  // Dolt metadata columns from DOLT_DIFF
    'current_questions', 'current_answers', 'clarifying_state',  // transient/legacy blobs
]);

function toStr(val: unknown): string {
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function truncate(s: string, max = 120): string {
    return s.length > max ? s.slice(0, max) + '\u2026' : s;
}

function formatCellValue(val: unknown): string {
    const s = toStr(val);
    return s === '' ? '(empty)' : truncate(s);
}

/** Extract field names from a diff row (strips from_/to_ prefixes) */
function getFields(row: DoltDiffRow): string[] {
    const fields = new Set<string>();
    for (const k of Object.keys(row)) {
        if (k.startsWith('from_')) fields.add(k.slice(5));
        else if (k.startsWith('to_')) fields.add(k.slice(3));
    }
    return [...fields].filter(f => !DIFF_HIDDEN_FIELDS.has(f));
}

/** For added/removed rows, get the relevant values */
function getRowValues(row: DoltDiffRow, prefix: 'from' | 'to'): Array<{ field: string; value: string }> {
    return getFields(row)
        .map(f => ({ field: f, value: formatCellValue(row[`${prefix}_${f}`]) }))
        .filter(({ value }) => value !== '(empty)');
}

/** For modified rows, get only fields that changed (keeps raw values for text diff) */
function getModifiedFields(row: DoltDiffRow): Array<{ field: string; from: string; to: string; rawFrom: string; rawTo: string }> {
    return getFields(row)
        .filter(f => row[`from_${f}`] !== row[`to_${f}`])
        .map(f => {
            const rawFrom = toStr(row[`from_${f}`]);
            const rawTo = toStr(row[`to_${f}`]);
            return {
                field: f,
                from: rawFrom === '' ? '(empty)' : truncate(rawFrom),
                to: rawTo === '' ? '(empty)' : truncate(rawTo),
                rawFrom,
                rawTo,
            };
        });
}

/** Threshold: fields with combined text longer than this get an expandable word diff */
const LONG_TEXT_THRESHOLD = 100;

/** Simple word-level diff using LCS */
type DiffOp = { type: 'equal' | 'add' | 'remove'; text: string };

function wordDiff(a: string, b: string): DiffOp[] {
    const wordsA = a.split(/(\s+)/);
    const wordsB = b.split(/(\s+)/);
    const m = wordsA.length, n = wordsB.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = wordsA[i - 1] === wordsB[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    // Backtrack to produce ops
    const ops: DiffOp[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
            ops.push({ type: 'equal', text: wordsA[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.push({ type: 'add', text: wordsB[j - 1] });
            j--;
        } else {
            ops.push({ type: 'remove', text: wordsA[i - 1] });
            i--;
        }
    }
    ops.reverse();

    // Merge consecutive ops of the same type
    const merged: DiffOp[] = [];
    for (const op of ops) {
        const last = merged[merged.length - 1];
        if (last && last.type === op.type) {
            last.text += op.text;
        } else {
            merged.push({ ...op });
        }
    }
    return merged;
}

function InlineTextDiff({ from, to }: { from: string; to: string }) {
    const [expanded, setExpanded] = useState(false);

    if (!expanded) {
        return (
            <button class="diff-expand-btn" onClick={() => setExpanded(true)} title="Show full text diff">
                View diff
            </button>
        );
    }

    const ops = wordDiff(from, to);
    return (
        <div class="diff-text-inline">
            <button class="diff-expand-btn diff-expand-btn--close" onClick={() => setExpanded(false)}>
                Hide diff
            </button>
            <div class="diff-text-content">
                {ops.map((op, i) => (
                    <span key={i} class={op.type === 'equal' ? '' : op.type === 'add' ? 'diff-word-add' : 'diff-word-remove'}>
                        {op.text}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Human-readable label for a row — pick a recognizable identifier */
function rowLabel(row: DoltDiffRow): string | null {
    const prefix = row.diff_type === 'removed' || row.diff_type === 'deleted' ? 'from' : 'to';
    return (row[`${prefix}_title`] as string)
        || (row[`${prefix}_name`] as string)
        || (row[`${prefix}_text`] as string)?.slice(0, 50)
        || (row[`${prefix}_uuid`] as string)
        || null;
}

function DiffModal({ diff, onClose }: { diff: { tables: Record<string, DoltDiffRow[]>; from: string; to: string }; onClose: () => void }) {
    const tableNames = Object.keys(diff.tables);
    return (
        <Modal title={diff.from === 'HEAD' ? 'Uncommitted Changes' : `Diff ${diff.from?.slice(0, 7) ?? '?'} \u2192 ${diff.to?.slice(0, 7) ?? '?'}`} onClose={onClose}>
            {tableNames.length === 0 && <p class="session-empty">No changes in this commit.</p>}
            {tableNames.map(table => {
                const rows = diff.tables[table];
                const realCount = rows.filter(r =>
                    r.diff_type !== 'modified' || getModifiedFields(r).length > 0
                ).length;
                if (realCount === 0) return null;
                return (
                    <div key={table} class="diff-table-section">
                        <div class="diff-table-header">
                            <strong>{table}</strong>
                            <span class="diff-table-count">{realCount} change{realCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="diff-table-rows">
                            {rows.map((row, i) => {
                                const label = rowLabel(row);
                                if (row.diff_type === 'modified') {
                                    const changes = getModifiedFields(row);
                                    if (changes.length === 0) return null;
                                    return (
                                        <div key={i} class="diff-row diff-row--modified">
                                            <span class="diff-row-type">modified</span>
                                            <div class="diff-row-detail">
                                                {label && <div class="diff-row-label">{label}</div>}
                                                {changes.map(({ field, from, to, rawFrom, rawTo }) => {
                                                    const isLong = rawFrom.length + rawTo.length > LONG_TEXT_THRESHOLD;
                                                    return (
                                                        <div key={field} class="diff-field">
                                                            <div class="diff-field-header">
                                                                <span class="diff-field-name">{field}</span>
                                                                {!isLong && <span class="diff-field-from">{from}</span>}
                                                                {!isLong && <span class="diff-field-arrow">{'\u2192'}</span>}
                                                                {!isLong && <span class="diff-field-to">{to}</span>}
                                                                {isLong && <InlineTextDiff from={rawFrom} to={rawTo} />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                const isRemoved = row.diff_type === 'removed' || row.diff_type === 'deleted';
                                const values = getRowValues(row, isRemoved ? 'from' : 'to');
                                return (
                                    <div key={i} class={`diff-row diff-row--${row.diff_type}`}>
                                        <span class="diff-row-type">{row.diff_type}</span>
                                        <div class="diff-row-detail">
                                            {label && <div class="diff-row-label">{label}</div>}
                                            {values.map(({ field, value }) => (
                                                <div key={field} class="diff-field">
                                                    <span class="diff-field-name">{field}</span>
                                                    <span class={isRemoved ? 'diff-field-from' : 'diff-field-to'}>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </Modal>
    );
}

export function SessionPanel({
    sessions, currentSessionId, onLoad, onDelete, onNew, saveStatus,
    models, selectedModel, onModelChange, callHistory, disabled,
    versions, onVersionRevert, onVersionCheckout,
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
