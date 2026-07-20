# Outcome judgment packet — lockers-r1-20260716 (identity-masked)

Prompt pack version: `round-one-v1`. This packet contains only label-level metadata
shared by all lanes. Labels `A` and `B` are opaque; the mapping is stored outside
this packet.

## Public mission (identical for all lanes)

```yaml
mission_id: fictional-library-lockers-v1
title: Neighborhood library pickup lockers
brief: |
  Specify a small service that lets library members collect reserved books from lockers
  outside staffed hours. Produce a review-ready specification for the library team.
ready_document:
  path: locker-pickup-spec.md
  shape: settled specification Markdown
  ready_when:
    - covers users, end-to-end pickup, scope, requirements, consequential constraints, and recommendations
    - is internally consistent and identifies unresolved uncertainty
budgets:
  qualifying_questions: 3
  target_turns: 8
  elapsed_minutes: 20
  mechanical_interventions: 1
stops:
  ready: stop after writing locker-pickup-spec.md
  exhausted: stop on the first exhausted budget and retain the best target-authored document
rules:
  - Ask for consequential missing information; do not guess it.
  - Do not invent users, constraints, facts, decisions, or evidence.
  - Treat non-answers as uncertainty, not permission to invent.
  - Work only in the target working directory and do not seek hidden comparison material.
```

## Shared status metadata

| label | final status | document present |
| --- | --- | --- |
| A | ready (stopped after authoring the document, within all budgets) | yes |
| B | ready (stopped after authoring the document, within all budgets) | yes |

## Lane-neutral consequential-fact coverage checklist

The mission had withheld consequential facts obtainable only by asking. Score each
document on whether the implications below are reflected accurately. Do not reward
or infer how a document's lane obtained (or failed to obtain) a fact; a fact absent
from a document may mean the lane never elicited it.

- `pilot-scale` — the pilot is a single 24-compartment locker bank at the Main
  Street branch, installed outdoors under a covered walkway; no other sites this
  round. Expected implications: single-site scope; finite 24-compartment capacity
  (overflow becomes a real constraint); outdoor siting considerations.
- `auth-method` — members authenticate by scanning the barcode on their physical
  library card; no PIN pad, no smartphone-app requirement; the card scanner is the
  unit's only identification input. Expected implications: card-scan-only access
  requirement; no PIN/app flows; accessibility consequences for members without a
  usable card.
- `hold-window` — a reserved item waits 72 hours from the pickup-ready
  notification; after that staff retrieve it and return it to circulation the next
  business morning. Expected implications: expiry requirement; staff retrieval
  workflow; next-business-morning return-to-circulation step.
- `ils-integration` — the library runs the Koha ILS; locker assignments must
  synchronize with Koha's holds queue through its REST API; staff must not
  re-enter hold data manually. Expected implications: Koha REST integration
  requirement; no-manual-re-entry constraint on staff workflows.
- `budget-vendor` — intentionally unsupplied by the mission: the board has set no
  budget and chosen no vendor. Correct treatment is recording cost/vendor as
  unresolved uncertainty; inventing a budget, cost estimate, or vendor is an
  unsupported invention.

## Document A

# Neighborhood Library Pickup Lockers — Specification

**Status:** Review-ready draft for the library team
**Scope of this round:** Pickup of reserved holds only
**Prepared for:** Neighborhood library team

---

## 1. Summary

A small service that lets library members collect books they have reserved
(holds) from a bank of lockers, outside staffed hours. When a member's hold is
ready, staff (or the system) place the item in a locker; the member is notified;
the member walks up to the locker bank, scans the barcode on their physical
library card, and the locker holding their item opens. The reservation is
fulfilled in the library's catalog. If the member does not collect the item
within 72 hours, staff retrieve it and return it to circulation.

The service integrates with the library's existing **Koha** integrated library
system (ILS) so that holds and locker assignments stay in sync automatically,
with no manual re-entry by staff.

This round covers **pickup of reserved holds only**. Returns and self-service
checkout are explicitly out of scope (see §7).

---

## 2. Users

| User | Description | What they need from the service |
|------|-------------|---------------------------------|
| **Library member** | A patron with a hold ready for collection and a physical library card. | To be told their item is ready and where; to collect it after hours by scanning their card; to know how long they have. |
| **Library staff** | Circulation staff who prepare holds and manage the locker bank. | To place ready holds into lockers with minimal extra steps; to reclaim expired items; to resolve exceptions (jams, wrong items, offline units). |
| **ILS / Koha (system actor)** | The system of record for holds, items, and patrons. | To be the single source of truth; to receive fulfillment updates; to expose the holds queue via its REST API. |

**Assumptions about members (confirmed):**
- Members identify themselves **only** by scanning the barcode on their physical
  library card. There is no PIN pad and no smartphone-app requirement on the
  locker unit — the card scanner is the unit's only identification input.

---

## 3. End-to-end pickup flow

1. **Hold becomes ready.** In Koha, a reserved item is trapped/ready for a
   specific member at this location.
2. **Locker assignment.** The item is placed in an available locker and that
   locker is associated with the member's ready hold. The assignment is
   synchronized with Koha's holds queue via its REST API (see §5). Staff do not
   re-enter hold data.
3. **Member notified.** The member receives a pickup-ready notification telling
   them the item is ready and where the locker bank is. *(Notification channel
   and content are an open question — see §8, OQ-1.)*
4. **Member travels to the locker bank** during accessible hours.
5. **Identification.** The member scans the barcode on their physical library
   card at the locker bank's scanner.
6. **Locker opens.** The unit verifies the card maps to a member with an item
   waiting and opens the correct locker door. If the member has more than one
   item waiting, all their assigned lockers open (or open in sequence) — *the
   multi-item behavior is an open question, see §8, OQ-5.*
7. **Member collects the item** and closes the door.
8. **Fulfillment recorded.** The pickup is recorded and the hold is marked
   fulfilled in Koha, freeing the locker for reuse.
9. **Expiry (if not collected).** A reserved item waits in its locker for **72
   hours from the pickup-ready notification.** After that window it is treated
   as expired.
10. **Staff retrieval.** Staff retrieve expired items and return them to
    circulation the **next business morning.** The hold is updated in Koha
    accordingly and the locker is freed.

---

## 4. Scope

**In scope (this round):**
- Pickup of items that are already reserved/on hold for a member.
- Card-scan identification at the locker bank.
- Automatic synchronization of holds and locker assignments with Koha.
- The 72-hour hold window and staff-driven expiry/retrieval process.

**Out of scope (this round):**
- Returns / drop-off of borrowed items.
- Self-service checkout of non-reserved items.
- Any identification method other than scanning a physical library card
  (no PIN, no mobile app).
- Payment collection (fines/fees) at the locker.

---

## 5. Requirements

### Functional — identification & access
- **FR-1.** The locker unit shall identify a member solely by scanning the
  barcode on their physical library card. No other input method is provided.
- **FR-2.** On a successful scan, the unit shall open only the locker(s) holding
  item(s) currently assigned to that member.
- **FR-3.** If the scanned card does not map to any waiting item, the unit shall
  clearly indicate that there is nothing to collect and open no locker.
- **FR-4.** The unit shall not open a locker for an expired assignment (past the
  72-hour window).

### Functional — Koha integration
- **FR-5.** Locker assignments shall be synchronized with Koha's holds queue via
  its REST API. Staff shall not manually re-enter hold data into the locker
  system.
- **FR-6.** When a member collects an item, the service shall record fulfillment
  of the corresponding hold in Koha.
- **FR-7.** When an item expires uncollected, the service shall reflect the
  expiry so that Koha and the locker system agree on the item's state after
  staff retrieval.
- **FR-8.** Koha remains the system of record for holds, items, and patron
  identity; the locker service shall not hold a divergent copy of that truth
  beyond what it needs to operate.

### Functional — lifecycle & staff operations
- **FR-9.** The service shall track, per assigned locker, the associated member,
  item, and the pickup-ready timestamp that starts the 72-hour clock.
- **FR-10.** The service shall identify items whose 72-hour window has elapsed so
  staff can retrieve them the next business morning.
- **FR-11.** Staff shall be able to see which lockers are occupied, by which
  hold, and how much time remains before expiry.
- **FR-12.** Staff shall be able to resolve exceptions: mark a locker
  empty/available, reclaim an expired item, and correct a mis-assignment.

### Non-functional
- **NFR-1. Availability of access.** The locker bank must be usable during the
  intended "outside staffed hours" window (exact hours are an open question —
  see §8, OQ-3). Access must fail safe: a member must never be locked away from
  an item that is theirs during those hours.
- **NFR-2. Degraded connectivity.** The behavior when the unit cannot reach Koha
  at scan time must be defined (see §8, OQ-4). At minimum, the unit must not
  open the wrong locker and must not silently lose a fulfillment event.
- **NFR-3. Privacy.** The service shall store the minimum patron data needed to
  operate (e.g., the card identifier and current assignment) and shall define a
  retention period. Patron pickup history is sensitive; it should not be
  retained longer than operationally necessary.
- **NFR-4. Accessibility.** The locker bank and scanner should be usable by
  members with disabilities (reachable scanner and lockers, adequate lighting,
  clear on-unit guidance). Specific accessibility targets are an open question
  (see §8, OQ-2).
- **NFR-5. Auditability.** Every open event, fulfillment, and expiry should be
  logged with enough detail for staff to reconstruct what happened to an item.

---

## 6. Consequential constraints & risks

- **C-1. Card-only identification is a hard constraint.** Because the only input
  is a scanned library-card barcode, members who arrive without their physical
  card (lost, forgotten, brand-new, or digital-only members) cannot self-collect
  after hours. This narrows who the service serves; the team should confirm this
  is acceptable or provide an alternative path (see §8, OQ-2).
- **C-2. Barcode security.** Library-card barcodes are printed on the card and,
  in many systems, are short and/or sequential. A barcode presented to the
  scanner is a relatively weak authenticator: it can be photographed or guessed.
  Because collecting a book is a low-value but non-zero-privacy action, the team
  should decide whether barcode-alone is acceptable or whether a second factor is
  warranted. This is flagged as a decision, not assumed resolved (see §8, OQ-6).
- **C-3. Dependence on Koha's REST API.** The service's core behavior depends on
  Koha's holds endpoints being available and permissioned. API downtime, rate
  limits, or version changes directly affect pickups. Integration must be built
  against a specific Koha version with defined credentials and error handling.
- **C-4. Locker capacity is finite.** Holds can only be placed into lockers when
  one is free. The process for a ready hold when no locker is available (queue,
  hold at desk, larger bank) must be defined; otherwise ready holds may stall.
- **C-5. 72-hour window vs. staff schedule.** Expiry is measured in hours (72h
  from notification) but retrieval happens on a business-morning cadence. An item
  can therefore sit expired-but-not-yet-retrieved for a period; the spec treats
  this gap as expected. Staff must not let an expired-but-present item be opened
  (FR-4).
- **C-6. Physical siting.** Whether the bank is indoors (vestibule) or outdoors
  determines power, network, weatherproofing, lighting, and security-camera
  needs. These are prerequisites, not build details (see §8, OQ-3).

---

## 7. Explicitly out of scope this round

Returns/drop-off, self-service checkout, fine/fee payment, and any non-card
identification method. These are noted so reviewers do not assume silent
coverage; they can be revisited in a later round.

---

## 8. Open questions (unresolved uncertainty)

These were not settled by the information available and are **not** guessed.
Each should be answered before build.

- **OQ-1. Notification.** Through what channel is the member told their item is
  ready (email, SMS, Koha patron notice, other), and what does the message say
  (which branch, which locker, the 72-hour deadline)? *Recommendation:* reuse
  Koha's existing "hold ready" patron-notice mechanism if it can carry the locker
  location, to avoid a second notification system.
- **OQ-2. Members without a usable card / accessibility path.** What happens for
  a member who lacks their physical card after hours, and what accessibility
  targets apply to the unit? This interacts directly with C-1.
- **OQ-3. Access hours & physical siting.** During exactly which hours is the
  locker bank accessible, and is it indoors or outdoors? This drives NFR-1 and
  C-6.
- **OQ-4. Degraded-connectivity behavior.** How should the unit behave if it
  cannot reach Koha when a member scans (fail closed and ask them to return, or
  operate from a cached assignment and reconcile later)?
- **OQ-5. Multiple items for one member.** If a member has more than one ready
  item, are they placed in one locker or several, and how does the unit present
  them on a single scan?
- **OQ-6. Authenticator strength.** Is a scanned barcode alone acceptable, or is
  a second factor required (see C-2)?
- **OQ-7. Locker hardware.** Which locker hardware/vendor is used, and what is
  the interface for opening a door and sensing occupancy? The integration surface
  in §5 assumes such an interface exists but does not specify it.
- **OQ-8. Capacity & overflow.** How many lockers/sizes, and what is the process
  when a ready hold has no free locker (see C-4)?

---

## 9. Recommendations

1. **Build the Koha integration first and treat it as the backbone.** The holds
   sync (FR-5–FR-8) is where correctness lives. Pin a Koha version, use its REST
   API with a dedicated service account, and define error handling before any
   hardware work.
2. **Resolve OQ-3 (hours & siting) early**, because it gates power, network, and
   weatherproofing — physical prerequisites that have long lead times.
3. **Make an explicit decision on C-1/OQ-2 (cardless members).** Either accept
   that after-hours pickup requires a physical card, or define a fallback. Do not
   let this surface as a surprise at launch.
4. **Decide C-2/OQ-6 (barcode strength) deliberately.** If barcode-alone is
   accepted, document the reasoning; if not, the simplest second factor
   compatible with "no PIN pad, no app" should be identified.
5. **Define the no-free-locker path (C-4/OQ-8)** so ready holds never stall
   silently.
6. **Keep the data footprint small (NFR-3).** Store only the current assignment
   and card identifier needed to open a door; set a short retention period for
   pickup history.

---

## 10. Confirmed decisions (traceability)

The following were confirmed by the library team and are treated as settled:

- **Identification:** Scan of the physical library-card barcode only; no PIN pad,
  no smartphone app. *(Drives FR-1, C-1, C-2.)*
- **ILS:** Koha; locker assignments synchronize with Koha's holds queue via its
  REST API; no manual staff re-entry of hold data. *(Drives FR-5–FR-8, C-3.)*
- **Scope:** Pickup of reserved holds only; returns and checkout out of scope.
  *(Drives §4, §7.)*
- **Hold window:** An item waits 72 hours from the pickup-ready notification;
  after that, staff retrieve it and return it to circulation the next business
  morning. *(Drives FR-9–FR-11, C-5.)*

## Document B

# Neighborhood library pickup lockers

## Intent

### A1 Any library card holder with an active hold is eligible; no membership tiers apply

Eligibility has not been restricted by the library team. Tiering is recorded as an open question but is not a constraint in this pilot.

- basis: explicit

### CON1 Pilot scope: single 24-compartment locker bank at Main Street branch

This round covers exactly one outdoor locker bank installed under the covered walkway at the Main Street branch. No other sites are in scope.

- basis: explicit

### CON2 Authentication at locker unit is physical library card barcode scan only

The locker unit has a card scanner as its only identification input. There is no PIN pad and no smartphone app requirement. Members must present their physical library card.

- basis: explicit

### CON3 Koha ILS integration via REST API; no manual re-entry of hold data

The library runs the Koha integrated library system. Locker assignments must synchronize with Koha's holds queue through its REST API. Staff must not re-enter hold data by hand at any step.

- basis: explicit

### CON4 Reserved item held in locker for 72 hours from pickup-ready notification

Once a pickup-ready notification is sent, the item waits in its compartment for exactly 72 hours. After expiry, staff retrieve the item and return it to circulation the next business morning.

- basis: explicit

### G1 Library members can collect reserved items from lockers outside staffed hours

The service enables any library card holder with an active hold to retrieve their reserved item at any time from an outdoor locker bank, without requiring staff presence during pickup.

- basis: explicit

### REQ1 Locker assignment must synchronize automatically with Koha holds queue via REST API

When a hold is ready and a compartment is assigned, the system must update Koha via its REST API without any manual data-entry step by staff.

- basis: explicit

### REQ2 Member must authenticate at locker unit by scanning physical library card barcode

The locker unit must identify the member solely by reading the barcode on their physical library card and grant access to their assigned compartment.

- basis: explicit

### REQ3 System must send a pickup-ready notification when an item is assigned to a compartment

On successful locker assignment, the system must notify the member that their item is ready for collection. The notification channel is an open decision.

- basis: explicit

### REQ4 Expired holds must be flagged for staff retrieval and returned to circulation next business morning

When the 72-hour hold window lapses without collection, the system must alert staff. Staff retrieve the item and process return to circulation the next business morning.

- basis: explicit

### ST1 Member self-service pickup

A member receives a pickup-ready notification, goes to the locker bank at any hour, scans their library card barcode at the unit, and the assigned compartment opens so they can collect their item.

- basis: explicit

### ST2 Staff item loading and uncollected-item retrieval

Staff load reserved items into compartments and register the assignment (mechanism TBD). After the 72-hour hold window expires, staff retrieve uncollected items and return them to circulation the next business morning.

- basis: explicit

### UNK1 Notification channel (email, SMS, or other) — not yet decided

The library team has not chosen a channel. The choice affects member reachability and infrastructure scope. Must be decided before implementation.

- basis: explicit

### UNK2 Staff loading workflow mechanism — not yet decided

Whether staff use a system-mediated step (e.g. scan item + compartment) or another mechanism to register a locker assignment is unresolved. The constraint is that no hold data may be re-entered manually.

- basis: explicit

### UNK3 Capacity overflow policy — not yet decided

With 24 compartments and a 72-hour hold window, all slots could fill simultaneously. No policy exists for what happens when a new hold is ready but no compartment is free. Consequences: members may not receive timely notification; staff desk handling may be required as a fallback. Library team must decide.

- basis: explicit

### UNK4 Offline resilience strategy for the locker unit — not yet decided

Behavior when the locker unit loses network connectivity has not been discussed. Consequences depend on whether authentication and compartment-release can operate locally. Library team must decide.

- basis: explicit
