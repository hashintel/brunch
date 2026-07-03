# accepted

## Proposal: Verification layers for the render sweep

> Rationale here

- __$G2: Render sweep stays honest__
  - depends on __$REQ5__
- __$REQ5: Details leaves must be accounted for__
  
  Every populated details leaf is either rendered or explicitly elided.
  - depends on __MOD1__
- __$CH3: Render-honesty invariant test__
  
  The invariant walks the structured details payload.
  
  It fails when a formatter silently drops a meaningful leaf.
  - witnesses __$REQ5__ *(for)*
    
    > the invariant is the only oracle that catches a silently dropped details leaf.

## Review: accepted

# changes requested

## Proposal: Reconcile rollback coverage

> Additional reasoning / rationale.

- __$REQ6: Rollback rehearsal before each release__
  - refines __REQ5__
  - depends on __MOD1__

Other new edges:

- __CH1__ witnesses __REQ5__ *(for)*
  
  > the boundary test already exercises the rollback path end to end.

## Review: changes requested

> $REQ6 is right but under-specified — name the rollback window before accepting it.

# rejected

## Proposal: Split the answering chrome from transcript rendering

> One frontier became two; this draft records the boundary.

- __$F4: Exchange answering chrome__
  - part of __F5__

## Review: rejected

> This proposes the wrong boundary for the render sweep.

# cancelled

## Proposal: Verification layers for the render sweep

> Rationale here

- __$G2: Render sweep stays honest__
  - depends on __$REQ5__
- __$REQ5: Details leaves must be accounted for__
  
  Every populated details leaf is either rendered or explicitly elided.
  - depends on __MOD1__
- __$CH3: Render-honesty invariant test__
  
  The invariant walks the structured details payload.
  
  It fails when a formatter silently drops a meaningful leaf.
  - witnesses __$REQ5__ *(for)*
    
    > the invariant is the only oracle that catches a silently dropped details leaf.

## Review

_User cancelled the review request._