import { useState } from 'preact/hooks';
import type { Requirement } from './types';

interface Props {
    requirements: Requirement[];
    onUpdate: (requirements: Requirement[]) => void;
}

export function RequirementList({ requirements, onUpdate }: Props) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Requirement | null>(null);

    function handleRemove(index: number) {
        onUpdate(requirements.filter((_, i) => i !== index));
    }

    function handleStartEdit(index: number) {
        setEditingIndex(index);
        setEditDraft({ ...requirements[index] });
    }

    function handleCancelEdit() {
        setEditingIndex(null);
        setEditDraft(null);
    }

    function handleSaveEdit() {
        if (editingIndex === null || !editDraft) return;
        onUpdate(requirements.map((r, i) => i === editingIndex ? editDraft : r));
        setEditingIndex(null);
        setEditDraft(null);
    }

    return (
        <div class="requirements">
            {requirements.map((req, i) => (
                <div class="requirement" key={i}>
                    {editingIndex === i && editDraft ? (
                        <div class="requirement-edit">
                            <input
                                class="requirement-edit-input"
                                value={editDraft.title}
                                onInput={e => setEditDraft({ ...editDraft, title: e.currentTarget.value })}
                                placeholder="Title"
                            />
                            <textarea
                                class="requirement-edit-textarea"
                                value={editDraft.definition}
                                onInput={e => setEditDraft({ ...editDraft, definition: e.currentTarget.value })}
                                placeholder="Definition"
                            />
                            <div class="requirement-edit-actions">
                                <button class="button button-small" onClick={handleSaveEdit}>Save</button>
                                <button class="button button-small button-secondary" onClick={handleCancelEdit}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div class="requirement-header">
                                <strong>{req.title}</strong>
                                <div class="requirement-actions">
                                    <span class="requirement-confidence">{Math.round(req.confidence * 100)}%</span>
                                    <button class="requirement-action" onClick={() => handleStartEdit(i)} title="Edit">&#9998;</button>
                                    <button class="requirement-action requirement-action-remove" onClick={() => handleRemove(i)} title="Remove">&times;</button>
                                </div>
                            </div>
                            <p>{req.definition}</p>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
