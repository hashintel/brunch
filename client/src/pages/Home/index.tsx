import './style.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Model, Requirement, Task, SessionMeta, Session, ClarifyingQuestion, ClarifyingAnswer, ClarifyingRound, ClaudeCall } from './types';
import { RequirementList } from './RequirementList';
import { TaskList } from './TaskList';
import { SummarySection } from './SummarySection';
import { SessionPanel } from './SessionPanel';
import { ClarifyingQuestions } from './ClarifyingQuestions';

const STEPS = ['Goal', 'Requirements', 'Tasks', 'Summary'] as const;

export function Home() {
    const [projectName, setProjectName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [cwd, setCwd] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loadingRequirements, setLoadingRequirements] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [summary, setSummary] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);

    const [clarifyingRounds, setClarifyingRounds] = useState<ClarifyingRound[]>([]);
    const [currentQuestions, setCurrentQuestions] = useState<ClarifyingQuestion[]>([]);
    const [currentAnswers, setCurrentAnswers] = useState<ClarifyingAnswer[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [clarifyingDone, setClarifyingDone] = useState(false);

    const [sessions, setSessions] = useState<SessionMeta[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([0]));
    const [callHistory, setCallHistory] = useState<ClaudeCall[]>([]);
    const goalTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize the goal textarea as content streams in
    useEffect(() => {
        const el = goalTextareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [prompt]);

    async function refreshCallHistory() {
        try {
            const res = await fetch('/api/history/claude?limit=50');
            const data = await res.json();
            setCallHistory(data.rows);
        } catch {}
    }

    // Derive step statuses (4 steps: Goal, Requirements, Tasks, Summary)
    const stepCompleted = [
        clarifyingDone,
        requirements.length > 0,
        tasks.length > 0,
        summary.length > 0,
    ];
    const stepActive = [
        true,
        clarifyingDone,
        requirements.length > 0,
        tasks.length > 0,
    ];

    const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);

    // Auto-open sections as they become active
    useEffect(() => {
        setOpenSections(prev => {
            const next = new Set(prev);
            for (let i = 0; i < 4; i++) {
                if (stepActive[i] && !stepCompleted[i]) next.add(i);
            }
            return next;
        });
    }, [response, clarifyingDone, requirements.length, tasks.length, summary]);

    function toggleSection(index: number) {
        setOpenSections(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
        fetch('/api/sessions').then(r => r.json()).then(setSessions).catch(() => {});
    }, []);

    async function refreshSessions() {
        const res = await fetch('/api/sessions');
        setSessions(await res.json());
    }

    async function handleSave() {
        setSaving(true);
        try {
            const body = { prompt, cwd, response, selectedModel, clarifyingRounds, clarifyingDone, requirements, tasks, summary };
            if (currentSessionId) {
                const res = await fetch(`/api/sessions/${currentSessionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) throw new Error('Failed to save');
            } else {
                const name = window.prompt('Session name:', prompt.slice(0, 60) || 'Untitled');
                if (!name) { setSaving(false); return; }
                body.name = name;
                const res = await fetch('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) throw new Error('Failed to save');
                const created: Session = await res.json();
                setCurrentSessionId(created.id);
            }
            await refreshSessions();
        } catch {
            setError('Failed to save session');
        } finally {
            setSaving(false);
        }
    }

    async function handleLoadSession(id: string) {
        try {
            const res = await fetch(`/api/sessions/${id}`);
            if (!res.ok) throw new Error();
            const s: Session = await res.json();
            setPrompt(s.prompt);
            setCwd(s.cwd ?? '');
            setResponse(s.response);
            setSelectedModel(s.selectedModel);
            setClarifyingRounds(s.clarifyingRounds ?? []);
            setClarifyingDone((s as any).clarifyingDone ?? (s.clarifyingRounds?.length > 0));
            setCurrentQuestions([]);
            setCurrentAnswers([]);
            setRequirements(s.requirements);
            setTasks(s.tasks);
            setSummary(s.summary);
            setCurrentSessionId(s.id);
            setError('');
        } catch {
            setError('Failed to load session');
        }
    }

    async function handleDeleteSession(id: string) {
        if (!window.confirm('Delete this session?')) return;
        try {
            await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
            if (currentSessionId === id) setCurrentSessionId(null);
            await refreshSessions();
        } catch {
            setError('Failed to delete session');
        }
    }

    function handleNewSession() {
        setProjectName('');
        setPrompt('');
        setCwd('');
        setResponse('');
        setClarifyingRounds([]);
        setCurrentQuestions([]);
        setCurrentAnswers([]);
        setClarifyingDone(false);
        setRequirements([]);
        setTasks([]);
        setSummary('');
        setError('');
        setCurrentSessionId(null);
    }

    async function handleGo() {
        if (!prompt.trim() || loading) return;

        setResponse('');
        setError('');
        setLoading(true);
        setPrompt('');

        let fullText = '';
        try {
            const res = await fetch('http://localhost:3001/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, cwd: cwd || undefined }),
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
                const chunk = decoder.decode(value);
                fullText += chunk;
                setPrompt(prev => prev + chunk);
            }

            setResponse(fullText);
            // Auto-trigger clarifying questions after goal generation
            await generateQuestions(fullText);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong');
        } finally {
            setLoading(false);
            await refreshCallHistory();
        }
    }

    async function generateQuestions(responseText?: string) {
        const text = responseText ?? response;
        if (!text.trim() || loadingQuestions) return;

        setError('');
        setLoadingQuestions(true);

        try {
            const res = await fetch('/api/clarifyingquestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: text,
                    model: selectedModel,
                    cwd: cwd || undefined,
                    previousRounds: clarifyingRounds.length > 0 ? clarifyingRounds : undefined,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Server error: ${res.status}`);
            }

            const data = await res.json();
            if (data.done || !data.questions?.length) {
                setClarifyingDone(true);
                setCurrentQuestions([]);
                setCurrentAnswers([]);
            } else {
                setCurrentQuestions(data.questions);
                setCurrentAnswers(data.questions.map(() => ({ selectedLabels: [], otherText: '', skipped: false })));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate questions');
        } finally {
            setLoadingQuestions(false);
            await refreshCallHistory();
        }
    }

    function handleUpdateAnswer(index: number, answer: ClarifyingAnswer) {
        setCurrentAnswers(prev => {
            const next = [...prev];
            next[index] = answer;
            return next;
        });
    }

    async function handleSubmitAnswers() {
        // Save current round
        const newRound: ClarifyingRound = {
            questions: currentQuestions,
            answers: currentAnswers,
        };
        const newRounds = [...clarifyingRounds, newRound];
        setClarifyingRounds(newRounds);
        setCurrentQuestions([]);
        setCurrentAnswers([]);

        // Ask for next round
        setLoadingQuestions(true);
        setError('');

        try {
            const res = await fetch('/api/clarifyingquestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: response,
                    model: selectedModel,
                    cwd: cwd || undefined,
                    previousRounds: newRounds,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Server error: ${res.status}`);
            }

            const data = await res.json();
            if (data.done || !data.questions?.length) {
                setClarifyingDone(true);
            } else {
                setCurrentQuestions(data.questions);
                setCurrentAnswers(data.questions.map(() => ({ selectedLabels: [], otherText: '', skipped: false })));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate questions');
        } finally {
            setLoadingQuestions(false);
            await refreshCallHistory();
        }
    }

    function handleSkipAll() {
        setClarifyingDone(true);
        setCurrentQuestions([]);
        setCurrentAnswers([]);
    }

    async function handleGenerateRequirements() {
        if (!response.trim() || loadingRequirements) return;

        setError('');
        setLoadingRequirements(true);

        const isGenerateMore = requirements.length > 0;
        const body = isGenerateMore
            ? { prompt: response, model: selectedModel, cwd: cwd || undefined, existingRequirements: requirements, clarifyingRounds: clarifyingRounds.length > 0 ? clarifyingRounds : undefined }
            : { prompt: response, model: selectedModel, cwd: cwd || undefined, clarifyingRounds: clarifyingRounds.length > 0 ? clarifyingRounds : undefined };

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
            await refreshCallHistory();
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
            cwd: cwd || undefined,
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
            await refreshCallHistory();
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
                body: JSON.stringify({ prompt: response, model: selectedModel, cwd: cwd || undefined, requirements, tasks }),
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
            await refreshCallHistory();
        }
    }

    return (
        <div class="home-layout">
            <aside class="sidebar">
                <SessionPanel
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    onLoad={handleLoadSession}
                    onDelete={handleDeleteSession}
                    onNew={handleNewSession}
                    onSave={handleSave}
                    saving={saving}
                    projectName={projectName}
                    onProjectNameChange={setProjectName}
                    cwd={cwd}
                    onCwdChange={setCwd}
                    models={models}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    callHistory={callHistory}
                    disabled={loading}
                />
            </aside>
            <div class="home">
                {/* Progress Stepper */}
                <div class="stepper">
                    {STEPS.map((label, i) => (
                        <div key={label} class="stepper-step">
                            {i > 0 && (
                                <div class={`stepper-line ${stepCompleted[i - 1] ? 'stepper-line--filled' : ''}`} />
                            )}
                            <div class={`stepper-circle ${stepCompleted[i] ? 'stepper-circle--completed' : stepActive[i] ? 'stepper-circle--active' : ''}`}>
                                {i + 1}
                            </div>
                            <span class={`stepper-label ${stepActive[i] ? 'stepper-label--active' : ''}`}>{label}</span>
                        </div>
                    ))}
                </div>

                {error && <div class="error">{error}</div>}

                {/* Section 0: Goal + Clarifying Questions */}
                <div class="collapsible">
                    <button class="collapsible-header" onClick={() => toggleSection(0)}>
                        <span class="collapsible-title">Goal</span>
                        {clarifyingRounds.length > 0 && (
                            <span class="collapsible-badge">{clarifyingRounds.length} round{clarifyingRounds.length !== 1 ? 's' : ''}</span>
                        )}
                        <span class={`collapsible-chevron ${openSections.has(0) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
                    </button>
                    <div class={`collapsible-body ${openSections.has(0) ? 'collapsible-body--open' : ''}`}>
                        <div class="collapsible-content">
                            <textarea
                                ref={goalTextareaRef}
                                class="textarea"
                                value={prompt}
                                onInput={e => setPrompt(e.currentTarget.value)}
                                placeholder="Describe your goal. What do you want to build?"
                                disabled={loading}
                            />
                            {response ? (
                                <>
                                    {clarifyingDone && currentQuestions.length === 0 && (
                                        <div class="clarifying-done-message">
                                            Clarification complete — ready to generate requirements.
                                        </div>
                                    )}
                                    <ClarifyingQuestions
                                        currentQuestions={currentQuestions}
                                        currentAnswers={currentAnswers}
                                        onUpdateAnswer={handleUpdateAnswer}
                                        previousRounds={clarifyingRounds}
                                        onSubmitAnswers={handleSubmitAnswers}
                                        onSkipAll={handleSkipAll}
                                        loading={loadingQuestions}
                                    />
                                </>
                            ) : (
                                <button class="button" onClick={handleGo} disabled={loading || !prompt.trim()}>
                                    {loading ? 'Generating\u2026' : 'Generate'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section 1: Requirements */}
                {stepActive[1] && (
                    <div class="collapsible">
                        <button class="collapsible-header" onClick={() => toggleSection(1)}>
                            <span class="collapsible-title">Requirements</span>
                            <span class={`collapsible-chevron ${openSections.has(1) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
                        </button>
                        <div class={`collapsible-body ${openSections.has(1) ? 'collapsible-body--open' : ''}`}>
                            <div class="collapsible-content">
                                {requirements.length > 0 && (
                                    <RequirementList
                                        requirements={requirements}
                                        onUpdate={setRequirements}
                                    />
                                )}
                                <button
                                    class="button"
                                    onClick={handleGenerateRequirements}
                                    disabled={loadingRequirements}
                                >
                                    {loadingRequirements ? 'Generating\u2026' : requirements.length > 0 ? 'Generate More' : 'Generate Requirements'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section 2: Tasks */}
                {stepActive[2] && (
                    <div class="collapsible">
                        <button class="collapsible-header" onClick={() => toggleSection(2)}>
                            <span class="collapsible-title">Tasks</span>
                            {tasks.length > 0 && (
                                <span class="collapsible-badge">{totalHours}h total</span>
                            )}
                            <span class={`collapsible-chevron ${openSections.has(2) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
                        </button>
                        <div class={`collapsible-body ${openSections.has(2) ? 'collapsible-body--open' : ''}`}>
                            <div class="collapsible-content">
                                {tasks.length > 0 && (
                                    <TaskList
                                        tasks={tasks}
                                        requirements={requirements}
                                        onUpdate={setTasks}
                                    />
                                )}
                                <button
                                    class="button"
                                    onClick={handleGenerateTasks}
                                    disabled={loadingTasks}
                                >
                                    {loadingTasks ? 'Generating\u2026' : tasks.length > 0 ? 'Generate More Tasks' : 'Generate Tasks'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section 3: Summary */}
                {stepActive[3] && (
                    <div class="collapsible">
                        <button class="collapsible-header" onClick={() => toggleSection(3)}>
                            <span class="collapsible-title">Summary</span>
                            <span class={`collapsible-chevron ${openSections.has(3) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
                        </button>
                        <div class={`collapsible-body ${openSections.has(3) ? 'collapsible-body--open' : ''}`}>
                            <div class="collapsible-content">
                                {summary && (
                                    <SummarySection
                                        summary={summary}
                                    />
                                )}
                                <button
                                    class="button"
                                    onClick={handleGenerateSummary}
                                    disabled={loadingSummary}
                                >
                                    {loadingSummary ? 'Generating\u2026' : summary ? 'Regenerate Summary' : 'Generate Summary'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
