import './style.css';
import { useEffect, useState } from 'preact/hooks';
import type { Model, Requirement, Task } from './types';
import { RequirementList } from './RequirementList';
import { TaskList } from './TaskList';
import { SummarySection } from './SummarySection';

export function Home() {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState('anthropic:claude-haiku-4-5');
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loadingRequirements, setLoadingRequirements] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [summary, setSummary] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);

    useEffect(() => {
        fetch('/api/models')
            .then(r => r.json())
            .then((data: Model[]) => {
                setModels(data);
            })
            .catch(() => {});
    }, []);

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
                    {loading ? 'Thinking\u2026' : 'Go'}
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
                        {loadingRequirements ? 'Generating\u2026' : requirements.length > 0 ? 'Generate More' : 'Generate Requirements'}
                    </button>
                    {requirements.length > 0 && (
                        <RequirementList
                            requirements={requirements}
                            onUpdate={setRequirements}
                        />
                    )}
                    {requirements.length > 0 && (
                        <>
                            <button
                                class="button"
                                onClick={handleGenerateTasks}
                                disabled={loadingTasks}
                            >
                                {loadingTasks ? 'Generating\u2026' : tasks.length > 0 ? 'Generate More Tasks' : 'Generate Tasks'}
                            </button>
                            {tasks.length > 0 && (
                                <TaskList
                                    tasks={tasks}
                                    requirements={requirements}
                                    onUpdate={setTasks}
                                />
                            )}
                            {tasks.length > 0 && (
                                <SummarySection
                                    summary={summary}
                                    loading={loadingSummary}
                                    onGenerate={handleGenerateSummary}
                                />
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
