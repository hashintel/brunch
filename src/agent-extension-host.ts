// Agent extension host — the mode-neutral contract (FE-867).
//
// The pi harness is reused across two jobs: driving specification (`elicit`)
// and driving cook (`execute`). Rather than two harnesses, treat it as one
// dual-mode *agent-extension host*: a mode-agnostic core that consumers extend
// by registering capabilities as per-mode plugins. Modes differ only by which
// plugins they load.
//
// This module is the serialization point with the parallel pi-harness work that
// owns the core *implementation*. It deliberately defines only transport-safe
// contract metadata — no session lifecycle, no stream/dispatch runtime, no SDK
// types — so it stays neutral across both consumers (cook via the pi SDK, the
// interview via the Vercel AI SDK) and across whichever runtime lands later.
//
// Invariant (checkable): this file has no imports and names no `execute`-only
// concept (slice / epic / plan / worktree / test-runner / toolchain). If it did,
// it would no longer be a mode-neutral core. See agent-extension-host.test.ts.

/** The two ways the shared agent-extension host is driven. */
export type AgentExtensionMode = 'elicit' | 'execute';

/**
 * Transport-safe descriptor of one capability a consumer registers against the
 * host. Mirrors `capability-registry.ts`: metadata only — the executable handler
 * lives behind the host's dispatch, so this contract never owns runtime semantics.
 */
export interface AgentExtensionCapabilityContract {
  id: string;
  summary: string;
  handler: null;
}

/**
 * A plugin is the unit of per-mode registration: a named bundle of capabilities
 * loaded into one mode. "Modes differ only by which plugins they load" is exactly
 * this — `execute` loads the cook plugins, `elicit` loads the interview plugins.
 */
export interface AgentExtensionPluginContract {
  id: string;
  mode: AgentExtensionMode;
  capabilities: readonly AgentExtensionCapabilityContract[];
}

/**
 * A consumer (e.g. cook, the interview) described as the set of plugins it loads
 * into a single mode. Used to prove a real consumer fits the host contract
 * without migrating its runtime — the "witness" of mode-neutrality.
 */
export interface AgentExtensionConsumerWitness {
  consumerId: string;
  mode: AgentExtensionMode;
  plugins: readonly AgentExtensionPluginContract[];
}

/** Enumerate the capability ids a consumer registers — the host's dispatch keys. */
export function flattenCapabilityIds(witness: AgentExtensionConsumerWitness): string[] {
  return witness.plugins.flatMap((plugin) => plugin.capabilities.map((capability) => capability.id));
}
