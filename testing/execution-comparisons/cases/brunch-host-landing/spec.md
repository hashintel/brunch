# Host landing

### G1 Land a prepared run safely

Give the user one explicit TUI workflow for reviewing and landing a prepared run without allowing the
execution lane or an agent-callable tool to mutate the host.

### REQ1 Complete-range review

Before confirmation, show the full commit and path range from the run base through the promoted review
tip. Inspection must leave the host branch, tree, worktree, and run metadata unchanged.

### REQ2 Complete brownfield landing

After confirmation, land every content change in the promoted range into the active repository. Preserve
the review reference, exclude `.brunch` bookkeeping from tracked output, and record the run as landed.

### REQ3 Greenfield materialization

For a greenfield run, materialize the complete promoted tip tree into a missing or empty target as one
clean Brunch-authored initial commit.

### REQ4 Refusal safety

Decline, dirty-host, conflict, and stale-acceptance outcomes leave the host unchanged and do not record
the run as landed.

### INV1 User authority

Host mutation occurs only after an interactive confirmation bound to the exact promoted commit shown by
preflight.

### AC1 Public TUI behavior

The workflow is exercised through `/brunch:land` in the real public TUI without a provider turn.
