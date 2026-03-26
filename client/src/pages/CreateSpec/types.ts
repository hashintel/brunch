export interface SpecQuestion {
    id: string;
    question: string;
    why: string;
    impact: 'high' | 'medium' | 'low';
    selectionType: 'single' | 'multi';
    options: { label: string }[];
}

export interface SpecAnswer {
    selectedLabels: string[];
    otherText: string;
    skipped: boolean;
}

export interface RiskItem {
    risk: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
}

export interface SpecSection {
    type: 'purpose' | 'success_criteria' | 'deliverables' | 'risks';
    confidence: number;
    content: string;
    items?: string[];
    risks?: RiskItem[];
    assumptions?: string[];
}

export interface StructuredSpec {
    overallConfidence: number;
    sections: SpecSection[];
}

// Assumptions
export interface WizardAssumption {
    id: string;
    label: string;
    text: string;
    rationale: string;
    impact: 'high' | 'medium' | 'low';
    confidence: 'high' | 'medium' | 'low';
    status: 'pending' | 'confirmed' | 'edited' | 'rejected';
    editedText?: string;
    options?: string[];
}

// Requirements
export interface WizardCheck {
    description: string;
    type: 'benchmark' | 'e2e' | 'unit' | 'human_review' | 'static_analysis';
    passed?: boolean;
}

export interface WizardRequirement {
    id: string;
    title: string;
    checks: WizardCheck[];
    status?: 'uncertain' | 'decision_node' | 'ok';
    children: WizardRequirement[];
    expanded?: boolean;
}

export interface RequirementsData {
    title: string;
    description: string;
    stats: {
        uncertain: number;
        decisionNode: number;
        checksTotal: number;
        checksWithChecks: number;
        automated: number;
        humanReview: number;
        totalRequirements: number;
    };
    requirements: WizardRequirement[];
}

export type WizardScreen = 'landing' | 'loading' | 'clarify' | 'assumptions' | 'requirements' | 'overview';

export type FocusedItem =
    | { type: 'assumption'; item: WizardAssumption }
    | { type: 'requirement'; item: WizardRequirement }
    | { type: 'question'; item: SpecQuestion; answer?: SpecAnswer }
    | null;
