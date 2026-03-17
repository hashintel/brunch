import type { SessionMeta } from './types';

type Props = {
    sessions: SessionMeta[];
    currentSessionId: string | null;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
    onSave: () => void;
    saving: boolean;
};

export function SessionPanel({ sessions, currentSessionId, onLoad, onDelete, onNew, onSave, saving }: Props) {
    return (
        <div class="session-panel">
            <div class="session-panel-header">
                <strong>Sessions</strong>
                <div class="session-panel-actions">
                    <button class="button button-small" onClick={onNew}>New</button>
                    <button class="button button-small" onClick={onSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
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
    );
}
