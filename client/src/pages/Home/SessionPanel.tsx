import type { Model, SessionMeta } from './types';

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
    disabled: boolean;
};

export function SessionPanel({
    sessions, currentSessionId, onLoad, onDelete, onNew, onSave, saving,
    projectName, onProjectNameChange, cwd, onCwdChange,
    models, selectedModel, onModelChange, disabled,
}: Props) {
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


        </div>
    );
}
