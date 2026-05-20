export type Lane = "mechanical" | "oracle" | "design" | "semantic" | "revision"

export type Place = {
  id: string
  label: string
  lane: Lane
  description: string
  tokenLabel?: string
  semanticRef?: string
  x: number
  y: number
}

export type Transition = {
  id: string
  label: string
  lane: Lane
  description: string
  compiledFrom?: string[]
  guard?: string
  x: number
  y: number
}

export type Arc = {
  id: string
  source: string
  target: string
  label?: string
}

export type PetriNet = {
  places: Place[]
  transitions: Transition[]
  arcs: Arc[]
}

export type Scenario = {
  id: string
  label: string
  headline: string
  summary: string
  valueProbe: string
  marking: Set<string>
  firedTransitions: Set<string>
  notesById: Record<string, string>
}

export type TransitionState = {
  id: string
  enabled: boolean
  fired: boolean
  missingInputs: Place[]
}

export function inputsFor(net: PetriNet, transitionId: string): Place[] {
  const inputIds = net.arcs
    .filter((arc) => arc.target === transitionId)
    .map((arc) => arc.source)

  return inputIds
    .map((id) => net.places.find((place) => place.id === id))
    .filter((place): place is Place => place !== undefined)
}

export function outputsFor(net: PetriNet, transitionId: string): Place[] {
  const outputIds = net.arcs
    .filter((arc) => arc.source === transitionId)
    .map((arc) => arc.target)

  return outputIds
    .map((id) => net.places.find((place) => place.id === id))
    .filter((place): place is Place => place !== undefined)
}

export function transitionStates(net: PetriNet, scenario: Scenario): TransitionState[] {
  return net.transitions.map((transition) => {
    const missingInputs = inputsFor(net, transition.id).filter(
      (place) => !scenario.marking.has(place.id),
    )

    return {
      id: transition.id,
      enabled: missingInputs.length === 0,
      fired: scenario.firedTransitions.has(transition.id),
      missingInputs,
    }
  })
}

export function blockedTransitions(net: PetriNet, scenario: Scenario): TransitionState[] {
  return transitionStates(net, scenario).filter(
    (state) => !state.enabled && !state.fired && state.missingInputs.length > 0,
  )
}

export function completionStatus(net: PetriNet, scenario: Scenario): {
  done: boolean
  missing: Place[]
} {
  const declareDone = net.transitions.find((transition) => transition.id === "t_declare_done")
  if (!declareDone) return { done: false, missing: [] }

  const missing = inputsFor(net, declareDone.id).filter((place) => !scenario.marking.has(place.id))
  return {
    done: scenario.marking.has("p_plan_done"),
    missing,
  }
}
