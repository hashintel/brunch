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
    const [adding, setAdding] = useState(false);
    const [addDraft, setAddDraft] = useState<Requirement>({ title: '', definition: '', confidence: 1 });

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

    function handleStartAdd() {
        setAdding(true);
        setAddDraft({ title: '', definition: '', confidence: 1 });
    }

    function handleCancelAdd() {
        setAdding(false);
        setAddDraft({ title: '', definition: '', confidence: 1 });
    }

    function handleSaveAdd() {
        if (!addDraft.title.trim()) return;
        onUpdate([...requirements, addDraft]);
        setAdding(false);
        setAddDraft({ title: '', definition: '', confidence: 1 });
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
                        {adding ? (
                            <tr>
                                <td>{requirements.length + 1}</td>
                                <td>
                                    <input
                                        class="requirement-edit-input"
                                        value={addDraft.title}
                                        onInput={e => setAddDraft({ ...addDraft, title: e.currentTarget.value })}
                                        placeholder="Title"
                                        style="width:100%"
                                    />
                                </td>
                                <td>
                                    <input
                                        class="requirement-edit-input"
                                        value={addDraft.definition}
                                        onInput={e => setAddDraft({ ...addDraft, definition: e.currentTarget.value })}
                                        placeholder="Definition"
                                        style="width:100%;font-weight:400"
                                    />
                                </td>
                                <td>100%</td>
                                <td class="requirements-table-actions">
                                    <button class="requirement-action" onClick={handleSaveAdd} title="Save">&#10003;</button>
                                    <button class="requirement-action requirement-action-remove" onClick={handleCancelAdd} title="Cancel">&times;</button>
                                </td>
                            </tr>
                        ) : (
                            <tr>
                                <td colspan={5}>
                                    <button class="requirement-add-btn" onClick={handleStartAdd}>+ Add requirement</button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            ) : (
                <>
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
                    {adding ? (
                        <div class="requirement">
                            <div class="requirement-edit">
                                <input
                                    class="requirement-edit-input"
                                    value={addDraft.title}
                                    onInput={e => setAddDraft({ ...addDraft, title: e.currentTarget.value })}
                                    placeholder="Title"
                                />
                                <textarea
                                    class="requirement-edit-textarea"
                                    value={addDraft.definition}
                                    onInput={e => setAddDraft({ ...addDraft, definition: e.currentTarget.value })}
                                    placeholder="Definition"
                                />
                                <div class="requirement-edit-actions">
                                    <button class="button button-small" onClick={handleSaveAdd}>Add</button>
                                    <button class="button button-small button-secondary" onClick={handleCancelAdd}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button class="requirement-add-btn" onClick={handleStartAdd}>+ Add requirement</button>
                    )}
                </>
            )}
        </div>
    );
}
