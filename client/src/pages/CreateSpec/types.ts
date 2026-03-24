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

export type WizardScreen = 'landing' | 'loading' | 'clarify';
