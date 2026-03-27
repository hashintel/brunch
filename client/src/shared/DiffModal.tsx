import { useState } from 'preact/hooks';
import type { DoltDiffRow } from './types';
import type { DiffData } from './useVersions';
import { Modal } from './Modal';

/** Fields to hide from diffs — internal/noisy columns */
const DIFF_HIDDEN_FIELDS = new Set([
    'pk', 'diff_type', 'project_id', 'parent_id', 'sort_order', 'created_at', 'updated_at',
    'commit', 'commit_date',
    'current_questions', 'current_answers', 'clarifying_state',
]);

function toStr(val: unknown): string {
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function truncate(s: string, max = 120): string {
    return s.length > max ? s.slice(0, max) + '\u2026' : s;
}

function formatCellValue(val: unknown): string {
    const s = toStr(val);
    return s === '' ? '(empty)' : truncate(s);
}

/** Extract field names from a diff row (strips from_/to_ prefixes) */
function getFields(row: DoltDiffRow): string[] {
    const fields = new Set<string>();
    for (const k of Object.keys(row)) {
        if (k.startsWith('from_')) fields.add(k.slice(5));
        else if (k.startsWith('to_')) fields.add(k.slice(3));
    }
    return [...fields].filter(f => !DIFF_HIDDEN_FIELDS.has(f));
}

/** For added/removed rows, get the relevant values */
function getRowValues(row: DoltDiffRow, prefix: 'from' | 'to'): Array<{ field: string; value: string }> {
    return getFields(row)
        .map(f => ({ field: f, value: formatCellValue(row[`${prefix}_${f}`]) }))
        .filter(({ value }) => value !== '(empty)');
}

/** For modified rows, get only fields that changed (keeps raw values for text diff) */
function getModifiedFields(row: DoltDiffRow): Array<{ field: string; from: string; to: string; rawFrom: string; rawTo: string }> {
    return getFields(row)
        .filter(f => row[`from_${f}`] !== row[`to_${f}`])
        .map(f => {
            const rawFrom = toStr(row[`from_${f}`]);
            const rawTo = toStr(row[`to_${f}`]);
            return {
                field: f,
                from: rawFrom === '' ? '(empty)' : truncate(rawFrom),
                to: rawTo === '' ? '(empty)' : truncate(rawTo),
                rawFrom,
                rawTo,
            };
        });
}

/** Threshold: fields with combined text longer than this get an expandable word diff */
const LONG_TEXT_THRESHOLD = 100;

/** Simple word-level diff using LCS */
type DiffOp = { type: 'equal' | 'add' | 'remove'; text: string };

function wordDiff(a: string, b: string): DiffOp[] {
    const wordsA = a.split(/(\s+)/);
    const wordsB = b.split(/(\s+)/);
    const m = wordsA.length, n = wordsB.length;

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = wordsA[i - 1] === wordsB[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const ops: DiffOp[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
            ops.push({ type: 'equal', text: wordsA[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.push({ type: 'add', text: wordsB[j - 1] });
            j--;
        } else {
            ops.push({ type: 'remove', text: wordsA[i - 1] });
            i--;
        }
    }
    ops.reverse();

    const merged: DiffOp[] = [];
    for (const op of ops) {
        const last = merged[merged.length - 1];
        if (last && last.type === op.type) {
            last.text += op.text;
        } else {
            merged.push({ ...op });
        }
    }
    return merged;
}

function InlineTextDiff({ from, to }: { from: string; to: string }) {
    const [expanded, setExpanded] = useState(false);

    if (!expanded) {
        return (
            <button class="diff-expand-btn" onClick={() => setExpanded(true)} title="Show full text diff">
                View diff
            </button>
        );
    }

    const ops = wordDiff(from, to);
    return (
        <div class="diff-text-inline">
            <button class="diff-expand-btn diff-expand-btn--close" onClick={() => setExpanded(false)}>
                Hide diff
            </button>
            <div class="diff-text-content">
                {ops.map((op, i) => (
                    <span key={i} class={op.type === 'equal' ? '' : op.type === 'add' ? 'diff-word-add' : 'diff-word-remove'}>
                        {op.text}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Human-readable label for a row */
function rowLabel(row: DoltDiffRow): string | null {
    const prefix = row.diff_type === 'removed' || row.diff_type === 'deleted' ? 'from' : 'to';
    return (row[`${prefix}_title`] as string)
        || (row[`${prefix}_name`] as string)
        || (row[`${prefix}_text`] as string)?.slice(0, 50)
        || (row[`${prefix}_uuid`] as string)
        || null;
}

export function DiffModal({ diff, onClose }: { diff: DiffData; onClose: () => void }) {
    const tableNames = Object.keys(diff.tables);
    return (
        <Modal title={diff.from === 'HEAD' ? 'Uncommitted Changes' : `Diff ${diff.from?.slice(0, 7) ?? '?'} \u2192 ${diff.to?.slice(0, 7) ?? '?'}`} onClose={onClose}>
            {tableNames.length === 0 && <p class="session-empty">No changes in this commit.</p>}
            {tableNames.map(table => {
                const rows = diff.tables[table];
                const realCount = rows.filter(r =>
                    r.diff_type !== 'modified' || getModifiedFields(r).length > 0
                ).length;
                if (realCount === 0) return null;
                return (
                    <div key={table} class="diff-table-section">
                        <div class="diff-table-header">
                            <strong>{table}</strong>
                            <span class="diff-table-count">{realCount} change{realCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="diff-table-rows">
                            {rows.map((row, i) => {
                                const label = rowLabel(row);
                                if (row.diff_type === 'modified') {
                                    const changes = getModifiedFields(row);
                                    if (changes.length === 0) return null;
                                    return (
                                        <div key={i} class="diff-row diff-row--modified">
                                            <span class="diff-row-type">modified</span>
                                            <div class="diff-row-detail">
                                                {label && <div class="diff-row-label">{label}</div>}
                                                {changes.map(({ field, from, to, rawFrom, rawTo }) => {
                                                    const isLong = rawFrom.length + rawTo.length > LONG_TEXT_THRESHOLD;
                                                    return (
                                                        <div key={field} class="diff-field">
                                                            <div class="diff-field-header">
                                                                <span class="diff-field-name">{field}</span>
                                                                {!isLong && <span class="diff-field-from">{from}</span>}
                                                                {!isLong && <span class="diff-field-arrow">{'\u2192'}</span>}
                                                                {!isLong && <span class="diff-field-to">{to}</span>}
                                                                {isLong && <InlineTextDiff from={rawFrom} to={rawTo} />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                const isRemoved = row.diff_type === 'removed' || row.diff_type === 'deleted';
                                const values = getRowValues(row, isRemoved ? 'from' : 'to');
                                return (
                                    <div key={i} class={`diff-row diff-row--${row.diff_type}`}>
                                        <span class="diff-row-type">{row.diff_type}</span>
                                        <div class="diff-row-detail">
                                            {label && <div class="diff-row-label">{label}</div>}
                                            {values.map(({ field, value }) => (
                                                <div key={field} class="diff-field">
                                                    <span class="diff-field-name">{field}</span>
                                                    <span class={isRemoved ? 'diff-field-from' : 'diff-field-to'}>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </Modal>
    );
}
