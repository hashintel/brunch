/**
 * Shared helpers for building session data from project + entry + assumption + goal_iteration rows.
 */

export function buildRequirementTree(entries) {
    const byParent = new Map();
    for (const e of entries) {
        const pid = e.parent_id ?? null;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(e);
    }
    for (const [, group] of byParent) group.sort((a, b) => a.sort_order - b.sort_order);

    function buildLevel(parentPk) {
        const children = byParent.get(parentPk) ?? [];
        return children.map(e => ({
            id: e.uuid || String(e.pk),
            title: e.title,
            definition: e.description,
            confidence: e.confidence,
            stage: e.stage,
            tests: JSON.parse(e.test || '[]'),
            children: buildLevel(e.pk),
        }));
    }
    return buildLevel(null);
}

function parseJson(val) {
    if (val == null) return [];
    if (typeof val === 'object') return val; // already parsed (JSON column)
    try { return JSON.parse(val); } catch { return []; }
}

export function serializeSession(project, entries, assumptions = [], goalIterations = []) {
    const clarifyingState = parseJson(project.clarifying_state) || {};
    return {
        id: String(project.pk),
        name: project.name,
        prompt: project.prompt,
        cwd: project.folder,
        response: project.goal,
        selectedModel: project.model,
        requirements: buildRequirementTree(entries),
        clarifyingDone: !!project.clarifying_done,
        assumptionsDone: !!project.assumptions_done,
        questionsExhausted: !!project.questions_exhausted,
        allQuestions: parseJson(project.current_questions),
        allAnswers: parseJson(project.current_answers),
        assumptions: assumptions.map(a => ({
            id: a.uuid,
            text: a.text,
            rationale: a.rationale,
            confidence: a.confidence,
            impact: a.impact,
            status: a.status,
            editedText: a.edited_text,
        })),
        goalIterations: goalIterations.map(g => ({
            goalText: g.goal_text,
            questions: parseJson(g.questions),
            answers: parseJson(g.answers),
        })),
        spec: project.spec ?? '',
        specProgress: project.spec_progress ?? 0,
        wizardStep: project.wizard_step ?? null,
        wizardAssumptions: clarifyingState.wizardAssumptions ?? null,
        wizardRequirements: clarifyingState.wizardRequirements ?? null,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
    };
}

/**
 * Legacy fallback: serialize from clarifying_state JSON blob (for old data before migration).
 */
export function serializeProjectLegacy(project, entries) {
    const clarifyingState = JSON.parse(project.clarifying_state || '{}');
    return {
        id: String(project.pk), name: project.name,
        prompt: project.prompt, cwd: project.folder, response: project.goal,
        selectedModel: project.model, requirements: buildRequirementTree(entries),
        ...clarifyingState,
        createdAt: project.created_at, updatedAt: project.updated_at,
    };
}
