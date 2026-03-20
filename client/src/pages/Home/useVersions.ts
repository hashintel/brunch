import { useState, useCallback } from 'preact/hooks';
import type { DoltCommit, DoltChange, DoltDiffRow } from './types';
import { apiFetch } from './apiFetch';

export function useVersions() {
    const [commits, setCommits] = useState<DoltCommit[]>([]);
    const [changes, setChanges] = useState<DoltChange[]>([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [committing, setCommitting] = useState(false);
    const [selectedDiff, setSelectedDiff] = useState<{ tables: Record<string, DoltDiffRow[]>; from: string; to: string } | null>(null);
    const [loadingDiffHash, setLoadingDiffHash] = useState<string | null>(null);

    const refreshLog = useCallback(async () => {
        try {
            const data = await apiFetch<{ commits: DoltCommit[] }>('/api/versions/log?limit=50');
            setCommits(data.commits);
        } catch {
            // Dolt may not be available
        }
    }, []);

    const refreshStatus = useCallback(async () => {
        try {
            const data = await apiFetch<{ changes: DoltChange[] }>('/api/versions/status');
            setChanges(data.changes);
        } catch {
            // Dolt may not be available
        }
    }, []);

    const refresh = useCallback(async () => {
        await Promise.all([refreshLog(), refreshStatus()]);
    }, [refreshLog, refreshStatus]);

    const commit = useCallback(async (message: string) => {
        if (!message.trim()) return;
        setCommitting(true);
        try {
            await apiFetch('/api/versions/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message.trim() }),
            });
            setCommitMessage('');
            await refresh();
        } catch (e: any) {
            console.error('Commit failed:', e.message);
        } finally {
            setCommitting(false);
        }
    }, [refresh]);

    const viewDiff = useCallback(async (hash: string) => {
        setLoadingDiffHash(hash);
        try {
            const data = await apiFetch<{ tables: Record<string, DoltDiffRow[]>; from: string; to: string }>(
                `/api/versions/diff/${hash}`
            );
            setSelectedDiff(data);
        } catch (e: any) {
            console.error('Diff failed:', e.message);
        } finally {
            setLoadingDiffHash(null);
        }
    }, []);

    const revert = useCallback(async (hash: string) => {
        if (!window.confirm(`Revert to commit ${hash.slice(0, 7)}? This will discard all changes since that commit.`)) return;
        try {
            await apiFetch(`/api/versions/revert/${hash}`, { method: 'POST' });
            await refresh();
        } catch (e: any) {
            console.error('Revert failed:', e.message);
        }
    }, [refresh]);

    return {
        commits,
        changes,
        commitMessage,
        setCommitMessage,
        committing,
        selectedDiff,
        setSelectedDiff,
        loadingDiffHash,
        refresh,
        refreshLog,
        refreshStatus,
        commit,
        viewDiff,
        revert,
    };
}
