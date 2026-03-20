import { useState, useCallback } from 'preact/hooks';
import type { DoltCommit, DoltChange, DoltDiffRow, SessionData } from './types';
import { apiFetch } from './apiFetch';

/** Fields that are Dolt metadata / internal — not real data changes */
const DIFF_HIDDEN_FIELDS = new Set([
    'pk', 'diff_type', 'project_id', 'parent_id', 'sort_order', 'created_at', 'updated_at',
    'commit', 'commit_date',
    'current_questions', 'current_answers', 'clarifying_state',
]);

/** Check if a diff row has any real (non-metadata) field changes */
function hasRealChanges(row: DoltDiffRow): boolean {
    if (row.diff_type !== 'modified') return true;
    for (const k of Object.keys(row)) {
        if (!k.startsWith('from_')) continue;
        const field = k.slice(5);
        if (DIFF_HIDDEN_FIELDS.has(field)) continue;
        if (row[k] !== row[k.replace('from_', 'to_')]) return true;
    }
    return false;
}

export function useVersions() {
    const [commits, setCommits] = useState<DoltCommit[]>([]);
    const [workingDiff, setWorkingDiff] = useState<{ tables: Record<string, DoltDiffRow[]>; from: string; to: string } | null>(null);
    const [realChangeCount, setRealChangeCount] = useState(0);
    const [changedTableNames, setChangedTableNames] = useState<string[]>([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [committing, setCommitting] = useState(false);
    const [selectedDiff, setSelectedDiff] = useState<{ tables: Record<string, DoltDiffRow[]>; from: string; to: string } | null>(null);
    const [loadingDiffHash, setLoadingDiffHash] = useState<string | null>(null);
    const [checkedOutHash, setCheckedOutHash] = useState<string | null>(null);
    const [checkoutData, setCheckoutData] = useState<SessionData | null>(null);
    const [loadingCheckoutHash, setLoadingCheckoutHash] = useState<string | null>(null);

    const [projectId, setProjectId] = useState<string | null>(null);

    const refreshLog = useCallback(async (pid?: string | null) => {
        const id = pid ?? projectId;
        try {
            const qs = id ? `?limit=50&projectId=${encodeURIComponent(id)}` : '?limit=50';
            const data = await apiFetch<{ commits: DoltCommit[] }>(`/api/versions/log${qs}`);
            setCommits(data.commits);
        } catch {
            // Dolt may not be available
        }
    }, [projectId]);

    const refreshStatus = useCallback(async () => {
        try {
            const data = await apiFetch<{ tables: Record<string, DoltDiffRow[]>; from: string; to: string }>(
                '/api/versions/diff/working'
            );
            setWorkingDiff(data);
            // Count only rows with real data changes
            let count = 0;
            const tables: string[] = [];
            for (const [table, rows] of Object.entries(data.tables)) {
                const realRows = rows.filter(hasRealChanges);
                if (realRows.length > 0) {
                    count += realRows.length;
                    tables.push(table);
                }
            }
            setRealChangeCount(count);
            setChangedTableNames(tables);
        } catch {
            setWorkingDiff(null);
            setRealChangeCount(0);
            setChangedTableNames([]);
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

    const viewWorkingDiff = useCallback(() => {
        if (workingDiff) {
            setSelectedDiff(workingDiff);
        }
    }, [workingDiff]);

    const checkout = useCallback(async (hash: string, sessionId: string): Promise<SessionData | null> => {
        setLoadingCheckoutHash(hash);
        try {
            const data = await apiFetch<SessionData>(`/api/versions/checkout/${hash}?sessionId=${sessionId}`);
            setCheckedOutHash(hash);
            setCheckoutData(data);
            return data;
        } catch (e: any) {
            console.error('Checkout failed:', e.message);
            return null;
        } finally {
            setLoadingCheckoutHash(null);
        }
    }, []);

    const exitCheckout = useCallback(() => {
        setCheckedOutHash(null);
        setCheckoutData(null);
    }, []);

    const revert = useCallback(async (hash: string) => {
        if (!window.confirm(`Revert to commit ${hash.slice(0, 7)}? This will discard all changes since that commit.`)) return;
        try {
            await apiFetch(`/api/versions/revert/${hash}`, { method: 'POST' });
            exitCheckout();
            await refresh();
        } catch (e: any) {
            console.error('Revert failed:', e.message);
        }
    }, [refresh, exitCheckout]);

    return {
        commits,
        realChangeCount,
        changedTableNames,
        commitMessage,
        setCommitMessage,
        committing,
        selectedDiff,
        setSelectedDiff,
        loadingDiffHash,
        checkedOutHash,
        checkoutData,
        loadingCheckoutHash,
        setProjectId,
        refresh,
        refreshLog,
        refreshStatus,
        commit,
        viewDiff,
        viewWorkingDiff,
        revert,
        checkout,
        exitCheckout,
    };
}

export type VersionsHandle = ReturnType<typeof useVersions>;
