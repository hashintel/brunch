import type { WizardScreen } from './types';

const STEPS = [
    { key: 'clarify', label: 'Clarify' },
    { key: 'assumptions', label: 'Assumptions' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'overview', label: 'Overview' },
] as const;

const STEP_ORDER: Record<string, number> = {
    clarify: 0,
    assumptions: 1,
    requirements: 2,
    overview: 3,
};

interface StepIndicatorProps {
    screen: WizardScreen;
}

export function StepIndicator({ screen }: StepIndicatorProps) {
    const activeIndex = STEP_ORDER[screen] ?? -1;

    return (
        <div class="cs-steps">
            {STEPS.map((step, i) => {
                const state = i < activeIndex ? 'complete' : i === activeIndex ? 'active' : 'upcoming';
                return (
                    <div key={step.key} class={`cs-steps__item cs-steps__item--${state}`}>
                        <div class="cs-steps__circle">
                            {state === 'complete' ? (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            ) : (
                                <span>{i + 1}</span>
                            )}
                        </div>
                        <span class="cs-steps__label">{step.label}</span>
                        {i < STEPS.length - 1 && <div class="cs-steps__connector" />}
                    </div>
                );
            })}
        </div>
    );
}
