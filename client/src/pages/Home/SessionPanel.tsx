import { useState } from 'preact/hooks';
import type { Model, SessionMeta, ClaudeCall } from './types';

function callerLabel(caller: string): string {
    if (caller === 'streamQueryText') return 'Goal / Summary';
    if (caller === 'queryStructured') return 'Questions / Requirements / Tasks';
    return caller;
}

function formatDuration(ms: number | null): string {
    if (ms == null) return '—';
    return (ms / 1000).toFixed(1) + 's';
}

function formatTokens(input: number | null, output: number | null): string {
    const parts: string[] = [];
    if (input != null) parts.push(`${input} in`);
    if (output != null) parts.push(`${output} out`);
    return parts.length > 0 ? parts.join(' / ') : '—';
}

type Props = {
    sessions: SessionMeta[];
    currentSessionId: string | null;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
    onSave: () => void;
    saving: boolean;
    projectName: string;
    onProjectNameChange: (v: string) => void;
    cwd: string;
    onCwdChange: (v: string) => void;
    models: Model[];
    selectedModel: string;
    onModelChange: (v: string) => void;
    callHistory: ClaudeCall[];
    disabled: boolean;
};

export function SessionPanel({
    sessions, currentSessionId, onLoad, onDelete, onNew, onSave, saving,
    projectName, onProjectNameChange, cwd, onCwdChange,
    models, selectedModel, onModelChange, callHistory, disabled,
}: Props) {
    const [expandedCall, setExpandedCall] = useState<number | null>(null);

    return (
        <div class="sidebar-inner">
                        <div class="sidebar-section">
                <div class="session-panel-header">
                    <strong class="sidebar-section-title">Sessions</strong>
                    <div class="session-panel-actions">
                        <button class="button button-small" onClick={onNew}>New</button>

                    </div>
                </div>
                {sessions.length === 0 && <p class="session-empty">No saved sessions.</p>}
                <ul class="session-list">
                    {sessions.map(s => (
                        <li key={s.id} class={`session-item${s.id === currentSessionId ? ' session-item-active' : ''}`}>
                            <button class="session-item-name" onClick={() => onLoad(s.id)}>
                                {s.name}
                            </button>
                            <span class="session-item-date">{new Date(s.updatedAt).toLocaleDateString()}</span>
                            <button
                                class="session-item-delete"
                                onClick={() => onDelete(s.id)}
                                title="Delete session"
                            >×</button>
                        </li>
                    ))}
                </ul>
            </div>
            <div class="sidebar-section">
                <strong class="sidebar-section-title">Configuration</strong>
                <label class="sidebar-label">Project name</label>
                <input
                    class="sidebar-input"
                    type="text"
                    value={projectName}
                    onInput={e => onProjectNameChange(e.currentTarget.value)}
                    placeholder="My Project"
                    disabled={disabled}
                />
                <label class="sidebar-label">Project folder</label>
                <input
                    class="sidebar-input"
                    type="text"
                    value={cwd}
                    onInput={e => onCwdChange(e.currentTarget.value)}
                    placeholder="/path/to/project"
                    disabled={disabled}
                />
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
                <strong class="sidebar-section-title">LLM Calls</strong>
                {callHistory.length === 0 && <p class="session-empty">No calls yet.</p>}
                <div class="call-history">
                    {callHistory.map(call => {
                        const isExpanded = expandedCall === call.pk;
                        const promptPreview = call.prompt
                            ? (call.prompt.length > 80 ? call.prompt.slice(0, 80) + '\u2026' : call.prompt)
                            : '(no prompt)';
                        return (
                            <div
                                key={call.pk}
                                class="call-history-item"
                                onClick={() => setExpandedCall(isExpanded ? null : call.pk)}
                            >
                                <div class="call-history-header">
                                    <span class={`call-history-status ${call.status === 'success' ? 'call-history-status--ok' : 'call-history-status--err'}`} />
                                    <span class="call-history-caller">{callerLabel(call.caller)}</span>
                                </div>
                                <div class="call-history-meta">
                                    <span class="call-history-model">{call.model}</span>
                                    <span>{formatDuration(call.duration_ms)}</span>
                                    <span>{formatTokens(call.input_tokens, call.output_tokens)}</span>
                                </div>
                                {!isExpanded && (
                                    <div class="call-history-preview">{promptPreview}</div>
                                )}
                                {isExpanded && (
                                    <div class="call-history-full">{call.prompt ?? '(no prompt)'}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
