import { useState } from 'preact/hooks';
import type { ClaudeCall } from './types';
import { Modal } from './Modal';

function callerLabel(caller: string): string {
    if (caller === 'streamQueryText') return 'Goal / Summary';
    if (caller === 'queryStructured') return 'Questions / Requirements / Tasks';
    return caller;
}

function formatDuration(ms: number | null): string {
    if (ms == null) return '\u2014';
    return (ms / 1000).toFixed(1) + 's';
}

function formatTokens(input: number | null, output: number | null): string {
    const parts: string[] = [];
    if (input != null) parts.push(`${input} in`);
    if (output != null) parts.push(`${output} out`);
    return parts.length > 0 ? parts.join(' / ') : '\u2014';
}

export function CallDetailModal({ calls, onClose }: { calls: ClaudeCall[]; onClose: () => void }) {
    const [expandedPk, setExpandedPk] = useState<number | null>(null);

    return (
        <Modal title={`LLM Calls (${calls.length})`} onClose={onClose}>
            {calls.length === 0 && <p class="session-empty">No calls recorded.</p>}
            <div class="call-modal-list">
                {calls.map(call => {
                    const isExpanded = expandedPk === call.pk;
                    return (
                        <div key={call.pk} class="call-modal-row" onClick={() => setExpandedPk(isExpanded ? null : call.pk)}>
                            <div class="call-modal-row-summary">
                                <span class={`call-history-status ${call.status === 'success' ? 'call-history-status--ok' : 'call-history-status--err'}`} />
                                <span class="call-modal-caller">{callerLabel(call.caller)}</span>
                                <span class="call-history-model">{call.model}</span>
                                <span class="call-modal-stat">{formatDuration(call.duration_ms)}</span>
                                <span class="call-modal-stat">{formatTokens(call.input_tokens, call.output_tokens)}</span>
                                <span class="call-modal-time">{new Date(call.created_at).toLocaleString()}</span>
                                <span class="call-modal-chevron">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                            </div>
                            {isExpanded && (
                                <div class="call-modal-detail" onClick={e => e.stopPropagation()}>
                                    {call.error && (
                                        <div class="call-modal-error">
                                            <strong>Error:</strong> {call.error}
                                        </div>
                                    )}
                                    <div class="call-modal-section">
                                        <strong class="call-modal-section-title">Prompt</strong>
                                        <div class="call-modal-content">{call.prompt ?? '(no prompt)'}</div>
                                    </div>
                                    <div class="call-modal-section">
                                        <strong class="call-modal-section-title">Response</strong>
                                        <div class="call-modal-content">{call.response ?? '(no response)'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}

export { callerLabel, formatDuration, formatTokens };

export function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}
