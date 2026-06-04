/**
 * Canonical session-to-transcript projection for Brunch probe artifacts.
 *
 * Input:
 * - raw FileEntry[] / SessionEntry[] from Pi session JSONL
 *
 * Output:
 * - Pi-derived active message context after buildSessionContext() and convertToLlm()
 * - probe-specific filtering policy for which derived messages are worth rendering
 *
 * Used by:
 * - session/format/transcript.ts
 * - any future transcript artifact or transcript-equivalence probes
 */

export {};
