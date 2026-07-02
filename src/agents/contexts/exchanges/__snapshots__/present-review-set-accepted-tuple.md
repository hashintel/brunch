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