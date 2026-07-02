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