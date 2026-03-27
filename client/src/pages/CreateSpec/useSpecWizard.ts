import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useSpecQuestions } from './useSpecQuestions';
import { useStructuredSpec } from './useStructuredSpec';
import { useWizardAssumptions } from './useWizardAssumptions';
import { useWizardRequirements } from './useWizardRequirements';
import type { ToolCallbacks } from './useAssistantChat';
import type { WizardScreen } from './types';

const VALID_STEPS = ['clarify', 'assumptions', 'requirements', 'overview'] as const;
type StepParam = typeof VALID_STEPS[number];

const STEP_TO_SCREEN: Record<StepParam, WizardScreen> = {
    clarify: 'clarify',
    assumptions: 'assumptions',
    requirements: 'requirements',
    overview: 'overview',
};

const SCREEN_TO_STEP: Partial<Record<WizardScreen, StepParam>> = {
    clarify: 'clarify',
    assumptions: 'assumptions',
    requirements: 'requirements',
    overview: 'overview',
};

export interface AIQueueItem {
    id: string;
    label: string;
}

interface UseSpecWizardParams {
    selectedModel: string;
    projectId?: string;
    routeStep?: string;
}

export function useSpecWizard({ selectedModel, projectId: routeProjectId, routeStep }: UseSpecWizardParams) {
    const [screen, setScreen] = useState<WizardScreen>('landing');
    const [prompt, setPrompt] = useState('');
    const [projectId, setProjectId] = useState<string | null>(routeProjectId ?? null);
    const [resuming, setResuming] = useState(false);
    const [goalIterations, setGoalIterations] = useState<Array<{ goalText: string }>>([]);

    const { route } = useLocation();

    const questions = useSpecQuestions({ selectedModel });
    const spec = useStructuredSpec({ selectedModel });
    const assumptions = useWizardAssumptions({ selectedModel });
    const requirements = useWizardRequirements({ selectedModel });

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAnswerHash = useRef('');
    const resumedRef = useRef(false);

    // =============================================
    // AI Task Queue — one generation at a time
    // =============================================
    const [aiQueue, setAiQueue] = useState<AIQueueItem[]>([]);
    const queueRef = useRef<Array<{ id: string; label: string; fn: () => Promise<void> }>>([]);
    const drainingRef = useRef(false);

    async function drainQueue() {
        if (drainingRef.current) return;
        drainingRef.current = true;
        while (queueRef.current.length > 0) {
            const task = queueRef.current[0];
            // Remove from UI queue (it's now running, activity will show it)
            setAiQueue(queueRef.current.slice(1).map(t => ({ id: t.id, label: t.label })));
            try {
                await task.fn();
            } catch (e) {
                console.error(`AI task "${task.label}" failed:`, e);
            }
            queueRef.current.shift();
        }
        setAiQueue([]);
        drainingRef.current = false;
    }

    function enqueueAI(label: string, fn: () => Promise<void>) {
        const id = crypto.randomUUID();
        queueRef.current.push({ id, label, fn });
        setAiQueue(queueRef.current.map(t => ({ id: t.id, label: t.label })));
        drainQueue();
    }

    function removeFromAiQueue(id: string) {
        queueRef.current = queueRef.current.filter(t => t.id !== id);
        setAiQueue(queueRef.current.map(t => ({ id: t.id, label: t.label })));
    }

    // --- Sync screen from URL step param ---
    useEffect(() => {
        if (routeStep && (VALID_STEPS as readonly string[]).includes(routeStep)) {
            setScreen(STEP_TO_SCREEN[routeStep as StepParam]);
        }
    }, [routeStep]);

    // --- Resume from DB when projectId is in route ---
    useEffect(() => {
        if (!routeProjectId || resumedRef.current) return;
        resumedRef.current = true;
        resumeSession(routeProjectId);
    }, [routeProjectId]);

    async function resumeSession(id: string) {
        setResuming(true);
        try {
            const res = await fetch(`/api/sessions/${id}`);
            if (!res.ok) throw new Error('Session not found');
            const session = await res.json();

            setProjectId(id);
            setPrompt(session.prompt ?? '');

            // Hydrate sub-hooks
            questions.hydrate(session.allQuestions, session.allAnswers);

            // Hydrate assumptions
            const wizardAssumptions = session.wizardAssumptions;
            if (wizardAssumptions?.length) {
                assumptions.hydrate(wizardAssumptions);
            } else if (session.assumptions?.length) {
                assumptions.hydrate(session.assumptions.map((a: any) => ({
                    id: a.id,
                    label: a.text?.slice(0, 50) ?? '',
                    text: a.text,
                    rationale: a.rationale,
                    impact: a.impact ?? 'medium',
                    confidence: a.confidence ?? 'medium',
                    status: a.status ?? 'pending',
                    editedText: a.editedText,
                })));
            }

            // Hydrate requirements
            const wizardRequirements = session.wizardRequirements;
            if (wizardRequirements) {
                requirements.hydrate(wizardRequirements);
            }

            // Hydrate spec if saved
            const savedSpec = session.spec;
            if (savedSpec) {
                try {
                    const parsed = typeof savedSpec === 'string' ? JSON.parse(savedSpec) : savedSpec;
                    if (parsed && parsed.sections) {
                        spec.hydrate(parsed);
                    }
                } catch {}
            }

            // Set screen from URL step param
            const targetScreen = (routeStep && (VALID_STEPS as readonly string[]).includes(routeStep))
                ? STEP_TO_SCREEN[routeStep as StepParam]
                : 'clarify';
            setScreen(targetScreen);

            // If no saved spec and we have a prompt, regenerate it (queued)
            if (!savedSpec && session.prompt) {
                const answersData = questions.getAnswersWithQuestions();
                const p = session.prompt;
                enqueueAI('Regenerating spec', () => spec.generate(p, answersData));
            }
        } catch (e) {
            console.error('Failed to resume session:', e);
            route('/create-spec', true);
        } finally {
            setResuming(false);
        }
    }

    // --- Build save payload ---
    function buildSavePayload() {
        const assumptionsMapped = assumptions.assumptions.map(a => ({
            id: a.id,
            text: a.editedText || a.text,
            rationale: a.rationale,
            confidence: a.confidence,
            impact: a.impact,
            status: a.status,
            editedText: a.editedText,
        }));

        const requirementsMapped = (requirements.data?.requirements ?? []).map(function mapReq(r: any): any {
            return {
                id: r.id,
                title: r.title,
                definition: r.title,
                confidence: null,
                tests: r.checks?.map((c: any) => c.description) ?? [],
                children: r.children?.map(mapReq) ?? [],
            };
        });

        return {
            name: prompt?.slice(0, 50) ?? '',
            prompt,
            selectedModel,
            allQuestions: questions.questions,
            allAnswers: questions.answers,
            assumptions: assumptionsMapped,
            requirements: requirementsMapped,
            response: requirements.data?.description ?? '',
            spec: spec.spec ? JSON.stringify(spec.spec) : '',
            wizardStep: SCREEN_TO_STEP[screen] ?? 'clarify',
            wizardAssumptions: assumptions.assumptions,
            wizardRequirements: requirements.data,
        };
    }

    // --- Save to DB (fire-and-forget) ---
    function saveToDb() {
        if (!projectId) return;
        const payload = buildSavePayload();
        fetch(`/api/sessions/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(e => console.error('Failed to save session:', e));
    }

    // --- Save draft (explicit, returns promise) ---
    async function save() {
        if (!projectId) return;
        const payload = buildSavePayload();
        await fetch(`/api/sessions/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    // --- Submit (landing → clarify) ---
    async function submit(text: string) {
        setPrompt(text);
        setGoalIterations([{ goalText: text }]);
        setScreen('clarify');

        try {
            const res = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: text.slice(0, 50),
                    prompt: text,
                    selectedModel,
                }),
            });
            const session = await res.json();
            const id = session.id;
            setProjectId(id);
            route(`/create-spec/${id}/clarify`, true);
        } catch (e) {
            console.error('Failed to create session:', e);
        }

        // Queue: questions first, then spec generation
        enqueueAI('Generating questions', () => questions.fetchQuestions(text));
        enqueueAI('Generating spec', () => spec.generate(text));
    }

    // --- Auto-save when generation finishes ---
    const prevQuestionsLoading = useRef(false);
    const prevSpecLoading = useRef(false);
    const prevAssumptionsLoading = useRef(false);
    const prevRequirementsLoading = useRef(false);

    useEffect(() => {
        if (prevQuestionsLoading.current && !questions.loading && questions.questions.length > 0) saveToDb();
        prevQuestionsLoading.current = questions.loading;
    }, [questions.loading]);

    useEffect(() => {
        if (prevSpecLoading.current && !spec.loading && spec.spec) saveToDb();
        prevSpecLoading.current = spec.loading;
    }, [spec.loading]);

    useEffect(() => {
        if (prevAssumptionsLoading.current && !assumptions.loading && assumptions.assumptions.length > 0) saveToDb();
        prevAssumptionsLoading.current = assumptions.loading;
    }, [assumptions.loading]);

    useEffect(() => {
        if (prevRequirementsLoading.current && !requirements.loading && requirements.data) saveToDb();
        prevRequirementsLoading.current = requirements.loading;
    }, [requirements.loading]);

    // --- Debounced spec regeneration when answers change ---
    const regenerateSpec = useCallback(() => {
        if (!prompt) return;
        const answersData = questions.getAnswersWithQuestions();
        const hash = JSON.stringify(answersData);
        if (hash === lastAnswerHash.current) return;
        lastAnswerHash.current = hash;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            enqueueAI('Updating spec', () => spec.generate(prompt, answersData));
        }, 500);
    }, [prompt, questions.answers]);

    useEffect(() => {
        if (screen === 'clarify' && questions.answeredCount > 0) {
            regenerateSpec();
        }
    }, [questions.answers, screen]);

    function skipAllAndGenerate() {
        const answersData = questions.getAnswersWithQuestions();
        enqueueAI('Generating spec', () => spec.generate(prompt, answersData));
    }

    // --- Step transitions ---
    async function goToAssumptions() {
        setScreen('assumptions');
        if (projectId) {
            saveToDb();
            route(`/create-spec/${projectId}/assumptions`, true);
        }
        const answersData = questions.getAnswersWithQuestions();
        enqueueAI('Generating assumptions', () => assumptions.generate(prompt, answersData));
    }

    async function goToRequirements() {
        setScreen('requirements');
        if (projectId) {
            saveToDb();
            route(`/create-spec/${projectId}/requirements`, true);
        }
        const answersData = questions.getAnswersWithQuestions();
        enqueueAI('Generating requirements', () => requirements.generate(prompt, answersData, assumptions.assumptions));
    }

    async function goToOverview() {
        setScreen('overview');
        if (projectId) {
            saveToDb();
            route(`/create-spec/${projectId}/overview`, true);
        }
        const answersData = questions.getAnswersWithQuestions();
        enqueueAI('Finalizing spec', () => spec.generate(prompt, answersData));
    }

    function goBack() {
        if (screen === 'clarify') {
            setScreen('landing');
            if (projectId) route('/create-spec', true);
        } else if (screen === 'assumptions') {
            setScreen('clarify');
            if (projectId) route(`/create-spec/${projectId}/clarify`, true);
        } else if (screen === 'requirements') {
            setScreen('assumptions');
            if (projectId) route(`/create-spec/${projectId}/assumptions`, true);
        } else if (screen === 'overview') {
            setScreen('requirements');
            if (projectId) route(`/create-spec/${projectId}/requirements`, true);
        }
    }

    function updatePrompt(newPrompt: string) {
        // Save current prompt as an iteration before updating
        if (prompt.trim()) {
            setGoalIterations(prev => [...prev, { goalText: prompt }]);
        }
        setPrompt(newPrompt);
        // Regenerate questions and spec with the new prompt
        enqueueAI('Regenerating questions', () => questions.fetchQuestions(newPrompt));
        enqueueAI('Regenerating spec', () => spec.generate(newPrompt, questions.getAnswersWithQuestions()));
    }

    function reset() {
        setScreen('landing');
        setPrompt('');
        setProjectId(null);
        setGoalIterations([]);
        questions.reset();
        spec.reset();
        assumptions.reset();
        requirements.reset();
        lastAnswerHash.current = '';
        resumedRef.current = false;
        queueRef.current = [];
        setAiQueue([]);
        drainingRef.current = false;
    }

    const toolCallbacks: ToolCallbacks = {
        onUpdateAssumption: assumptions.updateAssumption,
        onCreateAssumption: (input: any) => assumptions.addAssumption({ ...input, id: input.createdId }),
        onDeleteAssumption: (id: string) => assumptions.deleteAssumption(id),
        onUpdateRequirement: requirements.updateRequirement,
        onCreateRequirement: (input: any) => requirements.addRequirement({ ...input, id: input.createdId }),
        onDeleteRequirement: (id: string) => requirements.deleteRequirement(id),
    };

    // Aggregate wizard activity — first non-null wins
    const wizardActivity = questions.activity || spec.activity || assumptions.activity || requirements.activity || null;

    return {
        screen,
        prompt,
        setPrompt,
        projectId,
        resuming,
        wizardActivity,
        aiQueue,
        removeFromAiQueue,
        submit,
        save,
        updatePrompt,
        goalIterations,
        questions,
        spec,
        assumptions,
        requirements,
        toolCallbacks,
        skipAllAndGenerate,
        goBack,
        goToAssumptions,
        goToRequirements,
        goToOverview,
        reset,
    };
}
