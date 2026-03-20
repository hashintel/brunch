import { useState } from 'preact/hooks';
import { useGoal } from './useGoal';
import { useClarifying } from './useClarifying';
import { useAssumptions } from './useAssumptions';
import { useRequirements } from './useRequirements';
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

    const goal = useGoal({
        selectedModel,
        cwd,
        projectId,
        bus,
        onGoalReady: (goalText, iterations, questions, answers) => {
            clarifying.fetchQuestions(goalText, iterations, questions, answers);
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
        goal.restore(data);
        clarifying.restore(data);
        assumptions.restore(data);
        req.restore(data);

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
    };

    return {
        goal,
        clarifying,
        assumptions,
        req,
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
