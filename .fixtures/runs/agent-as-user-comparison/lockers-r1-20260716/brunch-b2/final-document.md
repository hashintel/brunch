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
