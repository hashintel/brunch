import './style.css';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { useSpecWizard } from './useSpecWizard';
import { useAssistantChat } from './useAssistantChat';
import { LandingScreen } from './LandingScreen';
import { ClarifyScreen } from './ClarifyScreen';
import { AssumptionsScreen } from './AssumptionsScreen';
import { RequirementsScreen } from './RequirementsScreen';
import { OverviewScreen } from './OverviewScreen';
import { SkeletonLoader } from './SkeletonLoader';
import { StepIndicator } from './StepIndicator';
import { AssistantPanel, AssistantToggle } from './AssistantPanel';
import type { Model } from '../Home/types';

export function CreateSpec() {
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [models, setModels] = useState<Model[]>([]);
    const [assistantOpen, setAssistantOpen] = useState(false);

    const { params } = useRoute();

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
    }, []);

    const wizard = useSpecWizard({
        selectedModel,
        projectId: params.projectId,
        routeStep: params.step,
    });

    const chat = useAssistantChat({
        screen: wizard.screen,
        prompt: wizard.prompt,
        selectedModel,
        getQuestions: useCallback(() => wizard.questions.questions, [wizard.questions.questions]),
        getAnswers: useCallback(() => wizard.questions.answers, [wizard.questions.answers]),
        getSpec: useCallback(() => wizard.spec.spec, [wizard.spec.spec]),
        getAssumptions: useCallback(() => wizard.assumptions.assumptions, [wizard.assumptions.assumptions]),
        getRequirements: useCallback(() => wizard.requirements.data, [wizard.requirements.data]),
        getWizardStatus: useCallback(() => {
            const parts: string[] = [];

            // Questions / Clarify phase
            if (wizard.screen === 'clarify') {
                const total = wizard.questions.questions.length;
                const answered = wizard.questions.answeredCount;
                if (wizard.questions.loading) {
                    parts.push('Generating clarifying questions...');
                } else if (total > 0) {
                    parts.push(`Clarify step: ${answered}/${total} questions answered.`);
                }
            }

            // Spec
            if (wizard.spec.loading) {
                parts.push('Generating project spec...');
            } else if (wizard.spec.spec) {
                parts.push(`Spec ready (${wizard.spec.spec.sections.length} sections, ${Math.round(wizard.spec.spec.overallConfidence)}% confidence).`);
            }

            // Assumptions
            if (wizard.screen === 'assumptions' || wizard.assumptions.assumptions.length > 0) {
                if (wizard.assumptions.loading && wizard.assumptions.assumptions.length === 0) {
                    parts.push('Generating assumptions...');
                } else if (wizard.assumptions.loading) {
                    parts.push(`Generating assumptions... (${wizard.assumptions.assumptions.length} so far)`);
                } else if (wizard.assumptions.assumptions.length > 0) {
                    const confirmed = wizard.assumptions.assumptions.filter(a => a.status === 'confirmed').length;
                    const pending = wizard.assumptions.assumptions.filter(a => a.status === 'pending').length;
                    parts.push(`${wizard.assumptions.assumptions.length} assumptions (${confirmed} confirmed, ${pending} pending).`);
                }
            }

            // Requirements
            if (wizard.screen === 'requirements' || wizard.requirements.data) {
                if (wizard.requirements.loading && !wizard.requirements.data) {
                    parts.push('Generating requirements...');
                } else if (wizard.requirements.loading) {
                    parts.push(`Generating requirements... (${wizard.requirements.data?.requirements.length ?? 0} so far)`);
                } else if (wizard.requirements.data) {
                    const s = wizard.requirements.data.stats;
                    parts.push(`${s.totalRequirements} requirements (${s.uncertain} uncertain, ${s.checksTotal} checks).`);
                }
            }

            // Overview
            if (wizard.screen === 'overview') {
                parts.push('User is reviewing the final spec overview.');
            }

            return parts.join(' ');
        }, [
            wizard.screen,
            wizard.questions.loading, wizard.questions.questions.length, wizard.questions.answeredCount,
            wizard.spec.loading, wizard.spec.spec,
            wizard.assumptions.loading, wizard.assumptions.assumptions,
            wizard.requirements.loading, wizard.requirements.data,
        ]),
        toolCallbacks: wizard.toolCallbacks,
    });

    const showStepIndicator = wizard.screen !== 'landing' && wizard.screen !== 'loading';

    return (
        <div class="create-spec">
            <div class="create-spec__header">
                <a href="/" class="create-spec__back-link">&larr; Home</a>
                {showStepIndicator && <StepIndicator screen={wizard.screen} />}
                <div class="create-spec__header-right">
                    <select
                        class="create-spec__model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel((e.target as HTMLSelectElement).value)}
                    >
                        {models.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                    </select>
                    {showStepIndicator && (
                        <button class="create-spec__save-draft-btn" onClick={wizard.save}>Save draft</button>
                    )}
                </div>
            </div>

            {wizard.resuming && (
                <div class="create-spec__loading">
                    <h2>Restoring session...</h2>
                    <SkeletonLoader lines={5} />
                </div>
            )}

            {!wizard.resuming && wizard.screen === 'landing' && (
                <LandingScreen onSubmit={wizard.submit} />
            )}

            {!wizard.resuming && wizard.screen === 'loading' && (
                <div class="create-spec__loading">
                    <h2>Analyzing your project idea...</h2>
                    <SkeletonLoader lines={5} />
                    <SkeletonLoader lines={4} />
                </div>
            )}

            {!wizard.resuming && wizard.screen === 'clarify' && (
                <ClarifyScreen
                    questions={wizard.questions.questions}
                    answers={wizard.questions.answers}
                    currentIndex={wizard.questions.currentIndex}
                    answeredCount={wizard.questions.answeredCount}
                    remainingCount={wizard.questions.remainingCount}
                    onAnswer={wizard.questions.answerQuestion}
                    onSkip={wizard.questions.skipQuestion}
                    onNext={wizard.questions.goNext}
                    onBack={wizard.questions.goBack}
                    onSkipAll={wizard.goToAssumptions}
                    spec={wizard.spec.spec}
                    specLoading={wizard.spec.loading}
                    onUpdateSection={wizard.spec.updateSection}
                />
            )}

            {!wizard.resuming && wizard.screen === 'assumptions' && (
                wizard.assumptions.loading && wizard.assumptions.assumptions.length === 0 ? (
                    <div class="create-spec__loading">
                        <h2>Generating assumptions...</h2>
                        <SkeletonLoader lines={5} />
                        <SkeletonLoader lines={4} />
                    </div>
                ) : (
                    <AssumptionsScreen
                        assumptions={wizard.assumptions.assumptions}
                        selectedId={wizard.assumptions.selectedId}
                        onSelect={wizard.assumptions.setSelectedId}
                        onConfirm={wizard.assumptions.confirmAssumption}
                        onConfirmAll={wizard.assumptions.confirmAll}
                        onEdit={wizard.assumptions.editAssumption}
                        onContinue={wizard.goToRequirements}
                        loading={wizard.assumptions.loading}
                    />
                )
            )}

            {!wizard.resuming && wizard.screen === 'requirements' && (
                !wizard.requirements.data ? (
                    <div class="create-spec__loading">
                        <h2>Building requirements...</h2>
                        <SkeletonLoader lines={5} />
                        <SkeletonLoader lines={4} />
                    </div>
                ) : (
                    <RequirementsScreen
                        data={wizard.requirements.data}
                        onToggle={wizard.requirements.toggleExpand}
                        onContinue={wizard.goToOverview}
                        loading={wizard.requirements.loading}
                    />
                )
            )}

            {!wizard.resuming && wizard.screen === 'overview' && wizard.spec.spec && (
                <OverviewScreen
                    title={wizard.requirements.data?.title ?? 'Project Spec'}
                    spec={wizard.spec.spec}
                    requirements={wizard.requirements.data}
                    onUpdateSection={wizard.spec.updateSection}
                    onApprove={() => { /* TODO: final approval action */ }}
                />
            )}

            {!wizard.resuming && wizard.screen === 'overview' && !wizard.spec.spec && (
                <div class="create-spec__loading">
                    <h2>Finalizing spec...</h2>
                    <SkeletonLoader lines={5} />
                </div>
            )}

            {!wizard.resuming && wizard.screen !== 'landing' && wizard.screen !== 'loading' && (
                <div class="create-spec__toolbar">
                    <button class="create-spec__toolbar-back" onClick={wizard.goBack}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L4.5 7L8.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        Back
                    </button>
                    {wizard.screen !== 'overview' && (
                        <button
                            class="create-spec__toolbar-review"
                            onClick={
                                wizard.screen === 'clarify' ? wizard.goToAssumptions
                                : wizard.screen === 'assumptions' ? wizard.goToRequirements
                                : wizard.goToOverview
                            }
                        >
                            {wizard.screen === 'requirements' ? 'Review Spec' : 'Continue'}
                        </button>
                    )}
                </div>
            )}

            {(wizard.questions.error || wizard.spec.error || wizard.assumptions.error || wizard.requirements.error) && (
                <div class="create-spec__error">
                    {wizard.questions.error || wizard.spec.error || wizard.assumptions.error || wizard.requirements.error}
                </div>
            )}

            {assistantOpen ? (
                <AssistantPanel
                    open={assistantOpen}
                    onClose={() => setAssistantOpen(false)}
                    messages={chat.messages}
                    loading={chat.loading}
                    streamingContent={chat.streamingContent}
                    activity={chat.activity}
                    queue={chat.queue}
                    onSend={chat.send}
                    onStop={chat.stop}
                    onRemoveFromQueue={chat.removeFromQueue}
                    onNewChat={chat.newChat}
                    toolUpdates={chat.toolUpdates}
                />
            ) : (
                <AssistantToggle onClick={() => setAssistantOpen(true)} />
            )}
        </div>
    );
}
