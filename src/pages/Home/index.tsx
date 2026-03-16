import './style.css';
import { useEffect, useState } from 'preact/hooks';

type Model = { id: string; label: string; provider: string };
type Requirement = { title: string; definition: string; confidence: number };
type Task = { title: string; definition: string; hours: number; requirementIndex: number };

export function Home() {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState('anthropic:claude-haiku-4-5');
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loadingRequirements, setLoadingRequirements] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Requirement | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
    const [taskEditDraft, setTaskEditDraft] = useState<Task | null>(null);
    const [summary, setSummary] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);

    useEffect(() => {
        fetch('/api/models')
            .then(r => r.json())
            .then((data: Model[]) => {
                setModels(data);
                // if (data.length) setSelectedModel(data[0].id);
            })
            .catch(() => {});
    }, []);

    function handleRemoveRequirement(index: number) {
        setRequirements(prev => prev.filter((_, i) => i !== index));
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
        setRequirements(prev => prev.map((r, i) => i === editingIndex ? editDraft : r));
        setEditingIndex(null);
        setEditDraft(null);
    }

    function handleRemoveTask(index: number) {
        setTasks(prev => prev.filter((_, i) => i !== index));
    }

    function handleStartTaskEdit(index: number) {
        setEditingTaskIndex(index);
        setTaskEditDraft({ ...tasks[index] });
    }

    function handleCancelTaskEdit() {
        setEditingTaskIndex(null);
        setTaskEditDraft(null);
    }

    function handleSaveTaskEdit() {
        if (editingTaskIndex === null || !taskEditDraft) return;
        setTasks(prev => prev.map((t, i) => i === editingTaskIndex ? taskEditDraft : t));
        setEditingTaskIndex(null);
        setTaskEditDraft(null);
    }

    async function handleGenerateTasks() {
        if (!requirements.length || loadingTasks) return;

        setError('');
        setLoadingTasks(true);

        const isGenerateMore = tasks.length > 0;
        const body = {
            prompt: response,
            model: selectedModel,
            requirements,
            ...(isGenerateMore ? { existingTasks: tasks } : {}),
        };

        try {
            const res = await fetch('/api/streamtasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Server error: ${res.status}`);
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulated += decoder.decode(value);
            }

            const parsed = JSON.parse(accumulated);
            const newTasks: Task[] = Array.isArray(parsed) ? parsed : parsed.tasks ?? [];
            setTasks(prev => isGenerateMore ? [...prev, ...newTasks] : newTasks);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate tasks');
        } finally {
            setLoadingTasks(false);
        }
    }

    async function handleGenerateRequirements() {
        if (!response.trim() || loadingRequirements) return;

        setError('');
        setLoadingRequirements(true);

        const isGenerateMore = requirements.length > 0;
        const body = isGenerateMore
            ? { prompt: response, model: selectedModel, existingRequirements: requirements }
            : { prompt: response, model: selectedModel };

        try {
            const res = await fetch('/api/streamrequirements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Server error: ${res.status}`);
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulated += decoder.decode(value);
            }

            const parsed = JSON.parse(accumulated);
            const reqs: Requirement[] = Array.isArray(parsed) ? parsed : parsed.requirements ?? [];
            setRequirements(prev => isGenerateMore ? [...prev, ...reqs] : reqs);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate requirements');
        } finally {
            setLoadingRequirements(false);
        }
    }

    async function handleGenerateSummary() {
        if (!tasks.length || loadingSummary) return;

        setSummary('');
        setError('');
        setLoadingSummary(true);

        try {
            const res = await fetch('/api/streamsummary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: response, model: selectedModel, requirements, tasks }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Server error: ${res.status}`);
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setSummary(prev => prev + decoder.decode(value));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate summary');
        } finally {
            setLoadingSummary(false);
        }
    }

    async function handleGo() {
        if (!prompt.trim() || loading) return;

        setResponse('');
        setError('');
        setLoading(true);

        try {
            const res = await fetch('http://localhost:3001/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Server error: ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setResponse(prev => prev + decoder.decode(value));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div class="home">
            <label>Describe your goal. What do you want to build?</label>
            <textarea
                class="textarea"
                value={prompt}
                onInput={e => setPrompt(e.currentTarget.value)}
                placeholder="What is your goal?"
                disabled={loading}
            />
            <div class="controls">
                <select
                    class="model-select"
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.currentTarget.value)}
                    disabled={loading}
                >
                    {models.map(m => (
                        <option key={m.id} value={m.id}>{m.provider} — {m.label}</option>
                    ))}
                </select>
                <button class="button" onClick={handleGo} disabled={loading || !prompt.trim()}>
                    {loading ? 'Thinking…' : 'Go'}
                </button>
            </div>
            {error && <div class="error">{error}</div>}
            {response && (
                <>
                    <textarea class="textarea" value={response} readOnly />
                    <button
                        class="button"
                        onClick={handleGenerateRequirements}
                        disabled={loadingRequirements}
                    >
                        {loadingRequirements ? 'Generating…' : requirements.length > 0 ? 'Generate More' : 'Generate Requirements'}
                    </button>
                    {requirements.length > 0 && (
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
                                                    <button class="requirement-action requirement-action-remove" onClick={() => handleRemoveRequirement(i)} title="Remove">&times;</button>
                                                </div>
                                            </div>
                                            <p>{req.definition}</p>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {requirements.length > 0 && (
                        <>
                            <button
                                class="button"
                                onClick={handleGenerateTasks}
                                disabled={loadingTasks}
                            >
                                {loadingTasks ? 'Generating…' : tasks.length > 0 ? 'Generate More Tasks' : 'Generate Tasks'}
                            </button>
                            {tasks.length > 0 && (
                                <div class="tasks">
                                    <div class="tasks-header">
                                        <strong>Tasks</strong>
                                        <span class="tasks-total-hours">{tasks.reduce((sum, t) => sum + t.hours, 0)}h total</span>
                                    </div>
                                    {tasks.map((task, i) => (
                                        <div class="task" key={i}>
                                            {editingTaskIndex === i && taskEditDraft ? (
                                                <div class="requirement-edit">
                                                    <input
                                                        class="requirement-edit-input"
                                                        value={taskEditDraft.title}
                                                        onInput={e => setTaskEditDraft({ ...taskEditDraft, title: e.currentTarget.value })}
                                                        placeholder="Title"
                                                    />
                                                    <textarea
                                                        class="requirement-edit-textarea"
                                                        value={taskEditDraft.definition}
                                                        onInput={e => setTaskEditDraft({ ...taskEditDraft, definition: e.currentTarget.value })}
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
                                                                value={taskEditDraft.hours}
                                                                onInput={e => setTaskEditDraft({ ...taskEditDraft, hours: parseFloat(e.currentTarget.value) || 0 })}
                                                            />
                                                        </label>
                                                        <label class="task-edit-label">
                                                            Requirement:
                                                            <select
                                                                class="task-edit-select"
                                                                value={taskEditDraft.requirementIndex}
                                                                onChange={e => setTaskEditDraft({ ...taskEditDraft, requirementIndex: parseInt(e.currentTarget.value, 10) })}
                                                            >
                                                                {requirements.map((req, ri) => (
                                                                    <option key={ri} value={ri}>{req.title}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>
                                                    <div class="requirement-edit-actions">
                                                        <button class="button button-small" onClick={handleSaveTaskEdit}>Save</button>
                                                        <button class="button button-small button-secondary" onClick={handleCancelTaskEdit}>Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div class="requirement-header">
                                                        <strong>{task.title}</strong>
                                                        <div class="requirement-actions">
                                                            <span class="task-hours">{task.hours}h</span>
                                                            <button class="requirement-action" onClick={() => handleStartTaskEdit(i)} title="Edit">&#9998;</button>
                                                            <button class="requirement-action requirement-action-remove" onClick={() => handleRemoveTask(i)} title="Remove">&times;</button>
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
                            )}
                            {tasks.length > 0 && (
                                <>
                                    <button
                                        class="button"
                                        onClick={handleGenerateSummary}
                                        disabled={loadingSummary}
                                    >
                                        {loadingSummary ? 'Generating…' : 'Generate Summary'}
                                    </button>
                                    {summary && (
                                        <div class="summary">
                                            <strong>Roadmap Summary</strong>
                                            <div class="summary-content">{summary}</div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
