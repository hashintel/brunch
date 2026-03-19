import type { ClarifyingAnswer, ClarifyingQuestion, GoalIteration, Requirement } from './types';

export function isAnswered(a: ClarifyingAnswer): boolean {
    return a.skipped || a.selectedLabels.length > 0 || a.otherText.length > 0;
}

export function formatAnswer(a: ClarifyingAnswer | undefined): string {
    if (!a || a.skipped) return 'Skipped';
    const parts: string[] = [];
    if (a.selectedLabels.length) parts.push(a.selectedLabels.join(', '));
    if (a.otherText) parts.push(`Other: ${a.otherText}`);
    return parts.length ? parts.join(' — ') : 'Skipped';
}

export function buildPreviousRounds(
    iterations: GoalIteration[],
    questions: ClarifyingQuestion[],
    answers: ClarifyingAnswer[],
): { questions: ClarifyingQuestion[]; answers: ClarifyingAnswer[] }[] {
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

export function makeRequirement(r: { title: string; definition: string; confidence: number }): Requirement {
    return {
        id: crypto.randomUUID(),
        title: r.title,
        definition: r.definition,
        confidence: r.confidence,
        stage: 'proposal',
        tests: [],
        children: [],
    };
}
