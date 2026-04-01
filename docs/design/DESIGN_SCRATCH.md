# WED KICKOFF

## design and re-slice, follow up

### RESTART

we can /grill on that a bit, because a further reflection which affects our technical design is in the following notes I gathered separately, which I think feed in to the drizzle question

q: how will this app be built and distributed and run?
q: what kinds of execution modes and interfaces does it need to provide?

a: the core of it is a web application, with client, server, and relay to the claude agent SDK
a: once this core is running, it will soon be of interest for there to be more than just a web UI mode of interacting with it: a CLI interface would be useful, and an API interface of some sort, provided by an MCP server, is another obvious extension;
a: this means that in the build, we need a CLI executable that can be invoked in different ways, e.g.:
  - `npx brunch` should launch the core; might eventually also launch a sidecar MCP server
  - `npx brunch [command]` would then allow operations on the core

Also, now that we have a new data model, we will need routing in the app. let's use /breadboarding to map out which routes we need and what we need in them

---





### RESCOPE, RESEARCH
1. need e2e fast path, to persisting these structures, based on running an interview
  - need a test question or a test problem, at least one 
  - need a phased interview at least the three phases we've described:
    - Initial framing
    - The design tree or decision tree drill down
    - Extrapolation of requirements and then extrapolation of criteria
2. need to capture that and represent it in the UI
   - things updating when signals come through from the back-end
   - look for a more robust pattern that shows thinking and tool use in a chat using the AI SDK that we can drop in because right now we just have the pattern from the locking skeleton which is really not sufficient 
3. when we run the scoping, considering whether Drizzle should be brought in; see if there are public skills available that make that sharper 
  - confirm that bare `better-sqlite3` is a good choice vs `drizzle-kit`? we might as pin this down now 


### INTERVENTIONS/SPIKES

1. confirm how the conversation history is managed in agent SDK, whether I re-submit the previous turns with each turn, or what: because our "turn tree" structure is essentially a branching conversation representation, and if we change the branches we need to submit the right preceding path, as the preceding history to the current query
  - it seems the agent SDK keeps its own record of sessions, which means we need to *start a new session* for each root turn, and fork it when the turn tree forks*?? [Work with sessions - Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/sessions#fork-to-explore-alternatives)
  - problem: where does the source-of-truth live, for the session, and the conversation history therefore?? what is the interviewing agent going to __see__ when we're doing further conversation turns based on past ones? We're extracting and feeding structured information— what does it see??
2. confirm how a chat UI with proper phased state machine (thinking, tool-uses, response) should be working and look for robust pattern examples of this, THEY MUST EXIST SOMEWHERE FFS



### NEW IDEATIONS

- we will need to support a "migrate" type workflow where the agent reads from a workspace to grasp what the code is
- the "bare kickoff" (default path) will need a prompt informed by *shape-up framing*. this helps inform downstream interviewing
- every turn should have a question with suggested answers and a "why" property; but also the format of how this is presented should encourage the user to provide grounding, even if they choose one of the offered options — so a radio style choice + optional text area and encouragement to explain why, what it relates to, any other accessory observations, would be important
- our verification harness should allow a terminal based stdin stdout path as well, which I can have any agent drive; this requires that brunch can do different projects simultaneously

======

### OUTLINE of SPEC PARTS

- goal and concept, w/ product and strategic framing
- (design) `decisions`; `assumptions` [driven by and connected to (interview) `turns`]
  - might also need: `open_questions`, `evidence`
- `requirements` (extrapolation/projection of `decisions`)
- (acceptance) `criteria` (extrapolation/projection of `requirements`)

WHAT ELSE TO TRACK
- a log of all changes? (the turns tree is this)
- a log of high-level history, w snapshots...? (this would require)

=======

### THOUGHTS ON THE TURNS STATE MACHINE

the state machine or the flow control, the sequence diagram around the actual question asking and then answer capture needs to be that the primary agent is focusing on asking the right questions. It's driving the interview. It's thinking about what to ask next. When it kicks off the interview, it's generating a question based on whatever framing or minimal statement it has so far and then trying to work from the broadest questions down to the most specific ones from the top of the tree to the bottom of the tree. Working its way down the tree also implies traversing at some point once one path down the tree has been resolved to go backwards and traverse back to a previous point and work down another branch of the tree and so on. So it definitely needs to do this, and that's a pretty rigorous process. And already challenging to think about, so that's enough for one agent.

The second agent, every time an answer is given, needs to capture a decision out of that. At the very minimum, it's the response, and I suppose the response has to be saved with a turn. The turn is going to contain question options and response, and response will be a choice of one of the options or it will be a free text response. Once that's been input by the user, the sidechain agent needs to evaluate that for essentially requirement definition. Decisions. A uh, and honestly, maybe these are really just the answers to the questions. It's a vague distinction between answering the question and what decision comes out about, except sometimes more than one decision could be extracted there, so I guess that's the difference.

Let's say some decisions are pulled out, assumptions are pulled out if there are any, and that probably has to complete before the next question can be asked because I think a structured representation of the sidechain agent's extraction of the decisions and potential predicate assumptions are also useful inputs for the interviewing agent to the next question. So essentially, the interview agent and the sidechain agent, or the analyst, the observer agent, they basically have their own loop, but they also need to close between themselves before the next question can be posted. So there's something like a clutch mechanism going on there that probably requires a little state machine 
