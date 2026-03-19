import { describe, it, expect } from 'vitest';
import { formatClarifyingRounds, formatAssumptionsContext } from './schemas.js';

describe('formatClarifyingRounds', () => {
    it('returns empty string for null/undefined/empty input', () => {
        expect(formatClarifyingRounds(null)).toBe('');
        expect(formatClarifyingRounds(undefined)).toBe('');
        expect(formatClarifyingRounds([])).toBe('');
    });

    it('formats a single round with selected labels', () => {
        const rounds = [{
            questions: [
                { question: 'What platform?', why: 'Affects arch', options: [{ label: 'Web' }, { label: 'Mobile' }] },
            ],
            answers: [
                { selectedLabels: ['Web', 'Mobile'], otherText: '', skipped: false },
            ],
        }];
        const result = formatClarifyingRounds(rounds);
        expect(result).toContain('Round 1');
        expect(result).toContain('Q: What platform?');
        expect(result).toContain('A: Web, Mobile');
    });

    it('formats skipped answers', () => {
        const rounds = [{
            questions: [{ question: 'Scale?', why: 'x', options: [] }],
            answers: [{ selectedLabels: [], otherText: '', skipped: true }],
        }];
        const result = formatClarifyingRounds(rounds);
        expect(result).toContain('A: Skipped');
    });

    it('formats answers with other text', () => {
        const rounds = [{
            questions: [{ question: 'DB?', why: 'x', options: [] }],
            answers: [{ selectedLabels: ['PostgreSQL'], otherText: 'with TimescaleDB', skipped: false }],
        }];
        const result = formatClarifyingRounds(rounds);
        expect(result).toContain('PostgreSQL');
        expect(result).toContain('Other: with TimescaleDB');
    });

    it('formats answers with only other text', () => {
        const rounds = [{
            questions: [{ question: 'Auth?', why: 'x', options: [] }],
            answers: [{ selectedLabels: [], otherText: 'Custom SSO', skipped: false }],
        }];
        const result = formatClarifyingRounds(rounds);
        expect(result).toContain('A: Other: Custom SSO');
    });

    it('formats multiple rounds', () => {
        const rounds = [
            {
                questions: [{ question: 'Q1?', why: 'x', options: [] }],
                answers: [{ selectedLabels: ['A'], otherText: '', skipped: false }],
            },
            {
                questions: [{ question: 'Q2?', why: 'x', options: [] }],
                answers: [{ selectedLabels: ['B'], otherText: '', skipped: false }],
            },
        ];
        const result = formatClarifyingRounds(rounds);
        expect(result).toContain('Round 1');
        expect(result).toContain('Round 2');
        expect(result).toContain('Q: Q1?');
        expect(result).toContain('Q: Q2?');
    });

    it('shows Skipped for null/missing answer', () => {
        const rounds = [{
            questions: [
                { question: 'Q1?', why: 'x', options: [] },
                { question: 'Q2?', why: 'x', options: [] },
            ],
            answers: [null, undefined],
        }];
        const result = formatClarifyingRounds(rounds);
        expect(result).toContain('A: Skipped');
    });

    it('formats answer with no labels and no text as Skipped', () => {
        const rounds = [{
            questions: [{ question: 'Q?', why: 'x', options: [] }],
            answers: [{ selectedLabels: [], otherText: '', skipped: false }],
        }];
        const result = formatClarifyingRounds(rounds);
        // No labels, no other text, not skipped → falls through to Skipped
        expect(result).toContain('A: Skipped');
    });
});

describe('formatAssumptionsContext', () => {
    it('returns empty string for null/undefined/empty input', () => {
        expect(formatAssumptionsContext(null)).toBe('');
        expect(formatAssumptionsContext(undefined)).toBe('');
        expect(formatAssumptionsContext([])).toBe('');
    });

    it('formats assumptions with status', () => {
        const assumptions = [
            { text: 'Web-based', rationale: 'x', confidence: 'high', impact: 'high', status: 'confirmed' },
            { text: 'REST API', rationale: 'y', confidence: 'medium', impact: 'medium', status: 'pending' },
        ];
        const result = formatAssumptionsContext(assumptions);
        expect(result).toContain('1. [CONFIRMED]');
        expect(result).toContain('(confidence: high, impact: high)');
        expect(result).toContain('Web-based');
        expect(result).toContain('2. [PENDING]');
        expect(result).toContain('REST API');
    });

    it('uses editedText for edited assumptions', () => {
        const assumptions = [
            { text: 'Original', editedText: 'Revised assumption', rationale: 'x', confidence: 'low', impact: 'high', status: 'edited' },
        ];
        const result = formatAssumptionsContext(assumptions);
        expect(result).toContain('[EDITED]');
        expect(result).toContain('Revised assumption');
        expect(result).not.toContain('Original');
    });

    it('defaults to pending when status is missing', () => {
        const assumptions = [
            { text: 'Something', rationale: 'x', confidence: 'low', impact: 'low' },
        ];
        const result = formatAssumptionsContext(assumptions);
        expect(result).toContain('[PENDING]');
    });

    it('uses original text for edited status without editedText', () => {
        const assumptions = [
            { text: 'Original', rationale: 'x', confidence: 'high', impact: 'high', status: 'edited' },
        ];
        const result = formatAssumptionsContext(assumptions);
        expect(result).toContain('Original');
    });
});
