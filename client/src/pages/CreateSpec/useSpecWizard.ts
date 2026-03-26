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

    const { route } = useLocation();

    const questions = useSpecQuestions({ selectedModel });
    const spec = useStructuredSpec({ selectedModel });
    const assumptions = useWizardAssumptions({ selectedModel });
    const requirements = useWizardRequirements({ selectedModel });

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAnswerHash = useRef('');
    const resumedRef = useRef(false);

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

            // Hydrate assumptions — merge wizard-typed data from clarifying_state
            const wizardAssumptions = session.wizardAssumptions;
            if (wizardAssumptions?.length) {
                assumptions.hydrate(wizardAssumptions);
            } else if (session.assumptions?.length) {
                // Fallback: map from session format
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

            // Hydrate requirements — use wizard-typed data for exact round-trip
            const wizardRequirements = session.wizardRequirements;
            if (wizardRequirements) {
                requirements.hydrate(wizardRequirements);
            }

            // Set screen from URL step param
            const targetScreen = (routeStep && (VALID_STEPS as readonly string[]).includes(routeStep))
                ? STEP_TO_SCREEN[routeStep as StepParam]
                : 'clarify';
            setScreen(targetScreen);

            // If resuming to overview, regenerate the spec
            if (targetScreen === 'overview') {
                const answersData = questions.getAnswersWithQuestions();
                spec.generate(session.prompt ?? '', answersData);
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
            // These go into ...rest → clarifying_state
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

        // Fire these regardless — they work with the prompt
        questions.fetchQuestions(text);
        spec.generate(text);
    }

    // --- Debounced spec regeneration when answers change ---
    const regenerateSpec = useCallback(() => {
        if (!prompt) return;
        const answersData = questions.getAnswersWithQuestions();
        const hash = JSON.stringify(answersData);
        if (hash === lastAnswerHash.current) return;
        lastAnswerHash.current = hash;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            spec.generate(prompt, answersData);
        }, 500);
    }, [prompt, questions.answers]);

    useEffect(() => {
        if (screen === 'clarify' && questions.answeredCount > 0) {
            regenerateSpec();
        }
    }, [questions.answers, screen]);

    function skipAllAndGenerate() {
        const answersData = questions.getAnswersWithQuestions();
        spec.generate(prompt, answersData);
    }

    // --- Step transitions ---
    async function goToAssumptions() {
        setScreen('assumptions');
        if (projectId) {
            saveToDb();
            route(`/create-spec/${projectId}/assumptions`, true);
        }
        const answersData = questions.getAnswersWithQuestions();
        await assumptions.generate(prompt, answersData);
    }

    async function goToRequirements() {
        setScreen('requirements');
        if (projectId) {
            saveToDb();
            route(`/create-spec/${projectId}/requirements`, true);
        }
        const answersData = questions.getAnswersWithQuestions();
        await requirements.generate(prompt, answersData, assumptions.assumptions);
    }

    async function goToOverview() {
        setScreen('overview');
        if (projectId) {
            saveToDb();
            route(`/create-spec/${projectId}/overview`, true);
        }
        const answersData = questions.getAnswersWithQuestions();
        await spec.generate(prompt, answersData);
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

    function reset() {
        setScreen('landing');
        setPrompt('');
        setProjectId(null);
        questions.reset();
        spec.reset();
        assumptions.reset();
        requirements.reset();
        lastAnswerHash.current = '';
        resumedRef.current = false;
    }

    const toolCallbacks: ToolCallbacks = {
        onUpdateAssumption: assumptions.updateAssumption,
        onCreateAssumption: (input: any) => assumptions.addAssumption({ ...input, id: input.createdId }),
        onDeleteAssumption: (id: string) => assumptions.deleteAssumption(id),
        onUpdateRequirement: requirements.updateRequirement,
        onCreateRequirement: (input: any) => requirements.addRequirement({ ...input, id: input.createdId }),
        onDeleteRequirement: (id: string) => requirements.deleteRequirement(id),
    };

    return {
        screen,
        prompt,
        setPrompt,
        projectId,
        resuming,
        submit,
        save,
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
