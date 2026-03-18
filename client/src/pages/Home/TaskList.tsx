import { useState } from 'preact/hooks';
import type { Task, Requirement } from './types';

interface Props {
    tasks: Task[];
    requirements: Requirement[];
    onUpdate: (tasks: Task[]) => void;
}

export function TaskList({ tasks, requirements, onUpdate }: Props) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Task | null>(null);

    function handleRemove(index: number) {
        onUpdate(tasks.filter((_, i) => i !== index));
    }

    function handleStartEdit(index: number) {
        setEditingIndex(index);
        setEditDraft({ ...tasks[index] });
    }

    function handleCancelEdit() {
        setEditingIndex(null);
        setEditDraft(null);
    }

    function handleSaveEdit() {
        if (editingIndex === null || !editDraft) return;
        onUpdate(tasks.map((t, i) => i === editingIndex ? editDraft : t));
        setEditingIndex(null);
        setEditDraft(null);
    }

    return (
        <div class="tasks">
            {tasks.map((task, i) => (
                <div class="task" key={i}>
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
                            <div class="task-edit-row">
                                <label class="task-edit-label">
                                    Hours:
                                    <input
                                        class="task-edit-hours"
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={editDraft.hours}
                                        onInput={e => setEditDraft({ ...editDraft, hours: parseFloat(e.currentTarget.value) || 0 })}
                                    />
                                </label>
                                <label class="task-edit-label">
                                    Requirement:
                                    <select
                                        class="task-edit-select"
                                        value={editDraft.requirementIndex}
                                        onChange={e => setEditDraft({ ...editDraft, requirementIndex: parseInt(e.currentTarget.value, 10) })}
                                    >
                                        {requirements.map((req, ri) => (
                                            <option key={ri} value={ri}>{req.title}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div class="requirement-edit-actions">
                                <button class="button button-small" onClick={handleSaveEdit}>Save</button>
                                <button class="button button-small button-secondary" onClick={handleCancelEdit}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div class="requirement-header">
                                <strong>{task.title}</strong>
                                <div class="requirement-actions">
                                    <span class="task-hours">{task.hours}h</span>
                                    <button class="requirement-action" onClick={() => handleStartEdit(i)} title="Edit">&#9998;</button>
                                    <button class="requirement-action requirement-action-remove" onClick={() => handleRemove(i)} title="Remove">&times;</button>
                                </div>
                            </div>
                            <p>{task.definition}</p>
                            <span class="task-requirement-tag">
                                {requirements[task.requirementIndex]?.title ?? 'Unknown requirement'}
                            </span>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
