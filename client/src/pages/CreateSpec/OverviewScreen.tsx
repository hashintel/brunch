import { useState } from 'preact/hooks';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SpecSection } from './SpecSection';
import type { StructuredSpec, SpecSection as SpecSectionType, RequirementsData } from './types';

interface Props {
    title: string;
    spec: StructuredSpec;
    requirements: RequirementsData | null;
    onUpdateSection: (index: number, updates: Partial<SpecSectionType>) => void;
    onApprove: () => void;
}

export function OverviewScreen({ title, spec, requirements, onUpdateSection, onApprove }: Props) {
    const [activeTab, setActiveTab] = useState<'overview' | 'requirements'>('overview');

    const completeness = Math.min(100, Math.round(spec.overallConfidence * 1.3));
    const verification = Math.min(100, Math.round(spec.overallConfidence * 0.9));

    return (
        <div class="cs-overview">
            <div class="cs-overview__content">
                <div class="cs-overview__header">
                    <h1 class="cs-overview__title">{title}</h1>

                    <div class="cs-overview__meta">
                        <div class="cs-overview__meta-item">
                            <span class="cs-overview__meta-label">Generated on</span>
                            <span class="cs-overview__meta-value">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div class="cs-overview__meta-item">
                            <span class="cs-overview__meta-label">Last edited</span>
                            <span class="cs-overview__meta-value">Just now</span>
                        </div>
                        <div class="cs-overview__meta-item">
                            <span class="cs-overview__meta-label">Overall Confidence</span>
                            <span class="cs-overview__meta-value">
                                <ConfidenceBadgeInline confidence={spec.overallConfidence} />
                                {Math.round(spec.overallConfidence)}%
                            </span>
                        </div>
                        <button class="cs-overview__approve-btn" onClick={onApprove}>
                            Approve &amp; Continue
                        </button>
                    </div>

                    <div class="cs-overview__stat-cards">
                        <ProgressCard label="Completeness" value={completeness} color={completeness >= 67 ? '#3cba49' : completeness >= 34 ? '#ff9d1c' : '#e14640'} />
                        <ProgressCard label="Verification Coverage" value={verification} color={verification >= 67 ? '#3cba49' : verification >= 34 ? '#ff9d1c' : '#e14640'} />
                    </div>
                </div>

                <div class="cs-overview__tabs">
                    <button
                        class={`cs-overview__tab ${activeTab === 'overview' ? 'cs-overview__tab--active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        class={`cs-overview__tab ${activeTab === 'requirements' ? 'cs-overview__tab--active' : ''}`}
                        onClick={() => setActiveTab('requirements')}
                    >
                        Requirements
                    </button>
                </div>

                {activeTab === 'overview' && (
                    <div class="cs-overview__sections">
                        {spec.sections.map((section, i) => (
                            <SpecSection
                                key={section.type}
                                section={section}
                                onUpdate={(updates) => onUpdateSection(i, updates)}
                            />
                        ))}
                    </div>
                )}

                {activeTab === 'requirements' && requirements && (
                    <div class="cs-overview__sections">
                        {requirements.requirements.map(req => (
                            <div key={req.id} class="cs-overview__req-card">
                                <div class="cs-overview__req-header">
                                    <span class="cs-overview__req-id">{req.id}</span>
                                    <span class="cs-overview__req-title">{req.title}</span>
                                    {req.status === 'uncertain' && (
                                        <span class="cs-overview__req-uncertain">&#9888; Uncertain</span>
                                    )}
                                </div>
                                <div class="cs-overview__req-meta">
                                    <span>{req.checks.length} checks</span>
                                    <span>{req.children?.length ?? 0} sub-requirements</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'requirements' && !requirements && (
                    <div class="cs-overview__empty">No requirements data available</div>
                )}
            </div>
        </div>
    );
}

function ProgressCard({ label, value, color }: { label: string; value: number; color: string }) {
    const bgColor = color + '33';
    return (
        <div class="cs-overview__progress-card">
            <span class="cs-overview__progress-label">{label}</span>
            <div class="cs-overview__progress-row">
                <span class="cs-overview__progress-value">{value}%</span>
                <div class="cs-overview__progress-track">
                    <div class="cs-overview__progress-fill" style={{ width: `${value}%`, background: color }} />
                </div>
            </div>
        </div>
    );
}

function ConfidenceBadgeInline({ confidence }: { confidence: number }) {
    const color = confidence >= 67 ? '#3cba49' : confidence >= 34 ? '#ff9d1c' : '#e14640';
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
            <rect x="2" y="12" width="4" height="6" rx="1" fill={color} opacity={confidence >= 20 ? 1 : 0.3} />
            <rect x="8" y="8" width="4" height="10" rx="1" fill={color} opacity={confidence >= 50 ? 1 : 0.3} />
            <rect x="14" y="4" width="4" height="14" rx="1" fill={color} opacity={confidence >= 75 ? 1 : 0.3} />
        </svg>
    );
}
