import { useState } from 'preact/hooks';
import type { Requirement } from './types';

interface Props {
    requirements: Requirement[];
    onUpdate: (requirements: Requirement[]) => void;
}

export function RequirementList({ requirements, onUpdate }: Props) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Requirement | null>(null);
    const [view, setView] = useState<'list' | 'table'>('list');

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
            <div class="requirements-view-toggle">
                <button
                    class={`view-toggle-btn ${view === 'list' ? 'view-toggle-btn--active' : ''}`}
                    onClick={() => setView('list')}
                >List</button>
                <button
                    class={`view-toggle-btn ${view === 'table' ? 'view-toggle-btn--active' : ''}`}
                    onClick={() => setView('table')}
                >Table</button>
            </div>

            {view === 'table' ? (
                <table class="requirements-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Title</th>
                            <th>Definition</th>
                            <th>Confidence</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {requirements.map((req, i) => (
                            <tr key={i}>
                                <td>{i + 1}</td>
                                <td><strong>{req.title}</strong></td>
                                <td>{req.definition}</td>
                                <td class="requirement-confidence">{Math.round(req.confidence * 100)}%</td>
                                <td class="requirements-table-actions">
                                    <button class="requirement-action" onClick={() => { setView('list'); handleStartEdit(i); }} title="Edit">&#9998;</button>
                                    <button class="requirement-action requirement-action-remove" onClick={() => handleRemove(i)} title="Remove">&times;</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                requirements.map((req, i) => (
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
                ))
            )}
        </div>
    );
}
