import { useState } from 'preact/hooks';
import type { WizardScreen } from './types';

interface ProgressSidebarProps {
    screen: WizardScreen;
    specLoading: boolean;
    assumptionsLoading: boolean;
    requirementsLoading: boolean;
}

type ItemState = 'complete' | 'loading' | 'current' | 'pending';

const SCREEN_ORDER = ['clarify', 'assumptions', 'requirements', 'overview'] as const;

function getScreenIndex(screen: WizardScreen): number {
    return SCREEN_ORDER.indexOf(screen as typeof SCREEN_ORDER[number]);
}

function CheckIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.2 7.5L8 2.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    );
}

function ChevronIcon({ open }: { open?: boolean }) {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    );
}

function StatusIcon({ state }: { state: ItemState }) {
    if (state === 'complete') {
        return <span class="cs-sidebar__icon cs-sidebar__icon--complete"><CheckIcon /></span>;
    }
    if (state === 'loading') {
        return <span class="cs-sidebar__icon cs-sidebar__icon--active" />;
    }
    if (state === 'current') {
        return <span class="cs-sidebar__icon cs-sidebar__icon--current" />;
    }
    return <span class="cs-sidebar__icon cs-sidebar__icon--pending" />;
}

export function ProgressSidebar({ screen, specLoading, assumptionsLoading, requirementsLoading }: ProgressSidebarProps) {
    const [specOpen, setSpecOpen] = useState(true);
    const idx = getScreenIndex(screen);

    // Defining: loading when spec is generating, complete once on clarify+, pending otherwise
    const definingState: ItemState =
        specLoading ? 'loading'
        : idx >= 0 ? 'complete'
        : 'pending';

    // Clarify: complete when past clarify, current when on clarify, pending otherwise
    const clarifyState: ItemState =
        idx > 0 ? 'complete'
        : idx === 0 ? 'current'
        : 'pending';

    // Project Spec group: derives from children
    const specGroupActive = definingState === 'loading' || definingState === 'current' || clarifyState === 'loading' || clarifyState === 'current';
    const specGroupState: ItemState =
        definingState === 'loading' ? 'loading'
        : specGroupActive ? 'current'
        : definingState === 'complete' && clarifyState === 'complete' ? 'complete'
        : 'pending';

    // Assumptions: loading only when AI is generating, current when on step but idle
    const assumptionsState: ItemState =
        idx > 1 ? 'complete'
        : idx === 1 ? (assumptionsLoading ? 'loading' : 'current')
        : 'pending';

    // Requirements: loading only when AI is generating
    const requirementsState: ItemState =
        idx > 2 ? 'complete'
        : idx === 2 ? (requirementsLoading ? 'loading' : 'current')
        : 'pending';

    // Gaps & Surprises (overview)
    const overviewState: ItemState =
        idx === 3 ? 'current' : 'pending';

    const activeClass = (state: ItemState) =>
        state === 'loading' || state === 'current' ? 'active' : state;

    return (
        <nav class="cs-sidebar">
            {/* Project Spec group */}
            <button
                class={`cs-sidebar__group-header cs-sidebar__group-header--${activeClass(specGroupState)}`}
                onClick={() => setSpecOpen(!specOpen)}
            >
                <StatusIcon state={specGroupState} />
                <span class="cs-sidebar__label">Project Spec</span>
                <span class="cs-sidebar__chevron"><ChevronIcon open={specOpen} /></span>
            </button>

            {specOpen && (
                <div class="cs-sidebar__sub-items">
                    <div class={`cs-sidebar__sub-item cs-sidebar__sub-item--${activeClass(definingState)}`}>
                        <StatusIcon state={definingState} />
                        <span class="cs-sidebar__sub-label">Defining</span>
                    </div>
                    <div class={`cs-sidebar__sub-item cs-sidebar__sub-item--${activeClass(clarifyState)}`}>
                        <StatusIcon state={clarifyState} />
                        <span class="cs-sidebar__sub-label">Clarify specification</span>
                    </div>
                </div>
            )}

            {/* Assumptions */}
            <div class={`cs-sidebar__item cs-sidebar__item--${activeClass(assumptionsState)}`}>
                <StatusIcon state={assumptionsState} />
                <span class="cs-sidebar__label">Assumptions</span>
                <span class="cs-sidebar__chevron"><ChevronIcon /></span>
            </div>

            {/* Requirements */}
            <div class={`cs-sidebar__item cs-sidebar__item--${activeClass(requirementsState)}`}>
                <StatusIcon state={requirementsState} />
                <span class="cs-sidebar__label">Requirements</span>
            </div>

            {/* Gaps & Surprises */}
            <div class={`cs-sidebar__item cs-sidebar__item--${activeClass(overviewState)}`}>
                <StatusIcon state={overviewState} />
                <span class="cs-sidebar__label">Gaps & Surprises</span>
            </div>
        </nav>
    );
}
