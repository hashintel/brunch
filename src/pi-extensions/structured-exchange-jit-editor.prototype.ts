// PROTOTYPE — delete or absorb after verdict.
// Throwaway probe for structured-exchange just-in-time inline editor semantics.
// Run with: npx tsx src/pi-extensions/structured-exchange-jit-editor.prototype.ts

type Mode = "single-select" | "multi-select"

interface OptionAnswer {
  type: "option"
  label: string
  value: string
  index: number
}

interface OtherAnswer {
  type: "other"
  label: string
  value: string
}

type Answer = OptionAnswer | OtherAnswer

interface Option {
  label: string
  value: string
  description?: string
}

interface State {
  mode: Mode
  options: Option[]
  selectedOptionIndexes: number[]
  otherSelected: boolean
  editorText: string
  editorVisible: boolean
  editorRequired: boolean
  submitEnabled: boolean
  focus: "picker" | "jit-editor"
  history: string[]
}

type Action =
  | { type: "select-option"; index: number }
  | { type: "select-other" }
  | { type: "edit"; text: string }
  | { type: "clear-selection" }

interface Payload {
  answers: Answer[]
  note?: string
}

const options: Option[] = [
  {
    label: "Public Brunch RPC only (Recommended)",
    value: "public-brunch-rpc",
    description: "Client speaks only product methods.",
  },
  {
    label: "Raw Pi RPC bridge",
    value: "raw-pi-rpc",
    description: "Useful as internal adapter evidence only.",
  },
  {
    label: "TUI-only for now",
    value: "tui-only",
  },
]

function initialState(mode: Mode): State {
  return derive({
    mode,
    options,
    selectedOptionIndexes: [],
    otherSelected: false,
    editorText: "",
    editorVisible: false,
    editorRequired: false,
    submitEnabled: false,
    focus: "picker",
    history: ["initial"],
  })
}

function reduce(state: State, action: Action): State {
  const next: State = { ...state, history: [...state.history] }

  switch (action.type) {
    case "select-option": {
      if (state.mode === "single-select") {
        next.selectedOptionIndexes = [action.index]
      } else if (next.selectedOptionIndexes.includes(action.index)) {
        next.selectedOptionIndexes = next.selectedOptionIndexes.filter(
          (index) => index !== action.index,
        )
      } else {
        next.selectedOptionIndexes = [
          ...next.selectedOptionIndexes,
          action.index,
        ]
      }
      next.otherSelected = false
      // Preserve text when switching listed options: it is global context, not option-owned.
      next.history.push(`select option ${action.index + 1}`)
      return derive(next)
    }
    case "select-other": {
      next.selectedOptionIndexes = []
      next.otherSelected = true
      next.history.push("select Other")
      return derive(next)
    }
    case "edit": {
      next.editorText = action.text
      next.history.push(`edit ${JSON.stringify(action.text)}`)
      return derive(next)
    }
    case "clear-selection": {
      next.selectedOptionIndexes = []
      next.otherSelected = false
      next.editorText = ""
      next.history.push("clear selection")
      return derive(next)
    }
  }
}

function derive(state: State): State {
  const hasSelection =
    state.otherSelected || state.selectedOptionIndexes.length > 0
  return {
    ...state,
    selectedOptionIndexes: [...state.selectedOptionIndexes].sort(
      (a, b) => a - b,
    ),
    editorVisible: hasSelection,
    editorRequired: state.otherSelected,
    submitEnabled:
      hasSelection &&
      (!state.otherSelected || state.editorText.trim().length > 0),
    focus: hasSelection ? "jit-editor" : "picker",
  }
}

function toPayload(state: State): Payload | null {
  if (!state.submitEnabled) return null
  if (state.otherSelected) {
    const text = state.editorText.trim()
    return { answers: [{ type: "other", label: text, value: text }] }
  }

  const answers = state.selectedOptionIndexes.map((index) => {
    const option = state.options[index]!
    return {
      type: "option" as const,
      label: option.label,
      value: option.value,
      index: index + 1,
    }
  })
  const note = state.editorText.trim()
  return note ? { answers, note } : { answers }
}

function render(state: State): string {
  const rows = state.options.map((option, index) => {
    const marker = state.selectedOptionIndexes.includes(index) ? "●" : "○"
    return `${marker} ${index + 1}. ${option.label}`
  })
  rows.push(`${state.otherSelected ? "●" : "○"} Other`)

  const editor = state.editorVisible
    ? [
        "",
        state.editorRequired
          ? "JIT editor — required custom answer for Other:"
          : "JIT editor — optional additional context for selected option(s):",
        `> ${state.editorText || "(empty)"}`,
      ]
    : ["", "JIT editor hidden until a selection exists."]

  const payload = toPayload(state)
  return [
    `mode=${state.mode} focus=${state.focus} submit=${
      state.submitEnabled ? "enabled" : "disabled"
    }`,
    ...rows,
    ...editor,
    "",
    `payload=${payload ? JSON.stringify(payload) : "unavailable"}`,
    `history=${state.history.join(" → ")}`,
  ].join("\n")
}

function runCase(name: string, mode: Mode, actions: Action[]): void {
  let state = initialState(mode)
  console.log(`\n=== ${name} ===`)
  console.log(render(state))
  for (const action of actions) {
    state = reduce(state, action)
    console.log(`\n--- after ${action.type} ---`)
    console.log(render(state))
  }
}

runCase("no-selection state", "single-select", [])
runCase("exclusive listed option + optional note", "single-select", [
  { type: "select-option", index: 0 },
  { type: "edit", text: "Use product semantics: workspace > spec > session." },
])
runCase("exclusive Other + required custom answer", "single-select", [
  { type: "select-other" },
  { type: "edit", text: "Something else: use a guided interview first." },
])
runCase("inclusive listed options + one global note", "multi-select", [
  { type: "select-option", index: 1 },
  { type: "select-option", index: 0 },
  { type: "edit", text: "Need both product boundary and fallback evidence." },
])
runCase("inclusive Other exclusivity", "multi-select", [
  { type: "select-option", index: 0 },
  {
    type: "edit",
    text: "This context should become the Other answer if Other is picked.",
  },
  { type: "select-other" },
  { type: "edit", text: "Other path: defer until browser relay." },
])
runCase(
  "selection-change behavior preserves global listed-option note",
  "multi-select",
  [
    { type: "select-option", index: 0 },
    { type: "edit", text: "Global context survives listed-option changes." },
    { type: "select-option", index: 2 },
    { type: "select-option", index: 0 },
  ],
)
