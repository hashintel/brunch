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

export const wizardAssumptionsSchema = {
    type: 'object',
    properties: {
        assumptions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    label: { type: 'string', description: 'Short label like "Core Assumption", "A1", "A2"' },
                    text: { type: 'string' },
                    rationale: { type: 'string' },
                    impact: { type: 'string', enum: ['high', 'medium', 'low'] },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    options: { type: 'array', items: { type: 'string' }, description: 'Alternative options the user could choose instead' },
                },
                required: ['id', 'label', 'text', 'rationale', 'impact', 'confidence', 'options'],
                additionalProperties: false,
            },
        },
    },
    required: ['assumptions'],
    additionalProperties: false,
};

export const wizardRequirementsSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', description: 'Project title' },
        description: { type: 'string', description: 'Brief project description' },
        requirements: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Like R1, R2' },
                    title: { type: 'string' },
                    status: { type: 'string', enum: ['uncertain', 'decision_node', 'ok'] },
                    checks: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                description: { type: 'string' },
                                type: { type: 'string', enum: ['benchmark', 'e2e', 'unit', 'human_review', 'static_analysis'] },
                            },
                            required: ['description', 'type'],
                            additionalProperties: false,
                        },
                    },
                    children: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', description: 'Like R1.1, R1.2' },
                                title: { type: 'string' },
                                status: { type: 'string', enum: ['uncertain', 'decision_node', 'ok'] },
                                checks: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            description: { type: 'string' },
                                            type: { type: 'string', enum: ['benchmark', 'e2e', 'unit', 'human_review', 'static_analysis'] },
                                        },
                                        required: ['description', 'type'],
                                        additionalProperties: false,
                                    },
                                },
                                children: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            title: { type: 'string' },
                                            checks: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        description: { type: 'string' },
                                                        type: { type: 'string', enum: ['benchmark', 'e2e', 'unit', 'human_review', 'static_analysis'] },
                                                    },
                                                    required: ['description', 'type'],
                                                    additionalProperties: false,
                                                },
                                            },
                                        },
                                        required: ['id', 'title', 'checks'],
                                        additionalProperties: false,
                                    },
                                },
                            },
                            required: ['id', 'title', 'checks'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['id', 'title', 'checks', 'children'],
                additionalProperties: false,
            },
        },
    },
    required: ['title', 'description', 'requirements'],
    additionalProperties: false,
};

export const specQuestionsSchema = {
    type: 'object',
    properties: {
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    question: { type: 'string' },
                    why: { type: 'string' },
                    impact: { type: 'string', enum: ['high', 'medium', 'low'] },
                    selectionType: { type: 'string', enum: ['single', 'multi'] },
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
                required: ['id', 'question', 'why', 'impact', 'selectionType', 'options'],
                additionalProperties: false,
            },
        },
    },
    required: ['questions'],
    additionalProperties: false,
};

export const structuredSpecSchema = {
    type: 'object',
    properties: {
        overallConfidence: { type: 'number', description: 'Overall spec confidence 0-100' },
        sections: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['purpose', 'success_criteria', 'deliverables', 'risks'] },
                    confidence: { type: 'number' },
                    content: { type: 'string' },
                    items: { type: 'array', items: { type: 'string' } },
                    risks: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                risk: { type: 'string' },
                                severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                                mitigation: { type: 'string' },
                            },
                            required: ['risk', 'severity', 'mitigation'],
                            additionalProperties: false,
                        },
                    },
                    assumptions: { type: 'array', items: { type: 'string' } },
                },
                required: ['type', 'confidence', 'content'],
                additionalProperties: false,
            },
        },
    },
    required: ['overallConfidence', 'sections'],
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
