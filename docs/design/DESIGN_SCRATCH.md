## wave 2 TODOs

Hi pi, the previous branch in our graphite stack was a very large wave of fixes that I made in a single day. Today I have made a similarly named branch to capture another large wave of changes. This time, I want to do some high-level planning and refinement first, to map out the major things I need to cover and to look for places where things can develop in parallel, so I can deploy multiple agents on these concerns without risk of conflict. Keep in mind, that for creating UI patterns, one of the potential parallelisms we have is that we can develop UI components and patterns in 'story' form first, inside of @stories/ while other agents are working on app code. Some of the things on my mind:

1. seed the database with full testing fixtures, then
	- walk through and test flows & phase transitions
	- test the markdown output stage
	- identify views which are missing or insufficient
	- lay plans to differentiate the phases, in terms of layouts
2. fix the "brownfield kickoff" flow
	1. the initial "explore" function does not populate any knowledge
		- currently the interviewer agent does scan the workspace but the observer agent doesn't capture anything
	    - this probably needs a dedicated mode, where either
	        - A. agent explores, and somehow triggers or passes to observer, OR
	        - B. agent poses a set of 2-4 questions for initial framing; and THEN
	        - C. we kick straight in to the elicitation section
	2. we might need to revise our prompting and UX to account for specs that address only part of a codebase and part of the development timeline (e.g. just a feature area)
3. increase information display in the main chat view
	- currently thinking renders, but tool calls do not
	- neither thinking nor tool calls are rendered when loading past turns in a chat (are they persisted at all?)
	- we have no waiting state when question cards are being formed
	  - we need better understanding of which waiting states are in flight, locks, etc
4. optimize the coordination between `@tanstack/query` hooks vs `@tanstack/router` loaders
	- currently data changes cause full-page loader invalidation and re-fetch of all data; this relates also to main chat, where thinking sections disappear when a question is generated
	- (I have research material, about the right way to do this)

### MUST HAVES

- [ ] Stats/dashboard views for results
	- when generated, when last editited; title; version?
	- "completeness
	- verification coverage: how many of the requirements are covered by acceptance criteria w verifications

### UI notes

LEFT SIDEBAR
- should list the phases, with an indicator of present position, and which are closed/open
- should capture the readiness and closeability
- as such, replaces the four items that have been placed in the header

RIGHT SIDEBAR
- should capture knowledge items either in a
	- sectioned list, or as
	- tagged items with some kind of button-toggle filter list at the top

MAIN CHAT
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

FRAMING PHASE
- the "Scope" of such a spec must ultimately be more flexible -- we naively assume single project scope, and total/ultimate completion scope
- we need to look closely at what the prompt is

### NEW COMPONENTS: shadcn/ui coss-ui base-ui

- Progress
- Meter
- Kbd
- Collapsible

- [Card with checkbox | Mantine UI](https://ui.mantine.dev/component/checkbox-card/)
- [Dropzone with button | Mantine UI](https://ui.mantine.dev/component/dropzone-button/)
- [Table of contents indicator | Mantine UI](https://ui.mantine.dev/component/table-of-contents-floating/)
- [Table of contents | Mantine UI](https://ui.mantine.dev/component/table-of-contents/)
- [Timeline | Mantine](https://mantine.dev/core/timeline/)
- [Spoiler | Mantine](https://mantine.dev/core/spoiler/)
- [Popover | Mantine](https://mantine.dev/core/popover/)
- [Affix | Mantine](https://mantine.dev/core/affix/)
- [Tree | Mantine](https://mantine.dev/core/tree/)
- [Breadcrumbs | Mantine](https://mantine.dev/core/breadcrumbs/)

- [Frame - coss ui](https://coss.com/ui/docs/components/frame)
- [Meter - coss ui](https://coss.com/ui/docs/components/meter)

Pass the following to agent:

```markdown
### older screenshots from design which are still relevant

- the very beginning of a new project. The first image is the standard starting UI; below it is an alternate ideation, for the use-case where the kickoff is done by analyzing and harvesting from an existing codebase

  ![](docs/design/assets/kickoff-screen.png)
- the first question of the first phase. a compact nav on left (alternate: across the top) indicates the phases; the wide sidebar on the right shows the (approximately) phase-based collection containers for the data we expect (the labels and terminology are wrong here). NOTE also that the question model is still wrong in these earlier designs, where the options provided are exclusive, and there is no free-text option. There is also the chance to "skip question" which I am dubious about, I would prefer the user explicitly why they are skipping (e.g. "i'm not sure enough about this yet"), as part of the free-text

  ![](docs/design/assets/first-question.png)
- what the main interview roughly looks like, as it develops. the right sidebar is being filled in, so we are further along at thit point.

  ![](docs/design/assets/main-interview.png)
- a "review" style step, such as we've been imagining for the requirements and the (acceptance) criteria.  each of these might want to be expandable to show in more detail what the requirement is really about

  ![](docs/design/assets/reqs-minimal.png)
- a sketch for what the final spec overview might look like

  ![](docs/design/assets/spec-overview.png)
```
