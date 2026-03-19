import { useState } from 'preact/hooks';
import type { Assumption } from './types';
import { LoadingIndicator } from '../../components/LoadingIndicator';

type Props = {
    assumptions: Assumption[];
    onUpdate: (assumptions: Assumption[]) => void;
    onDone: () => void;
    onRegenerate: () => void;
    loading: boolean;
    done: boolean;
};

function badgeClass(level: string): string {
    return `assumption-badge assumption-badge--${level}`;
}

export function AssumptionReview({ assumptions, onUpdate, onDone, onRegenerate, loading, done }: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const reviewed = assumptions.filter(a => a.status !== 'pending').length;

    function updateOne(id: string, updater: (a: Assumption) => Assumption) {
        onUpdate(assumptions.map(a => a.id === id ? updater(a) : a));
    }

    function handleConfirm(id: string) {
        updateOne(id, a => ({ ...a, status: 'confirmed' }));
        setEditingId(null);
    }

    function handleReject(id: string) {
        updateOne(id, a => ({ ...a, status: 'rejected' }));
        setEditingId(null);
    }

    function handleStartEdit(a: Assumption) {
        setEditingId(a.id);
        setEditText(a.editedText ?? a.text);
    }

    function handleSaveEdit(id: string) {
        updateOne(id, a => ({ ...a, status: 'edited', editedText: editText }));
        setEditingId(null);
    }

    function handleCancelEdit() {
        setEditingId(null);
    }

    if (loading) {
        return <LoadingIndicator message="Generating assumptions" />;
    }

    const pending = assumptions.filter(a => a.status === 'pending').length;

    if (assumptions.length === 0) {
        return (
            <div class="assumption-review">
                <div class="assumption-empty">
                    No assumptions generated yet.
                </div>
                <div class="assumption-footer">
                    <button class="button" onClick={onRegenerate} disabled={loading}>
                        Generate Assumptions
                    </button>
                    <button class="button button-secondary" onClick={onDone}>
                        Skip to Requirements
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div class="assumption-review">
            <div class="assumption-summary">
                {reviewed}/{assumptions.length} reviewed
            </div>

            <div class="assumption-list">
                {assumptions.map(a => (
                    <div key={a.id} class={`assumption-card assumption-card--${a.status}`}>
                        <div class="assumption-card-header">
                            <div class="assumption-badges">
                                <span class={badgeClass(a.confidence)} title="Confidence">
                                    {a.confidence}
                                </span>
                                <span class={badgeClass(a.impact)} title="Impact">
                                    {a.impact} impact
                                </span>
                            </div>
                            {a.status !== 'pending' && (
                                <span class={`assumption-status assumption-status--${a.status}`}>
                                    {a.status}
                                </span>
                            )}
                        </div>

                        {editingId === a.id ? (
                            <div class="assumption-edit">
                                <textarea
                                    class="assumption-edit-textarea"
                                    value={editText}
                                    onInput={e => setEditText(e.currentTarget.value)}
                                />
                                <div class="assumption-edit-actions">
                                    <button class="button button-small" onClick={() => handleSaveEdit(a.id)}>
                                        Save
                                    </button>
                                    <button class="button button-small button-secondary" onClick={handleCancelEdit}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div class="assumption-card-text">
                                {a.status === 'edited' && a.editedText ? a.editedText : a.text}
                            </div>
                        )}

                        <div class="assumption-card-rationale">{a.rationale}</div>

                        {editingId !== a.id && (
                            <div class="assumption-actions">
                                <button
                                    class={`assumption-action-btn assumption-action-btn--confirm ${a.status === 'confirmed' ? 'assumption-action-btn--active' : ''}`}
                                    onClick={() => handleConfirm(a.id)}
                                >
                                    Confirm
                                </button>
                                <button
                                    class="assumption-action-btn assumption-action-btn--edit"
                                    onClick={() => handleStartEdit(a)}
                                >
                                    Edit
                                </button>
                                <button
                                    class={`assumption-action-btn assumption-action-btn--reject ${a.status === 'rejected' ? 'assumption-action-btn--active' : ''}`}
                                    onClick={() => handleReject(a.id)}
                                >
                                    Reject
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {!done && (
                <div class="assumption-footer">
                    {pending > 0 && (
                        <span class="assumption-pending-warning">
                            {pending} assumption{pending !== 1 ? 's' : ''} still pending
                        </span>
                    )}
                    <button class="button" onClick={onDone}>
                        Proceed to Requirements
                    </button>
                    <button
                        class="button button-small button-secondary"
                        onClick={onRegenerate}
                        disabled={loading}
                    >
                        Regenerate
                    </button>
                </div>
            )}
        </div>
    );
}
