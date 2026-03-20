export const clarifyingQuestionsSchema = {
    type: 'object',
    properties: {
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    why: { type: 'string' },
                    options: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { label: { type: 'string' } },
                            required: ['label'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['question', 'why', 'options'],
                additionalProperties: false,
            },
        },
        done: { type: 'boolean' },
        reason: { type: 'string', enum: ['clear', 'invalid'] },
    },
    required: ['questions', 'done'],
    additionalProperties: false,
};

export const assumptionsSchema = {
    type: 'object',
    properties: {
        assumptions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    text: { type: 'string' },
                    rationale: { type: 'string' },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    impact: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
                required: ['text', 'rationale', 'confidence', 'impact'],
                additionalProperties: false,
            },
        },
    },
    required: ['assumptions'],
    additionalProperties: false,
};

export const requirementJsonSchema = {
    type: 'object',
    properties: {
        requirements: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    definition: { type: 'string' },
                    confidence: { type: 'number' },
                },
                required: ['title', 'definition', 'confidence'],
                additionalProperties: false,
            },
        },
    },
    required: ['requirements'],
    additionalProperties: false,
};

export const expandRequirementSchema = {
    type: 'object',
    properties: {
        tests: {
            type: 'array',
            description: 'Verification methods for this requirement',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['static_analysis', 'programmatic_test', 'llm_review', 'human_review'] },
                    description: { type: 'string' },
                },
                required: ['type', 'description'],
                additionalProperties: false,
            },
        },
        children: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    definition: { type: 'string' },
                    confidence: { type: 'number' },
                },
                required: ['title', 'definition', 'confidence'],
                additionalProperties: false,
            },
        },
    },
    required: ['tests', 'children'],
    additionalProperties: false,
};

export const generateChildrenSchema = {
    type: 'object',
    properties: {
        children: expandRequirementSchema.properties.children,
    },
    required: ['children'],
    additionalProperties: false,
};

export const generateTestsSchema = {
    type: 'object',
    properties: {
        tests: expandRequirementSchema.properties.tests,
    },
    required: ['tests'],
    additionalProperties: false,
};

export const specSchema = {
    type: 'object',
    properties: {
        spec: { type: 'string', description: 'Full markdown spec document optimized for spec-driven development' },
        progress: { type: 'number', description: 'Estimated spec completeness 0-100' },
    },
    required: ['spec', 'progress'],
    additionalProperties: false,
};

export function formatClarifyingRounds(rounds) {
    if (!rounds?.length) return '';
    return rounds.map((round, i) => {
        const qas = round.questions.map((q, j) => {
            const ans = round.answers[j];
            let answerText = 'Skipped';
            if (ans && !ans.skipped) {
                const parts = [];
                if (ans.selectedLabels?.length) parts.push(ans.selectedLabels.join(', '));
                if (ans.otherText) parts.push(`Other: ${ans.otherText}`);
                if (parts.length) answerText = parts.join('; ');
            }
            return `Q: ${q.question}\nA: ${answerText}`;
        }).join('\n\n');
        return `--- Round ${i + 1} ---\n${qas}`;
    }).join('\n\n');
}

export function formatAssumptionsContext(assumptions) {
    if (!assumptions?.length) return '';
    return assumptions.map((a, i) => {
        const status = a.status ?? 'pending';
        const text = status === 'edited' && a.editedText ? a.editedText : a.text;
        return `${i + 1}. [${status.toUpperCase()}] (confidence: ${a.confidence}, impact: ${a.impact}) ${text}`;
    }).join('\n');
}
