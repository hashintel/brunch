import './style.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import type { Model, Requirement, Task, SessionMeta, Session, ClarifyingQuestion, ClarifyingAnswer, GoalIteration, ClaudeCall } from './types';
import { RequirementList } from './RequirementList';
import { TaskList } from './TaskList';
import { SummarySection } from './SummarySection';
import { SessionPanel } from './SessionPanel';
import { ClarifyingQuestions } from './ClarifyingQuestions';

const STEPS = ['Goal', 'Requirements', 'Tasks', 'Summary'] as const;

function isAnswered(a: ClarifyingAnswer): boolean {
    return a.skipped || a.selectedLabels.length > 0 || a.otherText.length > 0;
}

function formatAnswer(a: ClarifyingAnswer | undefined): string {
    if (!a || a.skipped) return 'Skipped';
    const parts: string[] = [];
    if (a.selectedLabels.length) parts.push(a.selectedLabels.join(', '));
    if (a.otherText) parts.push(`Other: ${a.otherText}`);
    return parts.length ? parts.join(' — ') : 'Skipped';
}

function buildPreviousRounds(iterations: GoalIteration[], questions: ClarifyingQuestion[], answers: ClarifyingAnswer[]) {
    const rounds: { questions: ClarifyingQuestion[]; answers: ClarifyingAnswer[] }[] = [];
    for (const iter of iterations) {
        if (iter.questions.length > 0) {
            rounds.push({ questions: iter.questions, answers: iter.answers });
        }
    }
    const answeredQs: ClarifyingQuestion[] = [];
    const answeredAs: ClarifyingAnswer[] = [];
    for (let i = 0; i < questions.length; i++) {
        if (answers[i] && isAnswered(answers[i])) {
            answeredQs.push(questions[i]);
            answeredAs.push(answers[i]);
        }
    }
    if (answeredQs.length > 0) {
        rounds.push({ questions: answeredQs, answers: answeredAs });
    }
    return rounds;
}

export function Home() {
    const { params } = useRoute();
    const { route } = useLocation();
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

    // Goal iterations (previous revisions, read-only)
    const [goalIterations, setGoalIterations] = useState<GoalIteration[]>([]);

    // Flat question/answer lists (current active round)
    const [allQuestions, setAllQuestions] = useState<ClarifyingQuestion[]>([]);
    const [allAnswers, setAllAnswers] = useState<ClarifyingAnswer[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [questionsExhausted, setQuestionsExhausted] = useState(false);
    const [clarifyingDone, setClarifyingDone] = useState(false);
    const [updatingGoal, setUpdatingGoal] = useState(false);
    const preloadingRef = useRef(false);

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

    // Load session from URL param on mount
    useEffect(() => {
        if (params.id && params.id !== currentSessionId) {
            handleLoadSession(params.id);
        }
    }, [params.id]);

    // Update URL when session changes
    useEffect(() => {
        if (currentSessionId) {
            const target = `/session/${currentSessionId}`;
            if (location.pathname !== target) {
                route(target, true);
            }
        } else if (location.pathname !== '/') {
            route('/', true);
        }
    }, [currentSessionId]);

    async function refreshSessions() {
        const res = await fetch('/api/sessions');
        setSessions(await res.json());
    }

    async function handleSave() {
        setSaving(true);
        try {
            const body: any = {
                prompt, cwd, response, selectedModel,
                goalIterations, allQuestions, allAnswers, questionsExhausted,
                clarifyingDone, requirements, tasks, summary,
            };
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
            const s: any = await res.json();
            setPrompt(s.prompt);
            setCwd(s.cwd ?? '');
            setResponse(s.response);
            setSelectedModel(s.selectedModel);
            // New format
            setGoalIterations(s.goalIterations ?? []);
            setAllQuestions(s.allQuestions ?? []);
            setAllAnswers(s.allAnswers ?? []);
            setQuestionsExhausted(s.questionsExhausted ?? false);
            // Backward compat: convert old clarifyingRounds
            if (!s.goalIterations && s.clarifyingRounds?.length > 0) {
                setGoalIterations(s.clarifyingRounds.map((r: any) => ({
                    goalText: '',
                    questions: r.questions,
                    answers: r.answers,
                })));
            }
            setClarifyingDone(s.clarifyingDone ?? false);
            setRequirements(s.requirements ?? []);
            setTasks(s.tasks ?? []);
            setSummary(s.summary ?? '');
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
        setGoalIterations([]);
        setAllQuestions([]);
        setAllAnswers([]);
        setQuestionsExhausted(false);
        setClarifyingDone(false);
        setUpdatingGoal(false);
        setRequirements([]);
        setTasks([]);
        setSummary('');
        setError('');
        setCurrentSessionId(null);
    }

    // --- Question fetching ---

    async function fetchQuestions(
        goalText: string,
        iterations: GoalIteration[],
        questions: ClarifyingQuestion[],
        answers: ClarifyingAnswer[],
        showLoading = true,
    ) {
        if (!goalText.trim()) return;
        if (showLoading) setLoadingQuestions(true);
        setError('');

        try {
            const rounds = buildPreviousRounds(iterations, questions, answers);
            const res = await fetch('/api/clarifyingquestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: goalText,
                    model: selectedModel,
                    cwd: cwd || undefined,
                    previousRounds: rounds.length > 0 ? rounds : undefined,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Server error: ${res.status}`);
            }

            const data = await res.json();
            if (data.done || !data.questions?.length) {
                setQuestionsExhausted(true);
            } else {
                setAllQuestions(prev => [...prev, ...data.questions]);
                setAllAnswers(prev => [
                    ...prev,
                    ...data.questions.map(() => ({ selectedLabels: [], otherText: '', skipped: false })),
                ]);
            }
        } catch (e) {
            if (showLoading) {
                setError(e instanceof Error ? e.message : 'Failed to generate questions');
            }
        } finally {
            if (showLoading) setLoadingQuestions(false);
            await refreshCallHistory();
        }
    }

    function maybePreloadQuestions(currentAnswers: ClarifyingAnswer[]) {
        if (questionsExhausted || preloadingRef.current || loadingQuestions || !response || allQuestions.length === 0) return;
        const answeredCount = currentAnswers.filter(isAnswered).length;
        if (allQuestions.length - answeredCount > 2) return;

        preloadingRef.current = true;
        const rounds = buildPreviousRounds(goalIterations, allQuestions, currentAnswers);
        fetch('/api/clarifyingquestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: response,
                model: selectedModel,
                cwd: cwd || undefined,
                previousRounds: rounds.length > 0 ? rounds : undefined,
            }),
        })
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => {
                if (data.done || !data.questions?.length) {
                    setQuestionsExhausted(true);
                } else {
                    setAllQuestions(prev => [...prev, ...data.questions]);
                    setAllAnswers(prev => [
                        ...prev,
                        ...data.questions.map(() => ({ selectedLabels: [], otherText: '', skipped: false })),
                    ]);
                }
            })
            .catch(() => {})
            .finally(() => {
                preloadingRef.current = false;
                refreshCallHistory();
            });
    }

    // --- Handlers ---

    async function handleGo() {
        if (!prompt.trim() || loading) return;

        setResponse('');
        setError('');
        setLoading(true);
        const originalPrompt = prompt;
        setPrompt('');

        let fullText = '';
        try {
            const res = await fetch('http://localhost:3001/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: originalPrompt, model: selectedModel, cwd: cwd || undefined }),
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
                const chunk = decoder.decode(value);
                fullText += chunk;
                setPrompt(prev => prev + chunk);
            }

            setResponse(fullText);
            await fetchQuestions(fullText, [], [], []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong');
        } finally {
            setLoading(false);
            await refreshCallHistory();
        }
    }

    function handleUpdateAnswer(index: number, answer: ClarifyingAnswer) {
        const newAnswers = [...allAnswers];
        newAnswers[index] = answer;
        setAllAnswers(newAnswers);
        maybePreloadQuestions(newAnswers);
    }

    async function handleUpdateGoal() {
        if (updatingGoal || loading) return;

        // Save current iteration
        const iteration: GoalIteration = {
            goalText: prompt,
            questions: allQuestions,
            answers: allAnswers,
        };
        const newIterations = [...goalIterations, iteration];
        setGoalIterations(newIterations);

        // Reset current questions
        setAllQuestions([]);
        setAllAnswers([]);
        setQuestionsExhausted(false);
        preloadingRef.current = false;

        // Build Q&A context for the prompt
        const rounds = buildPreviousRounds(newIterations, [], []);
        const roundsText = rounds.map(r =>
            r.questions.map((q, i) => {
                const a = r.answers[i];
                return `Q: ${q.question}\nA: ${formatAnswer(a)}`;
            }).join('\n\n')
        ).join('\n\n');

        const enhancedPrompt = `Here is a project goal description:\n\n${response}\n\nBased on the following clarifying Q&A, please update and improve the goal description to be more specific and comprehensive:\n\n${roundsText}`;

        setUpdatingGoal(true);
        setPrompt('');
        setError('');

        let fullText = '';
        try {
            const res = await fetch('http://localhost:3001/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: enhancedPrompt, model: selectedModel, cwd: cwd || undefined }),
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
                const chunk = decoder.decode(value);
                fullText += chunk;
                setPrompt(prev => prev + chunk);
            }

            setResponse(fullText);
            await fetchQuestions(fullText, newIterations, [], []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update goal');
        } finally {
            setUpdatingGoal(false);
            await refreshCallHistory();
        }
    }

    function handleGenerateRequirementsDone() {
        // Save final Q&A if any
        if (allQuestions.length > 0) {
            setGoalIterations(prev => [...prev, {
                goalText: '',
                questions: allQuestions,
                answers: allAnswers,
            }]);
            setAllQuestions([]);
            setAllAnswers([]);
        }
        setClarifyingDone(true);
    }

    async function handleGenerateRequirements() {
        if (!response.trim() || loadingRequirements) return;

        setError('');
        setLoadingRequirements(true);

        const isGenerateMore = requirements.length > 0;
        const rounds = buildPreviousRounds(goalIterations, allQuestions, allAnswers);
        const body = isGenerateMore
            ? { prompt: response, model: selectedModel, cwd: cwd || undefined, existingRequirements: requirements, clarifyingRounds: rounds.length > 0 ? rounds : undefined }
            : { prompt: response, model: selectedModel, cwd: cwd || undefined, clarifyingRounds: rounds.length > 0 ? rounds : undefined };

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

    const anyBusy = loading || updatingGoal || loadingQuestions;

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
                        {goalIterations.length > 0 && (
                            <span class="collapsible-badge">{goalIterations.length} revision{goalIterations.length !== 1 ? 's' : ''}</span>
                        )}
                        <span class={`collapsible-chevron ${openSections.has(0) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
                    </button>
                    <div class={`collapsible-body ${openSections.has(0) ? 'collapsible-body--open' : ''}`}>
                        <div class="collapsible-content">
                            {/* Previous iterations (read-only) */}
                            {goalIterations.map((iter, i) => (
                                <div key={i} class="goal-iteration">
                                    {iter.goalText && (
                                        <textarea
                                            class="textarea textarea--readonly"
                                            value={iter.goalText}
                                            readOnly
                                        />
                                    )}
                                    {iter.questions.length > 0 && (
                                        <div class="clarifying-round-summary">
                                            <h4>Clarification Round {i + 1}</h4>
                                            {iter.questions.map((q, qi) => (
                                                <div key={qi} class="clarifying-round-qa">
                                                    <div class="clarifying-round-q">{q.question}</div>
                                                    <div class="clarifying-round-a">{formatAnswer(iter.answers[qi])}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Current goal textarea */}
                            <textarea
                                ref={goalTextareaRef}
                                class="textarea"
                                value={prompt}
                                onInput={e => setPrompt(e.currentTarget.value)}
                                placeholder="Describe your goal. What do you want to build?"
                                disabled={loading || updatingGoal}
                            />

                            {/* Clarifying questions (after first generation, before done) */}
                            {response && !clarifyingDone && (
                                <ClarifyingQuestions
                                    questions={allQuestions}
                                    answers={allAnswers}
                                    onUpdateAnswer={handleUpdateAnswer}
                                    onUpdateGoal={handleUpdateGoal}
                                    onGenerateRequirements={handleGenerateRequirementsDone}
                                    loading={loadingQuestions}
                                    updatingGoal={updatingGoal}
                                />
                            )}

                            {/* Done message */}
                            {clarifyingDone && (
                                <div class="clarifying-done-message">
                                    Clarification complete — ready to generate requirements.
                                </div>
                            )}

                            {/* Initial generate button (only before first response) */}
                            {!response && (
                                <button class="button" onClick={handleGo} disabled={anyBusy || !prompt.trim()}>
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
