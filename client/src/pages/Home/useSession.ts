import { useEffect, useState } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import type { SessionMeta, Session, ClaudeCall, SessionData, Requirement } from './types';
import { apiFetch } from './apiFetch';

interface UseSessionParams {
    onError: (msg: string) => void;
}

export function useSession({ onError }: UseSessionParams) {
    const { params } = useRoute();
    const { route } = useLocation();
    const [sessions, setSessions] = useState<SessionMeta[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [callHistory, setCallHistory] = useState<ClaudeCall[]>([]);

    async function refreshCallHistory() {
        if (!currentSessionId) {
            setCallHistory([]);
            return;
        }
        try {
            const url = `/api/history/claude?limit=50&projectId=${encodeURIComponent(currentSessionId)}`;
            const data = await apiFetch<{ rows?: ClaudeCall[] }>(url);
            setCallHistory(data.rows ?? []);
        } catch {}
    }

    async function refreshSessions() {
        const data = await apiFetch<SessionMeta[]>('/api/sessions');
        setSessions(data);
    }

    // Load sessions on mount
    useEffect(() => {
        apiFetch<SessionMeta[]>('/api/sessions').then(setSessions).catch(() => {});
    }, []);

    // Refresh call history when project changes
    useEffect(() => {
        refreshCallHistory();
    }, [currentSessionId]);

    const [pendingUrlSessionId, setPendingUrlSessionId] = useState<string | null>(null);

    // Detect session ID from URL param
    useEffect(() => {
        if (params.id && params.id !== currentSessionId) {
            setPendingUrlSessionId(params.id);
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

    async function createProject(name: string, folder: string, selectedModel: string): Promise<string | null> {
        try {
            const created = await apiFetch<Session>('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    prompt: '',
                    cwd: folder,
                    response: '',
                    selectedModel,
                    requirements: [],
                }),
            });
            setCurrentSessionId(created.id);
            setCallHistory([]);
            await refreshSessions();
            return created.id;
        } catch {
            onError('Failed to create project');
            return null;
        }
    }

    async function save(data: SessionData) {
        setSaving(true);
        try {
            const payload = {
                name: data.name,
                prompt: data.prompt,
                cwd: data.cwd,
                response: data.response,
                selectedModel: data.selectedModel,
                requirements: data.requirements,
                goalIterations: data.goalIterations,
                allQuestions: data.allQuestions,
                allAnswers: data.allAnswers,
                questionsExhausted: data.questionsExhausted,
                clarifyingDone: data.clarifyingDone,
                assumptions: data.assumptions,
                assumptionsDone: data.assumptionsDone,
            };
            if (currentSessionId) {
                await apiFetch(`/api/sessions/${currentSessionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                const created = await apiFetch<Session>('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                setCurrentSessionId(created.id);
            }
            await refreshSessions();
        } catch {
            onError('Failed to save session');
        } finally {
            setSaving(false);
        }
    }

    async function load(id: string): Promise<SessionData | null> {
        try {
            const s: any = await apiFetch(`/api/sessions/${id}`);

            // Backward compat: convert old clarifyingRounds
            let goalIterations = s.goalIterations ?? [];
            if (!s.goalIterations && s.clarifyingRounds?.length > 0) {
                goalIterations = s.clarifyingRounds.map((r: any) => ({
                    goalText: '',
                    questions: r.questions,
                    answers: r.answers,
                }));
            }

            // Migrate requirements
            function migrateTests(r: any) {
                if (r.tests && Array.isArray(r.tests)) return r.tests;
                if (r.test && typeof r.test === 'string') return [{ type: 'programmatic_test', description: r.test }];
                return [];
            }
            function migrateReq(r: any): Requirement {
                return {
                    id: r.id ?? crypto.randomUUID(),
                    title: r.title,
                    definition: r.definition,
                    confidence: r.confidence,
                    stage: r.stage ?? 'proposal',
                    tests: migrateTests(r),
                    children: (r.children ?? []).map(migrateReq),
                };
            }

            setCurrentSessionId(s.id);
            onError('');

            return {
                name: s.name ?? '',
                prompt: s.prompt,
                cwd: s.cwd ?? '',
                response: s.response,
                selectedModel: s.selectedModel,
                goalIterations,
                allQuestions: s.allQuestions ?? [],
                allAnswers: s.allAnswers ?? [],
                questionsExhausted: s.questionsExhausted ?? false,
                clarifyingDone: s.clarifyingDone ?? false,
                assumptions: s.assumptions ?? [],
                assumptionsDone: s.assumptionsDone ?? false,
                requirements: (s.requirements ?? []).map(migrateReq),
            };
        } catch {
            onError('Failed to load session');
            return null;
        }
    }

    async function deleteSession(id: string) {
        if (!window.confirm('Delete this project?')) return;
        try {
            await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
            if (currentSessionId === id) setCurrentSessionId(null);
            await refreshSessions();
        } catch {
            onError('Failed to delete session');
        }
    }

    function clearPendingUrlSession() {
        setPendingUrlSessionId(null);
    }

    return {
        sessions,
        currentSessionId,
        setCurrentSessionId,
        saving,
        callHistory,
        setCallHistory,
        refreshCallHistory,
        createProject,
        save,
        load,
        deleteSession,
        refreshSessions,
        pendingUrlSessionId,
        clearPendingUrlSession,
    };
}
