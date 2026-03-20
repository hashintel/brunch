/**
 * Shared helpers for building session data from project + entry rows.
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
            id: String(e.pk),
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

export function serializeProject(project, entries) {
    const clarifyingState = JSON.parse(project.clarifying_state || '{}');
    return {
        id: String(project.pk), name: project.name,
        prompt: project.prompt, cwd: project.folder, response: project.goal,
        selectedModel: project.model, requirements: buildRequirementTree(entries),
        ...clarifyingState,
        createdAt: project.created_at, updatedAt: project.updated_at,
    };
}
