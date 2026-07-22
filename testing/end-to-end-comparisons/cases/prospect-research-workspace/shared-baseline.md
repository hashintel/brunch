# Shared full-stack execution and interoperability baseline

This baseline is visible to both elicitation targets before they begin. It controls delivery and mechanical addressability so the same black-box browser, HTTP, and SQLite journeys can exercise independently produced applications. Requirements copied from this baseline are not elicitation gains.

## Delivery

- Build one npm repository from a fresh empty Git repository.
- Use a React and TypeScript frontend, a Node.js and TypeScript backend, and SQLite persistence.
- `npm test` runs the implementation's own tests.
- `npm run build` produces the production frontend and backend.
- `npm start` starts the production application using `PORT`, `DATABASE_PATH`, and `RESEARCH_FIXTURE_PATH` from the environment.
- `GET /api/health` returns a successful JSON response only when the application and SQLite store are ready.
- Dependency installation may use the package registry. The running application may make no external network requests.
- Pi-compatible qualification and Clay-compatible research enter only through server-side adapters. The scored application uses the local fixture selected by `RESEARCH_FIXTURE_PATH`.

## Accessible application surface

- Expose one `application` named `Prospect research workspace`.
- Expose a heading named `Research projects` and a region named `Prospect queue`.
- Expose textboxes named `Project name`, `Ideal customer profile`, and `Decision reason`.
- Expose buttons named `Create project`, `Approve project`, `Run research`, `Approve prospect`, `Suppress prospect`, `Override qualification`, and `Export approved prospects`.
- Expose prospect items as buttons named `Prospect: <person> at <company>`.
- Operation outcomes and failures use a `status` or `alert` role.

## Mechanical interaction vocabulary

- Create a project by filling `Project name` and `Ideal customer profile`, then activating `Create project`.
- Select a project and activate `Approve project` before activating `Run research`.
- Select a prospect through its accessible prospect-item button.
- Prospect actions operate on the selected prospect.
- An override or suppression supplies `Decision reason` before activating its action.
- Activate `Export approved prospects` and capture the downloaded JSON document.

This baseline does not settle qualification evidence, duplicate identity, suppression precedence, override history, export eligibility, provider-failure semantics, or restart behavior. Those remain specification and controller-oracle concerns.
