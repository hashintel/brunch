# Pi type ownership notes

Brunch builds on the installed `@earendil-works/pi-coding-agent` package. When typing Brunch seams over Pi, treat Pi's exported declarations as the source of truth for Pi-owned envelopes, and Brunch's local domain modules as the source of truth for Brunch payloads.

## Import or project from Pi when possible

Use Pi's public package exports for session and extension shapes:

- `SessionHeader` owns JSONL session-header structure.
- `CustomEntry<T>` owns the extension custom-entry envelope; Brunch owns the `T` payload for `brunch.*` entries.
- `ExtensionFactory`, handler overloads, and extension context types own extension-event and context shapes.
- `ExtensionUIContext` owns UI methods such as `setWidget` and `setTitle`; tests should use `Pick<ExtensionUIContext, ...>` rather than restating method signatures.

Good pattern:

```ts
type SessionBindingEntry = CustomEntry<SessionBindingData> & {
  customType: typeof SESSION_BINDING_TYPE
  data: SessionBindingData
}
```

Pi owns the entry envelope; Brunch owns `SessionBindingData`.

## Let handler overloads infer event types

Some useful extension event types may exist in Pi's internal `.d.ts` files but are not exported from the package root in the installed version. Prefer relying on `ExtensionFactory` / `pi.on(...)` overload inference instead of importing deep internal paths.

Good pattern:

```ts
const extension: ExtensionFactory = (pi) => {
  pi.on("message_start", async (event, ctx) => {
    if (event.message.role === "assistant") {
      // event and ctx are Pi-typed by the overload
    }
  })
}
```

Avoid importing from non-exported deep paths such as `dist/core/extensions/types.js`; those are not part of the package `exports` contract and may fail under NodeNext package resolution.

## Installed package is executable truth

For debugging, source checkouts such as `~/Clones/earendil-works/pi` are useful for readability, but the installed `node_modules/@earendil-works/pi-coding-agent` version is what Brunch compiles and runs against. If source and installed declarations disagree, code to the installed package until the dependency is updated.

## Keep private seams visibly local

When Brunch must cross a Pi private seam, keep the local escape-hatch type tiny and colocated with the cast. Do not promote private Pi details into broad local interfaces.

Example: the current pre-assistant JSONL flush compatibility path needs `_rewriteFile()`, which Pi marks private and does not expose as a public type. A minimal local type at the call site is preferable to pretending this is a stable Pi contract.
