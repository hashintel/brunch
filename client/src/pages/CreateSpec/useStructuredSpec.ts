import { useState } from 'preact/hooks';
import { apiFetch } from '../Home/apiFetch';
import type { StructuredSpec, SpecSection } from './types';

interface UseStructuredSpecParams {
    selectedModel: string;
}

export function useStructuredSpec({ selectedModel }: UseStructuredSpecParams) {
    const [spec, setSpec] = useState<StructuredSpec | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function generate(prompt: string, answers?: { question: string; selectedLabels: string[]; otherText: string; skipped: boolean }[]) {
        setLoading(true);
        setError('');
        try {
            const data = await apiFetch<StructuredSpec>('/api/spec-wizard/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, answers }),
            });
            setSpec(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate spec');
        } finally {
            setLoading(false);
        }
    }

    function updateSection(index: number, updates: Partial<SpecSection>) {
        setSpec(prev => {
            if (!prev) return prev;
            const sections = [...prev.sections];
            sections[index] = { ...sections[index], ...updates };
            return { ...prev, sections };
        });
    }

    function reset() {
        setSpec(null);
        setLoading(false);
        setError('');
    }

    return { spec, loading, error, generate, updateSection, reset };
}
