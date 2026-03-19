import { useEffect, useRef, useState } from 'preact/hooks';
import type { SessionData } from './types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

interface UseAutoSaveParams {
    currentSessionId: string | null;
    save: (data: SessionData) => Promise<void>;
    data: SessionData;
    busy: boolean;
}

export function useAutoSave({ currentSessionId, save, data, busy }: UseAutoSaveParams) {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const lastSavedRef = useRef<string>('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const serialized = JSON.stringify(data);

    // Reset when switching projects
    useEffect(() => {
        lastSavedRef.current = '';
        setSaveStatus('idle');
    }, [currentSessionId]);

    // Snapshot current state after load so we don't immediately re-save
    useEffect(() => {
        if (currentSessionId && lastSavedRef.current === '') {
            lastSavedRef.current = serialized;
        }
    }, [currentSessionId, serialized]);

    useEffect(() => {
        if (!currentSessionId || busy) return;

        if (serialized === lastSavedRef.current) return;

        setSaveStatus('unsaved');

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await save(data);
                lastSavedRef.current = serialized;
                setSaveStatus('saved');
            } catch {
                setSaveStatus('unsaved');
            }
        }, 2000);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [serialized, currentSessionId, busy]);

    return { saveStatus };
}
