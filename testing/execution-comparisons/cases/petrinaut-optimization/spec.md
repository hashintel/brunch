# Petrinaut optimization

### G1 Configure and run an optimization

Add a capability-present Optimizations view to Petrinaut's focused website route. The workflow must make
scenario selection explicit before optimization configuration and expose run progress without revealing
the private optimizer service.

### REQ1 Scenario-first configuration

Require the user to select a scenario before configuring an optimization. Changing the scenario resets
parameter and metric configuration that belongs to the previous scenario.

### REQ2 Flat parameter bindings

Show every selected scenario parameter in one flat configuration. Each parameter can be fixed at one
valid typed value or optimized over a valid typed domain.

### REQ3 Objective metric

Allow exactly one saved model metric or run-local custom metric as the objective, with an explicit
maximize or minimize direction.

### REQ4 Request construction

Starting a run sends the chosen scenario, fixed and optimized parameter bindings, metric objective and
direction, and execution/study settings through the website's same-origin optimization API.

### REQ5 Progressive results

Render streamed trials, best-so-far values, and successful completion as distinct progressive states.

### REQ6 Service failure

Render an optimizer service failure distinctly from successful completion and user cancellation.

### REQ7 Cancellation

Allow an active run to be cancelled. Cancellation aborts the browser's in-flight same-origin request and
renders a cancelled state.

### REQ8 Private upstream origin

Browser traffic and rendered content must not expose or contact the private upstream optimizer origin.

### AC1 Accessible public workflow

The `/optimization` route exposes a named Optimizations view. Its tab, scenario selector, parameter and
metric form controls, start/cancel controls, and result regions use stable accessible roles and names and
are keyboard reachable.
