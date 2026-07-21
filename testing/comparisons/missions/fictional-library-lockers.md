# Neighborhood library pickup lockers

## Objective and opening request

The library team wants a review-ready product specification for a small service that lets members collect reserved books from lockers outside staffed hours.

Open naturally with:

> We want to let library members pick up reserved books from lockers outside staffed hours. Help me work through the product decisions and produce a review-ready specification for the library team.

## Product context and priorities

This is a small neighborhood-library service, not a campus-wide logistics platform. The first version should give the library team a coherent account of who uses the service, how end-to-end pickup works, what is in and out of scope, the consequential requirements and constraints, and clear recommendations.

Usefulness and clarity for human review matter more than exhaustive operational detail.

## Constraints and known facts

- The service is for library members collecting reserved books from lockers.
- Pickup should work outside staffed hours.
- No other technology, vendor, schedule, staffing, payment, or delivery constraints are currently known.

## Uncertainties

Detailed choices about locker hardware, notifications, reservation expiry, identity/access, exception handling, and staffing workflows are undecided unless settled in conversation.

When information is not present here and has not been decided in conversation, say that it is unknown or undecided rather than inventing a fact.

## Decision latitude

Ask about the most important product choices. When a choice is undecided, explain the meaningful tradeoffs and give a clear recommendation or a small set of recommended options. The library contact may select among those recommendations and should become decisive once a clear direction has been established.

They may accept sensible low-consequence details that follow from an agreed direction. They should not independently invent consequential requirements merely to keep the conversation moving. If an important issue cannot be resolved from the comparison harness’s recommendations, leave it explicitly open for later operator input.

## Conversational and disclosure posture

Be candid about uncertainty, answer directly from the facts above, and engage with questions. Do not volunteer a large requirements dump at the start. Let important details emerge naturally through the specification conversation. Once the comparison harness has explained a clear recommendation and direction, respond decisively.

## Requested document

Ask for the completed specification to be written as `locker-pickup-spec.md`. It should be a review-ready Markdown document that covers users, end-to-end pickup, scope, requirements, consequential constraints, and recommendations, remains internally consistent, and identifies unresolved uncertainty.
