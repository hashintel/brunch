### slice and scope mis-matches VS saipo report

- Phase closure/hand-off "force"
- Assistant exploring existing codebase as context
- Some way of getting output from the tool to throw at a coding assistant (e.g. files or whatever)
	- ^^ that gets us to the point where it can be experimented with as a way of working.
- Then make it look like the designs (ralph loop?)
	- maybe this is something you could kick off overnight one day, pointing Claude to some Figma screens?


- This is pretty close to your existing layout (albeit your left-hand is a chat + inline questions rather than just questions)
- This plus adjacent demonstrate a left-hand sidebar where the phase/focus navigation could be
- This could be used as the ‘initial empty state’ for the chat window
- We’ll want to think about shifting from a ‘chat-first’ UI mode to a ‘browse spec, with chat on the side to discuss amendments’ mode once a user has created the initial spec – this kind of thing. The idea here being that user could browse requirements/assumptions etc in the main view, and clicking on them would automatically add them as context to the chat
- Then probably the whole idea of linkages between requirements, assumptions etc?

Welcome any thoughts
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
