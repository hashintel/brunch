/**
 * Shared TOON formatting substrate for Brunch LLM-facing structured context data.
 *
 * Owns:
 * - thin wrapper helpers around @toon-format/toon
 * - shared encode options and fenced `toon` block conventions
 * - no graph/session/exchange domain semantics
 *
 * Future callers:
 * - renderers/graph/*
 * - any later context formatter that needs compact structured data
 */

export {};
