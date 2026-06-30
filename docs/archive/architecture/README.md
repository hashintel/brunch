# Archived POC architecture docs

POC-era architecture docs whose plans are now embedded in the product and
canonicalized in `memory/SPEC.md` decisions plus co-located `src/**/TOPOLOGY.md`
state. Kept here as historical reference; the live authority is SPEC + topology,
not these memos.

Internal links inside each archived doc are stale as-archived (several still
point at the pre-`-omega` `brunch-next` repo path). Do not rely on them; treat
the prose as frozen history.

| Doc                                   | Why archived                                                                                                                                 | Superseded by                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pi-ui-extension-patterns.md`         | `pi-ui-extension-patterns` frontier landed; every verdict is `proven` and the live wrapper state lives in `src/tui-client/`.                 | FE-744 / FE-1053; SPEC command-containment + chrome decisions; `src/tui-client/TOPOLOGY.md`. |
| `pi-wrapper-trust-and-resume-exit.md` | Closed finding ("do not implement now"). Trust flow is already neutralized by the sealed Brunch Pi profile; the quit-line issue is cosmetic. | D39-L sealed-profile discipline; SPEC §Runtime profile & prompting.                          |
| `pi-faux-provider-pattern.md`         | Faux-provider testing pattern is embedded in the consolidated dev-loop substrate.                                                            | D68-L dev-loop consolidation; `src/dev/` faux-harness factory.                               |
| `pi-web-comparative.md`               | External-baseline mirror (jmfederico/pi-web). Its Brunch-specific guard-rails are captured in SPEC.                                          | D33-L read-only sidecar; R1/R8 guard-rails now in SPEC.                                      |
| `pi-wrapper-comparative.md`           | External-baseline mirror (howcode). Its Brunch-specific guard-rails are captured in SPEC.                                                    | D33-L; Pi-lifecycle dependency enumeration now in `src/probes/*` + SPEC.                     |

`docs/architecture/pi-extensions.md` (a stale verbatim copy of Pi's upstream
`docs/extensions.md`) was deleted outright rather than archived — it was never
Brunch architecture. Refer to Pi's own docs for current extension API reference.
