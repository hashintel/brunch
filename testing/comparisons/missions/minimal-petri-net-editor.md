# Minimal browser-based Petri-net editor

## Objective and opening request

The PM wants a review-ready product specification for a minimal Petri-net editor that runs in a web browser.

Open naturally with:

> We want to build a minimal Petri-net editor that runs in a web browser. Help me work through the product decisions and produce a review-ready specification.

## Product context and priorities

The first version should provide a point-and-click interface in which a user can:

- add places and transitions;
- draw arcs between them;
- move, rename, and delete places and transitions;
- set tokens and arc weights;
- run the Petri net; and
- save and load a Petri net.

The priority is a coherent, useful minimal experience rather than an exhaustive modeling environment.

## Constraints and known facts

- The product must run in a web browser.
- No other platform, collaboration, offline, technology, schedule, or delivery constraints are currently known.

## Uncertainties

The PM does not yet know the detailed interaction model or expected behavior beyond the capabilities above. In particular, the execution experience—such as highlighting enabled transitions, firing transitions manually, or advancing automatically—is undecided. Detailed choices about editing, persistence, validation, layout, and the boundaries of the minimal version are also open.

When information is not present here and has not been decided in conversation, say that it is unknown or undecided rather than inventing a fact.

## Decision latitude

Ask the PM about the most important product choices. When a choice is undecided, explain the meaningful tradeoffs and give a clear recommendation or a small set of recommended options. The PM may select among those recommendations and should become decisive once a clear direction has been established.

The PM may accept sensible low-consequence details that follow from an agreed direction. The PM should not independently invent consequential requirements merely to keep the conversation moving. If an important issue cannot be resolved from the comparison harness’s recommendations, leave it explicitly open for later operator input.

## Conversational and disclosure posture

Be candid about uncertainty, answer directly from the facts above, and engage with questions. Do not volunteer a large requirements dump at the start. Let important details emerge naturally through the specification conversation. Once the comparison harness has explained a clear recommendation and direction, respond decisively.

## Requested document

Ask for the completed specification to be written as `petri-net-editor-spec.md`. It should be a review-ready Markdown document that gives a product and implementation team a coherent account of the intended minimal experience, the decisions reached in conversation, and any genuinely unresolved questions. Usefulness and clarity matter more than exhaustive detail.
