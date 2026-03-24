import { useState } from 'preact/hooks';
import { ConfidenceBar } from './ConfidenceBar';
import { SpecSection } from './SpecSection';
import { SkeletonLoader } from './SkeletonLoader';
import type { StructuredSpec, SpecSection as SpecSectionType } from './types';

const TABS = ['Overview', 'Requirements', 'Success criteria', 'Assumptions'] as const;
type Tab = typeof TABS[number];

const TAB_SECTIONS: Record<Tab, string[]> = {
    'Overview': ['purpose'],
    'Requirements': ['deliverables'],
    'Success criteria': ['success_criteria'],
    'Assumptions': ['risks'],
};

interface Props {
    spec: StructuredSpec | null;
    loading: boolean;
    onUpdateSection: (index: number, updates: Partial<SpecSectionType>) => void;
}

export function SpecPreviewPanel({ spec, loading, onUpdateSection }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('Overview');

    const filteredSections = spec?.sections.filter(s =>
        TAB_SECTIONS[activeTab].includes(s.type)
    ) ?? [];

    return (
        <div class="create-spec__preview-panel">
            <ConfidenceBar
                confidence={spec?.overallConfidence ?? 0}
            />

            <div class="create-spec__tabs">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        class={`create-spec__tab ${activeTab === tab ? 'create-spec__tab--active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div class="create-spec__tab-content">
                {loading && !spec ? (
                    <div class="create-spec__skeleton-cards">
                        <SkeletonLoader lines={4} />
                        <SkeletonLoader lines={3} />
                    </div>
                ) : filteredSections.length > 0 ? (
                    filteredSections.map(section => {
                        const idx = spec!.sections.indexOf(section);
                        return (
                            <SpecSection
                                key={section.type}
                                section={section}
                                onUpdate={(updates) => onUpdateSection(idx, updates)}
                            />
                        );
                    })
                ) : (
                    <div class="create-spec__empty-card">
                        <p>Answer questions to populate this section</p>
                    </div>
                )}

                {loading && spec && (
                    <div class="create-spec__updating-indicator">Updating spec...</div>
                )}
            </div>
        </div>
    );
}
