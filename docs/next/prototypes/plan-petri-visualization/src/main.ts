import cytoscape from "/@fs/Users/lunelson/Clones/cytoscape/cytoscape.js/dist/cytoscape.esm.mjs"
import "./style.css"
import {
  blockedTransitions,
  completionStatus,
  inputsFor,
  outputsFor,
  transitionStates,
  type PetriNet,
  type Scenario,
} from "./model"
import { scenarios, sliceNet } from "./scenarios"

type CyElement = {
  data: Record<string, unknown>
  position?: { x: number; y: number }
  classes?: string
}

const pickerEl = requireElement("scenario-picker")
const summaryEl = requireElement("scenario-summary")
const blockedEl = requireElement("blocked-list")
const selectionEl = requireElement("selection-detail")
const completionEl = requireElement("completion-detail")

let selectedScenario = scenarios[0]

const cy = cytoscape({
  container: requireElement("cy"),
  elements: [],
  layout: { name: "preset" },
  minZoom: 0.45,
  maxZoom: 1.8,
  wheelSensitivity: 0.2,
  style: [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size": 11,
        "text-wrap": "wrap",
        "text-max-width": 104,
        "text-valign": "center",
        "text-halign": "center",
        color: "#000000",
        width: 112,
        height: 52,
        "border-width": 2,
        "border-color": "#c7d2fe",
        "background-color": "#f8fafc",
      },
    },
    {
      selector: ":parent",
      style: {
        label: "data(label)",
        shape: "round-rectangle",
        "text-valign": "top",
        "text-halign": "left",
        "text-margin-x": 12,
        "text-margin-y": 8,
        "font-size": 13,
        "font-weight": 800,
        color: "#000000",
        padding: 28,
        "background-opacity": 0.12,
        "border-width": 2,
        "border-style": "dashed",
      },
    },
    {
      selector: "node.place",
      style: {
        shape: "ellipse",
        width: 86,
        height: 86,
        "text-max-width": 72,
      },
    },
    {
      selector: "node.transition",
      style: {
        shape: "rectangle",
        width: 86,
        height: 46,
        "background-color": "#111827",
        color: "#ffffff",
        "border-color": "#111827",
      },
    },
    {
      selector: "node.marked",
      style: {
        "background-color": "#16a34a",
        "border-color": "#14532d",
        "border-width": 5,
        color: "#000000",
      },
    },
    {
      selector: "node.missing",
      style: {
        "background-color": "#ffffff",
        "background-opacity": 0.42,
        "border-color": "#94a3b8",
        "border-style": "dashed",
        "border-width": 2,
        color: "#000000",
        opacity: 0.72,
      },
    },
    {
      selector: "node.transition:not(.fired):not(.enabled):not(.blocked)",
      style: {
        "background-color": "#ffffff",
        "background-opacity": 0.46,
        "border-color": "#94a3b8",
        "border-style": "dashed",
        color: "#000000",
        opacity: 0.72,
      },
    },
    {
      selector: "node.fired",
      style: {
        "background-color": "#4338ca",
        "border-color": "#1e1b4b",
        "border-width": 5,
        color: "#000000",
      },
    },
    {
      selector: "node.enabled",
      style: {
        "background-color": "#15803d",
        "border-color": "#14532d",
        "border-width": 5,
        color: "#000000",
      },
    },
    {
      selector: "node.blocked",
      style: {
        "background-color": "#dc2626",
        "border-color": "#7f1d1d",
        "border-width": 5,
        color: "#000000",
      },
    },
    {
      selector: ".lane-mechanical",
      style: { "border-color": "#60a5fa", "background-color": "#60a5fa" },
    },
    {
      selector: ".lane-oracle",
      style: { "border-color": "#a78bfa", "background-color": "#a78bfa" },
    },
    {
      selector: ".lane-design",
      style: { "border-color": "#f59e0b", "background-color": "#f59e0b" },
    },
    {
      selector: ".lane-semantic",
      style: { "border-color": "#10b981", "background-color": "#10b981" },
    },
    {
      selector: ".lane-revision",
      style: { "border-color": "#ef4444", "background-color": "#ef4444" },
    },
    {
      selector: "edge",
      style: {
        width: 2,
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "target-arrow-color": "#64748b",
        "line-color": "#94a3b8",
        label: "data(label)",
        "font-size": 9,
        color: "#64748b",
      },
    },
    {
      selector: ":selected",
      style: {
        "overlay-color": "#0f172a",
        "overlay-opacity": 0.12,
        "overlay-padding": 8,
      },
    },
  ],
})

renderScenarioPicker()
render(selectedScenario)

cy.on("tap", "node, edge", (event) => {
  renderSelection(event.target.data())
})

cy.on("tap", (event) => {
  if (event.target === cy) {
    selectionEl.className = "empty"
    selectionEl.textContent = "Select a place, transition, or arc."
  }
})

function renderScenarioPicker(): void {
  pickerEl.innerHTML = ""

  for (const scenario of scenarios) {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = scenario.label
    button.className = scenario.id === selectedScenario.id ? "active" : ""
    button.addEventListener("click", () => {
      selectedScenario = scenario
      renderScenarioPicker()
      render(scenario)
    })
    pickerEl.append(button)
  }
}

function render(scenario: Scenario): void {
  cy.elements().remove()
  cy.add(toCyElements(sliceNet, scenario))
  cy.fit(undefined, 42)
  renderSummary(scenario)
  renderBlocked(sliceNet, scenario)
  renderCompletion(sliceNet, scenario)
  selectionEl.className = "empty"
  selectionEl.textContent = "Select a place, transition, or arc."
}

function toCyElements(net: PetriNet, scenario: Scenario): CyElement[] {
  const states = transitionStates(net, scenario)
  const blockedIds = new Set(
    states.filter((state) => !state.enabled && !state.fired).map((state) => state.id),
  )
  const enabledIds = new Set(states.filter((state) => state.enabled).map((state) => state.id))
  const firedIds = scenario.firedTransitions

  const laneElements: CyElement[] = ["mechanical", "oracle", "design", "semantic", "revision"].map(
    (lane) => ({
      data: {
        id: `lane_${lane}`,
        label: laneLabel(lane),
        kind: "lane",
      },
      classes: `lane-parent lane-${lane}`,
    }),
  )

  const placeElements: CyElement[] = net.places.map((place) => {
    const classes = ["place", `lane-${place.lane}`]
    if (scenario.marking.has(place.id)) classes.push("marked")
    else classes.push("missing")

    return {
      data: {
        ...place,
        parent: `lane_${place.lane}`,
        kind: "place",
        tokenPresent: scenario.marking.has(place.id),
        note: scenario.notesById[place.id],
      },
      position: { x: place.x, y: place.y },
      classes: classes.join(" "),
    }
  })

  const transitionElements: CyElement[] = net.transitions.map((transition) => {
    const classes = ["transition", `lane-${transition.lane}`]
    if (firedIds.has(transition.id)) classes.push("fired")
    else if (enabledIds.has(transition.id)) classes.push("enabled")
    else if (blockedIds.has(transition.id)) classes.push("blocked")

    const state = states.find((candidate) => candidate.id === transition.id)

    return {
      data: {
        ...transition,
        parent: `lane_${transition.lane}`,
        kind: "transition",
        fired: firedIds.has(transition.id),
        enabled: enabledIds.has(transition.id),
        missingInputs: state?.missingInputs.map((place) => place.label) ?? [],
        note: scenario.notesById[transition.id],
      },
      position: { x: transition.x, y: transition.y },
      classes: classes.join(" "),
    }
  })

  const arcElements: CyElement[] = net.arcs.map((arc) => ({
    data: {
      ...arc,
      kind: "arc",
    },
  }))

  return [...laneElements, ...placeElements, ...transitionElements, ...arcElements]
}

function renderSummary(scenario: Scenario): void {
  summaryEl.innerHTML = `
    <h3>${escapeHtml(scenario.headline)}</h3>
    <p>${escapeHtml(scenario.summary)}</p>
    <div class="value-probe"><strong>Value probe:</strong> ${escapeHtml(scenario.valueProbe)}</div>
  `
}

function renderBlocked(net: PetriNet, scenario: Scenario): void {
  const blocked = blockedTransitions(net, scenario)

  if (blocked.length === 0) {
    blockedEl.innerHTML = `<p class="ok">No blocked transitions in this final marking.</p>`
    return
  }

  blockedEl.innerHTML = blocked
    .map((state) => {
      const transition = net.transitions.find((candidate) => candidate.id === state.id)
      if (!transition) return ""
      const missing = state.missingInputs.map((place) => `<li>${escapeHtml(place.label)}</li>`).join("")
      const note = scenario.notesById[state.id]
        ? `<p class="note">${escapeHtml(scenario.notesById[state.id])}</p>`
        : ""

      return `
        <article class="blocked-card">
          <h3>${escapeHtml(transition.label)}</h3>
          ${note}
          <p>Missing inputs:</p>
          <ul>${missing}</ul>
        </article>
      `
    })
    .join("")
}

function renderCompletion(net: PetriNet, scenario: Scenario): void {
  const status = completionStatus(net, scenario)

  if (status.done) {
    completionEl.innerHTML = `
      <p class="ok"><strong>PlanDoneAccepted reached.</strong></p>
      <p>The terminal marking has all required semantic and mechanical tokens.</p>
    `
    return
  }

  completionEl.innerHTML = `
    <p><strong>PlanDoneAccepted is not reachable from this marking.</strong></p>
    <p>Missing terminal inputs:</p>
    <ul>${status.missing.map((place) => `<li>${escapeHtml(place.label)}</li>`).join("")}</ul>
  `
}

function renderSelection(data: Record<string, unknown>): void {
  const kind = String(data.kind)

  if (kind === "lane") {
    selectionEl.className = ""
    selectionEl.innerHTML = `
      <h3>${escapeHtml(String(data.label))}</h3>
      <p>This compound node groups one orchestration lane. Unlike the earlier CSS background bands, it is part of the graph and zooms/pans with the Petri net.</p>
    `
    return
  }

  if (kind === "arc") {
    selectionEl.className = ""
    selectionEl.innerHTML = `
      <h3>Arc</h3>
      <dl>
        <dt>Source</dt><dd>${escapeHtml(String(data.source))}</dd>
        <dt>Target</dt><dd>${escapeHtml(String(data.target))}</dd>
      </dl>
    `
    return
  }

  if (kind === "transition") {
    const transitionId = String(data.id)
    const transition = sliceNet.transitions.find((candidate) => candidate.id === transitionId)
    const inputs = transition ? inputsFor(sliceNet, transition.id) : []
    const outputs = transition ? outputsFor(sliceNet, transition.id) : []
    selectionEl.className = ""
    selectionEl.innerHTML = `
      <h3>${escapeHtml(String(data.label))}</h3>
      <p class="pill ${data.fired ? "good" : data.enabled ? "ready" : "bad"}">
        ${data.fired ? "fired" : data.enabled ? "enabled" : "blocked"}
      </p>
      <p>${escapeHtml(String(data.description ?? ""))}</p>
      ${data.guard ? `<p><strong>Guard:</strong> ${escapeHtml(String(data.guard))}</p>` : ""}
      ${renderList("Compiled from", asStringArray(data.compiledFrom))}
      ${renderList("Consumes", inputs.map((place) => place.label))}
      ${renderList("Produces", outputs.map((place) => place.label))}
      ${renderList("Missing", asStringArray(data.missingInputs))}
      ${data.note ? `<p class="note">${escapeHtml(String(data.note))}</p>` : ""}
    `
    return
  }

  selectionEl.className = ""
  selectionEl.innerHTML = `
    <h3>${escapeHtml(String(data.label))}</h3>
    <p class="pill ${data.tokenPresent ? "good" : "bad"}">
      ${data.tokenPresent ? "token present" : "token missing"}
    </p>
    <p>${escapeHtml(String(data.description ?? ""))}</p>
    ${data.tokenLabel ? `<p><strong>Token:</strong> ${escapeHtml(String(data.tokenLabel))}</p>` : ""}
    ${data.semanticRef ? `<p><strong>Semantic ref:</strong> ${escapeHtml(String(data.semanticRef))}</p>` : ""}
    ${data.note ? `<p class="note">${escapeHtml(String(data.note))}</p>` : ""}
  `
}

function renderList(title: string, values: string[]): string {
  if (values.length === 0) return ""
  return `<p><strong>${escapeHtml(title)}:</strong></p><ul>${values
    .map((value) => `<li>${escapeHtml(value)}</li>`)
    .join("")}</ul>`
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function laneLabel(lane: string): string {
  if (lane === "mechanical") return "Mechanical execution"
  if (lane === "oracle") return "Oracle satisfaction"
  if (lane === "design") return "Design exercise"
  if (lane === "semantic") return "Semantic completion"
  return "Revision / risk"
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
