# accepted

## Proposal: Verification layers for the render sweep

> Rationale here

- __$G2: Render sweep stays honest [settled]__
  - depends on __$REQ5__ [settled]
- __$REQ5: Details leaves must be accounted for [settled]__
  
  Every populated details leaf is either rendered or explicitly elided.
  - depends on __MOD1__ [settled]
- __$CH3: Render-honesty invariant test [settled]__
  
  The invariant walks the structured details payload.
  
  It fails when a formatter silently drops a meaningful leaf.
  - witnesses __$REQ5__ *(for)*
    
    > the invariant is the only oracle that catches a silently dropped details leaf. [settled]

## Review: accepted

# changes requested

## Proposal: Reconcile rollback coverage

> Additional reasoning / rationale.

- __$REQ6: Rollback rehearsal before each release [settled]__
  - refines __REQ5__ [settled]
  - depends on __MOD1__ [settled]

Other new edges:

- __CH1__ witnesses __REQ5__ *(for)*
  
  > the boundary test already exercises the rollback path end to end. [settled]

## Review: changes requested

> $REQ6 is right but under-specified — name the rollback window before accepting it.

# rejected

## Proposal: Split the answering chrome from transcript rendering

> One frontier became two; this draft records the boundary.

- __$F4: Exchange answering chrome [settled]__
  - part of __F5__ [settled]

## Review: rejected

> This proposes the wrong boundary for the render sweep.

# cancelled

## Proposal: Verification layers for the render sweep

> Rationale here

- __$G2: Render sweep stays honest [settled]__
  - depends on __$REQ5__ [settled]
- __$REQ5: Details leaves must be accounted for [settled]__
  
  Every populated details leaf is either rendered or explicitly elided.
  - depends on __MOD1__ [settled]
- __$CH3: Render-honesty invariant test [settled]__
  
  The invariant walks the structured details payload.
  
  It fails when a formatter silently drops a meaningful leaf.
  - witnesses __$REQ5__ *(for)*
    
    > the invariant is the only oracle that catches a silently dropped details leaf. [settled]

**Cancelled** — The user declined to answer. Read this as wanting to change direction or reply in free text.