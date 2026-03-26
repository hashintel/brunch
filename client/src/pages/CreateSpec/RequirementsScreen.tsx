import { useState } from 'preact/hooks';
import type { RequirementsData, WizardRequirement, WizardCheck } from './types';

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
    uncertain: { color: '#f59e0b', label: 'Uncertain' },
    decision_node: { color: '#e14640', label: 'Decision Node' },
    ok: { color: '#3cba49', label: 'OK' },
};

const CHECK_TYPE_LABELS: Record<string, string> = {
    benchmark: 'Benchmark',
    e2e: 'E2E Test',
    unit: 'Unit Test',
    human_review: 'Human Review',
    static_analysis: 'Static Analysis',
};

interface Props {
    data: RequirementsData;
    onToggle: (id: string) => void;
    onContinue: () => void;
    loading?: boolean;
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    onUpdate?: (input: { id: string; title?: string; status?: string }) => void;
}

export function RequirementsScreen({ data, onToggle, onContinue, loading, selectedId, onSelect, onUpdate }: Props) {
    const { stats } = data;
    const selected = selectedId ? findInTree(data.requirements, selectedId) : null;

    return (
        <div class="cs-reqs-layout">
            <div class="cs-reqs">
                <div class="cs-reqs__header">
                    <h2 class="cs-reqs__title">{data.title}</h2>
                    <p class="cs-reqs__description">{data.description}</p>
                </div>

                <div class="cs-reqs__stats">
                    <StatCard label="Uncertain" value={`${stats.uncertain} / ${stats.totalRequirements}`} />
                    <StatCard label="Decision node" value={`${stats.decisionNode} / ${stats.totalRequirements}`} />
                    <StatCard
                        label="Requirements have checks"
                        value={`${stats.checksWithChecks} / ${stats.totalRequirements}`}
                        progress={stats.totalRequirements > 0 ? stats.checksWithChecks / stats.totalRequirements : 0}
                    />
                    <div class="cs-reqs__stat-card cs-reqs__stat-card--wide">
                        <div class="cs-reqs__stat-pair">
                            <div>
                                <span class="cs-reqs__stat-label">Automated</span>
                                <div class="cs-reqs__stat-value-row">
                                    <span class="cs-reqs__stat-value">{stats.totalRequirements > 0 ? Math.round(stats.automated / (stats.automated + stats.humanReview) * 100) : 0}%</span>
                                    <span class="cs-reqs__stat-sub">{stats.automated}/{stats.automated + stats.humanReview}</span>
                                </div>
                            </div>
                            <div>
                                <span class="cs-reqs__stat-label">Human review</span>
                                <div class="cs-reqs__stat-value-row">
                                    <span class="cs-reqs__stat-value">{stats.totalRequirements > 0 ? Math.round(stats.humanReview / (stats.automated + stats.humanReview) * 100) : 0}%</span>
                                    <span class="cs-reqs__stat-sub">{stats.humanReview}/{stats.automated + stats.humanReview}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="cs-reqs__section">
                    <h3 class="cs-reqs__section-title">Requirements</h3>
                    <div class="cs-reqs__list">
                        {data.requirements.map(req => (
                            <RequirementCard key={req.id} requirement={req} depth={0} onToggle={onToggle} selectedId={selectedId} onSelect={onSelect} />
                        ))}
                    </div>
                </div>

                {loading && (
                    <div class="cs-reqs__streaming">Building requirements...</div>
                )}

                <div class="cs-reqs__continue-wrap">
                    <button class="cs-reqs__continue-btn" onClick={onContinue} disabled={loading}>
                        Approve &amp; Continue
                    </button>
                </div>
            </div>

            <div class="cs-reqs__detail">
                {selected && (
                    <RequirementDetail
                        key={selected.id}
                        requirement={selected}
                        onUpdate={onUpdate}
                    />
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, progress }: { label: string; value: string; progress?: number }) {
    return (
        <div class="cs-reqs__stat-card">
            <span class="cs-reqs__stat-label">{label}</span>
            <div class="cs-reqs__stat-value-row">
                <span class="cs-reqs__stat-value">{value}</span>
                {progress !== undefined && (
                    <div class="cs-reqs__mini-progress">
                        <div class="cs-reqs__mini-progress-fill" style={{ width: `${progress * 100}%` }} />
                    </div>
                )}
            </div>
        </div>
    );
}

function RequirementCard({ requirement: r, depth, onToggle, selectedId, onSelect }: {
    requirement: WizardRequirement;
    depth: number;
    onToggle: (id: string) => void;
    selectedId?: string | null;
    onSelect?: (id: string) => void;
}) {
    const [checksOpen, setChecksOpen] = useState(false);
    const hasChildren = r.children && r.children.length > 0;
    const totalChecks = countChecks(r);
    const childrenWithChecks = countChildrenWithChecks(r);
    const totalChildren = countAllChildren(r);

    return (
        <div class={`cs-req ${depth > 0 ? 'cs-req--nested' : ''} ${r.id === selectedId ? 'cs-req--selected' : ''}`}>
            <div class="cs-req__main">
                {/* Header row */}
                <div class="cs-req__header" onClick={() => { onSelect?.(r.id); if (hasChildren) onToggle(r.id); }}>
                    {depth > 0 && <span class="cs-req__branch">&#8627;</span>}
                    <div class="cs-req__info">
                        {depth === 0 && <span class="cs-req__id-label">{r.id}</span>}
                        <div class="cs-req__title-row">
                            {depth > 0 && <span class="cs-req__id">{r.id}</span>}
                            <span class={depth === 0 ? 'cs-req__title' : 'cs-req__title--sub'}>{r.title}</span>
                            {totalChecks > 0 && (
                                <span class="cs-req__check-badge">
                                    &#10003; {totalChecks}
                                </span>
                            )}
                            {r.status === 'uncertain' && (
                                <span class="cs-req__uncertain-badge">&#9888; Uncertain</span>
                            )}
                        </div>
                    </div>
                    <div class="cs-req__right">
                        {totalChildren > 0 && (
                            <span class="cs-req__children-info">
                                <strong>{childrenWithChecks} / {totalChildren}</strong> sub-requirements have checks
                            </span>
                        )}
                        {hasChildren && (
                            <span class={`cs-req__chevron ${r.expanded ? 'cs-req__chevron--open' : ''}`}>&#9654;</span>
                        )}
                    </div>
                </div>

                {/* Expanded children */}
                {r.expanded && hasChildren && (
                    <div class="cs-req__children-section">
                        <div class="cs-req__children-toggle" onClick={() => onToggle(r.id)}>
                            <span>{r.children.length} sub-requirements</span>
                            <span class="cs-req__chevron cs-req__chevron--open">&#9654;</span>
                        </div>
                        {r.children.map(child => (
                            <RequirementCard key={child.id} requirement={child} depth={depth + 1} onToggle={onToggle} selectedId={selectedId} onSelect={onSelect} />
                        ))}
                    </div>
                )}

                {!r.expanded && hasChildren && (
                    <div class="cs-req__children-toggle" onClick={() => onToggle(r.id)}>
                        <span>{r.children.length} sub-requirements</span>
                        <span class="cs-req__chevron">&#9654;</span>
                    </div>
                )}
            </div>

            {/* Checks section */}
            {r.checks.length > 0 && (
                <div class="cs-req__checks">
                    <div class="cs-req__checks-header" onClick={() => setChecksOpen(!checksOpen)}>
                        <span>Checks</span>
                        <span class={`cs-req__chevron ${checksOpen ? 'cs-req__chevron--open' : ''}`}>&#9654;</span>
                    </div>
                    {checksOpen && (
                        <div class="cs-req__checks-list">
                            {r.checks.map((c, i) => (
                                <div key={i} class="cs-req__check-item">
                                    <span class="cs-req__check-desc">{c.description}</span>
                                    <span class="cs-req__check-type">{c.type}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function countChecks(r: WizardRequirement): number {
    let total = r.checks.length;
    r.children?.forEach(c => { total += countChecks(c); });
    return total;
}

function countChildrenWithChecks(r: WizardRequirement): number {
    let count = 0;
    function walk(req: WizardRequirement) {
        if (req.checks.length > 0) count++;
        req.children?.forEach(walk);
    }
    r.children?.forEach(walk);
    return count;
}

function countAllChildren(r: WizardRequirement): number {
    let count = 0;
    function walk(req: WizardRequirement) {
        count++;
        req.children?.forEach(walk);
    }
    r.children?.forEach(walk);
    return count;
}

function findInTree(reqs: WizardRequirement[], id: string): WizardRequirement | null {
    for (const r of reqs) {
        if (r.id === id) return r;
        if (r.children?.length) {
            const found = findInTree(r.children, id);
            if (found) return found;
        }
    }
    return null;
}

function RequirementDetail({ requirement: r, onUpdate }: {
    requirement: WizardRequirement;
    onUpdate?: (input: { id: string; title?: string; status?: string }) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(r.title);
    const status = STATUS_COLORS[r.status ?? 'ok'] ?? STATUS_COLORS.ok;
    const totalChecks = countChecks(r);
    const totalChildren = countAllChildren(r);

    function handleSave() {
        if (editTitle.trim() && editTitle !== r.title) {
            onUpdate?.({ id: r.id, title: editTitle.trim() });
        }
        setEditing(false);
    }

    return (
        <div class="cs-req-detail">
            <div class="cs-req-detail__header">
                <div class="cs-req-detail__badges">
                    <span class="cs-req-detail__id">{r.id}</span>
                    <span class="cs-req-detail__divider" />
                    <span class="cs-req-detail__status" style={{ color: status.color }}>
                        &#9679; {status.label}
                    </span>
                </div>
                <div class="cs-req-detail__actions">
                    {r.status === 'uncertain' && (
                        <button
                            class="cs-req-detail__resolve-btn"
                            onClick={() => onUpdate?.({ id: r.id, status: 'ok' })}
                        >
                            Mark OK
                        </button>
                    )}
                </div>
            </div>

            <div class="cs-req-detail__content">
                {editing ? (
                    <div class="cs-req-detail__edit-row">
                        <input
                            type="text"
                            class="cs-req-detail__edit-input"
                            value={editTitle}
                            onInput={(e) => setEditTitle((e.target as HTMLInputElement).value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                            autoFocus
                        />
                        <button class="cs-req-detail__save-btn" onClick={handleSave}>Save</button>
                        <button class="cs-req-detail__cancel-btn" onClick={() => { setEditing(false); setEditTitle(r.title); }}>Cancel</button>
                    </div>
                ) : (
                    <div class="cs-req-detail__title-row">
                        <h3 class="cs-req-detail__title">{r.title}</h3>
                        <button class="cs-req-detail__edit-btn" onClick={() => setEditing(true)}>Edit</button>
                    </div>
                )}
            </div>

            <hr class="cs-req-detail__divider-line" />

            {/* Summary stats */}
            <div class="cs-req-detail__meta">
                {totalChildren > 0 && (
                    <span class="cs-req-detail__meta-item">{totalChildren} sub-requirement{totalChildren !== 1 ? 's' : ''}</span>
                )}
                {totalChecks > 0 && (
                    <span class="cs-req-detail__meta-item">{totalChecks} check{totalChecks !== 1 ? 's' : ''}</span>
                )}
            </div>

            {/* Checks */}
            {r.checks.length > 0 && (
                <div class="cs-req-detail__checks">
                    <h4 class="cs-req-detail__section-title">Checks</h4>
                    <div class="cs-req-detail__checks-list">
                        {r.checks.map((c, i) => (
                            <div key={i} class="cs-req-detail__check">
                                <span class="cs-req-detail__check-type">{CHECK_TYPE_LABELS[c.type] ?? c.type}</span>
                                <span class="cs-req-detail__check-desc">{c.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Children */}
            {r.children.length > 0 && (
                <div class="cs-req-detail__children">
                    <h4 class="cs-req-detail__section-title">Sub-requirements</h4>
                    <div class="cs-req-detail__children-list">
                        {r.children.map(child => {
                            const cs = STATUS_COLORS[child.status ?? 'ok'] ?? STATUS_COLORS.ok;
                            return (
                                <div key={child.id} class="cs-req-detail__child">
                                    <span class="cs-req-detail__child-id">{child.id}</span>
                                    <span class="cs-req-detail__child-title">{child.title}</span>
                                    <span class="cs-req-detail__child-status" style={{ color: cs.color }}>
                                        {cs.label}
                                    </span>
                                    {child.checks.length > 0 && (
                                        <span class="cs-req-detail__child-checks">&#10003; {child.checks.length}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
