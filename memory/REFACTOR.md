# PR #331 structured-exchange contract repair

## Problem Statement

Several review findings share one developer-facing problem: structured-exchange semantics are represented at multiple layers, and a few boundaries currently preserve only a nearby representation rather than the canonical contract. A digest continuation can lose its declared question body in the pending projection; one optionless continuation variant weakens option-required variants; a legacy detail name can escape as the outer registered tool name; and abort registration can briefly expose a rendezvous that cancellation cannot settle. Questionnaire selection order is a smaller instance of the same requirement: durable output should derive from declared structure, not incidental interaction order.

```pseudo
nodes:
  present-schema: boundary
  declared-continuation: durable contract
  pending-projection: read model
  rpc-synthesis: writer
  registered-tools: runtime contract
  request-details: compatibility contract
  live-registry: rendezvous
  abort-signal: cancellation source

edges:
  present-schema         -> declared-continuation
  declared-continuation  -> pending-projection
  pending-projection     -> rpc-synthesis
  request-details        -> rpc-synthesis      # legacy detail identity leaks outward
  rpc-synthesis          x> registered-tools   # may mint an unregistered outer name
  abort-signal           -> live-registry      # listener may fire before registration
```

## Solution

Make each boundary derive from the contract it actually owns. Distinguish optionless free-text continuations from option-required choice/review continuations in the schema; carry the declared continuation body through pending reconstruction; always mint current registered outer tool identity while retaining compatibility detail discriminants; serialize questionnaire sets in declaration order; and make live-ask registration atomic with respect to abort observation.

```pseudo
nodes:
  continuation-variants: boundary
  declared-continuation: durable contract
  pending-projection: lossless read model
  rpc-synthesis: writer
  registered-tools: runtime contract
  request-details: compatibility contract
  live-registry: registered rendezvous
  abort-signal: cancellation source

edges:
  continuation-variants  -> declared-continuation
  declared-continuation  -> pending-projection
  pending-projection     -> rpc-synthesis
  registered-tools       -> rpc-synthesis      # outer identity
  request-details        -> rpc-synthesis      # inner compatibility identity only
  live-registry          -> abort-signal       # register, observe, then recheck
  abort-signal           -> live-registry      # every observed abort settles
```

## Commits

1. [done] Split declared continuations into free-text and option-required boundary variants, retain the existing wire shape, and add negative schema coverage proving candidate and review offers cannot validate without options.
2. [done] Make pending digest reconstruction preserve the declared continuation question and add a local-versus-RPC terminal parity witness proving the durable question echo remains self-describing.
3. Canonicalize every product-synthesized terminal tuple on the registered `ask` outer identity while preserving the existing request-detail discriminants, then strengthen the provider-legality test around that separation.
4. Serialize multi-select questionnaire answers in the question's declared option order and add a contrastive interaction-order test.
5. Make live-ask registration race-safe against abort delivery and add a forced-interleaving regression test that proves no aborted ask remains open or answerable.

## Decisions

- The structured-exchange schema module owns the distinction between free-text and option-driven continuation variants; collectors do not reconstruct that distinction from optional fields.
- The pending-exchange module is a lossless product read model for any field later reused to write transcript truth.
- Synthetic tuple outer identity and request-detail compatibility identity remain separate contracts: `ask` is runtime registration topology; `request_*` is preserved transcript detail vocabulary.
- Questionnaire selection is semantically a set but serializes according to declaration order for stable durable output.
- Live-ask registration must establish the pending entry before cancellation can call settlement, then recheck the signal so no interleaving is lost.
- No compatibility alias or dual write path is introduced. Existing well-formed persisted candidate/review continuations already carry options; legacy request details remain readable as required by the current product contract.
- Topology documentation updated with the relevant commits: exchanges core, session core, and Pi exchanges adapter.

## Testing Decisions

- Boundary tests should be contrastive: optionless digest feedback parses, while optionless candidate/review continuations fail at the schema boundary.
- The pending-projection test should compare the final durable terminal produced by local and RPC paths, not merely inspect an intermediate field.
- Provider-legality coverage should assert the outer synthetic call/result names are registered while separately asserting the preserved detail discriminant.
- Questionnaire component coverage should select the same options in different toggle orders and require identical persisted answers.
- Registry coverage should force abort delivery during listener installation; ordinary before-open and after-open abort tests already exist but do not witness the race.
- Existing present-schema, structured-exchange-loop, questionnaire, live-ask-registry, and public-RPC tests provide sufficient surrounding characterization. No separate characterization-only commit is required.

## Out of Scope

- Redesigning the structured-exchange wire format or removing preserved `request_*` detail vocabulary.
- Generalizing pending exchange into a new canonical store.
- Changing digest questionnaire acceptance semantics or constructor trust-boundary policy.
- Optimizing workspace inventory traversal without measured startup pressure.
- Replacing the render-honesty matcher or adding a regex-sanitization dependency.
- Broader transcript ordering normalization outside questionnaire answers.
- Editing the permanent review-lens catalog; graduation remains a separate explicit action.
