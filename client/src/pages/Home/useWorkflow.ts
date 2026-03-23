import { useState, useEffect, useRef } from 'preact/hooks';
import { useGoal } from './useGoal';
import { useClarifying } from './useClarifying';
import { useAssumptions } from './useAssumptions';
import { useRequirements } from './useRequirements';
import { useSpec } from './useSpec';
import { buildPreviousRounds } from './utils';
import type { ProjectBus } from './projectBus';

type Params = {
    selectedModel: string;
    cwd: string;
    projectId: string | null;
    bus: ProjectBus;
};

export function useWorkflow({ selectedModel, cwd, projectId, bus }: Params) {
    const [showInvalidGoalSuggestions, setShowInvalidGoalSuggestions] = useState(false);

    const spec = useSpec({ selectedModel, cwd, projectId, bus });

    const goal = useGoal({
        selectedModel,
        cwd,
        projectId,
        bus,
        onGoalReady: (goalText, iterations, questions, answers) => {
            clarifying.fetchQuestions(goalText, iterations, questions, answers);
            // Trigger spec generation with just the goal
            spec.generate(goalText, iterations, questions, answers);
        },
    });

    const clarifying = useClarifying({
        selectedModel,
        cwd,
        projectId,
        response: goal.response,
        bus,
        onClarifyingDone: (iterations, questions, answers) => {
            const rawPrompt = goal.prompt || goal.response;
            goal.setResponse(rawPrompt);
            const rounds = buildPreviousRounds(iterations, questions, answers);
            assumptions.generate(rounds, rawPrompt);
            // Trigger spec generation with goal + Q&A
            spec.generate(rawPrompt, iterations, questions, answers);
        },
        onGoalClear: (rawPrompt) => {
            goal.setResponse(rawPrompt);
            clarifying.done({ skipCallback: true });
            assumptions.generate(undefined, rawPrompt);
        },
        onGoalInvalid: () => {
            setShowInvalidGoalSuggestions(true);
            goal.setResponse('');
            clarifying.reset();
        },
    });

    const assumptions = useAssumptions({
        selectedModel,
        cwd,
        projectId,
        response: goal.response,
        clarifyingDone: clarifying.clarifyingDone,
        bus,
    });

    const req = useRequirements({
        selectedModel,
        cwd,
        projectId,
        response: goal.response,
        bus,
    });

    // Guard: skip spec generation triggers during restore
    const restoringRef = useRef(false);

    // Trigger spec generation when assumptions are done
    const prevAssumptionsDone = useRef(false);
    useEffect(() => {
        if (restoringRef.current) {
            prevAssumptionsDone.current = assumptions.assumptionsDone;
            return;
        }
        if (assumptions.assumptionsDone && !prevAssumptionsDone.current) {
            const prompt = goal.prompt || goal.response;
            if (prompt) {
                spec.generate(
                    prompt,
                    clarifying.goalIterations,
                    clarifying.allQuestions,
                    clarifying.allAnswers,
                    assumptions.assumptions,
                );
            }
        }
        prevAssumptionsDone.current = assumptions.assumptionsDone;
    }, [assumptions.assumptionsDone]);

    // Trigger spec generation when requirements are generated
    const prevReqCount = useRef(0);
    useEffect(() => {
        if (restoringRef.current) {
            prevReqCount.current = req.requirements.length;
            restoringRef.current = false;
            return;
        }
        if (req.requirements.length > 0 && prevReqCount.current === 0) {
            const prompt = goal.prompt || goal.response;
            if (prompt) {
                spec.generate(
                    prompt,
                    clarifying.goalIterations,
                    clarifying.allQuestions,
                    clarifying.allAnswers,
                    assumptions.assumptions,
                    req.requirements,
                );
            }
        }
        prevReqCount.current = req.requirements.length;
    }, [req.requirements.length]);

    const anyBusy = goal.loading || goal.updatingGoal || goal.generatingDetailedGoal || clarifying.loadingQuestions;

    async function handleUpdateGoal() {
        const result = await goal.updateGoal(
            clarifying.goalIterations,
            clarifying.allQuestions,
            clarifying.allAnswers,
        );
        if (result) {
            clarifying.resetForNewRound(result.newIterations);
            await clarifying.fetchQuestions(result.goalText, result.newIterations, [], []);
        }
    }

    function handleGenerateRequirements() {
        req.generate(
            clarifying.goalIterations,
            clarifying.allQuestions,
            clarifying.allAnswers,
            assumptions.assumptions,
        );
    }

    function restore(data: any, { refetch = true } = {}) {
        restoringRef.current = true;
        goal.restore(data);
        clarifying.restore(data);
        assumptions.restore(data);
        req.restore(data);
        spec.restore(data);

        // Recover from stuck state: have a goal response, clarifying not done, but no questions
        if (refetch && data.response && !data.clarifyingDone && (data.allQuestions ?? []).length === 0) {
            clarifying.fetchQuestions(
                data.response,
                data.goalIterations ?? [],
                [],
                [],
            );
        }
    }

    function reset() {
        goal.reset();
        clarifying.reset();
        assumptions.reset();
        req.reset();
        spec.reset();
        setShowInvalidGoalSuggestions(false);
    }

    const data = {
        prompt: goal.prompt,
        response: goal.response,
        goalIterations: clarifying.goalIterations,
        allQuestions: clarifying.allQuestions,
        allAnswers: clarifying.allAnswers,
        questionsExhausted: clarifying.questionsExhausted,
        clarifyingDone: clarifying.clarifyingDone,
        assumptions: assumptions.assumptions,
        assumptionsDone: assumptions.assumptionsDone,
        requirements: req.requirements,
        spec: spec.spec,
        specProgress: spec.progress,
    };

    return {
        goal,
        clarifying,
        assumptions,
        req,
        spec,
        showInvalidGoalSuggestions,
        setShowInvalidGoalSuggestions,
        handleUpdateGoal,
        handleGenerateRequirements,
        restore,
        reset,
        data,
        anyBusy,
    };
}
