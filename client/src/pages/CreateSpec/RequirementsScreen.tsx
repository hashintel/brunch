import { useState } from 'preact/hooks';
import type { RequirementsData, WizardRequirement, WizardCheck } from './types';

interface Props {
    data: RequirementsData;
    onToggle: (id: string) => void;
    onContinue: () => void;
    loading?: boolean;
    selectedId?: string | null;
    onSelect?: (id: string) => void;
}

export function RequirementsScreen({ data, onToggle, onContinue, loading, selectedId, onSelect }: Props) {
    const { stats } = data;

    return (
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
