### slice and scope mis-matches VS saipo report

- we naively assume single project scope, and total/ultimate completion scope

### "kickoff" (scope) phase needs two path variants

0. a "blank slate" (default path) will need a prompt informed by *shape-up framing*. this helps inform downstream interviewing
1. a "migrate/discover" type workflow where the agent reads from a workspace to grasp what the code is

### UI observations

- we have no waiting state when question cards are being formed
  - we need better understanding of which waiting states are in flight, locks, etc.
- there's some invisible interplay/locking going on between the interviewer and the observer I think — locks?
  - let's map this out and see if we can clarify it in the UI
  - let's also see if we can design the flow here, maybe we need a state machine
- the question-card pattern needs updating
  - put the "why" behing an hover-card / tooltip?
  - make the choices more compact; present them above the free-text area
  - do a combination checkbox group inside radios pattern? • [(A, B, C)], • [D: none] + textarea?
  - encouragement to explain why, what it relates to, any other accessory observations
