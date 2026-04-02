# cmux Browser Commands Reference

All browser commands target a browser surface:
```bash
cmux browser --surface <ref> <subcommand> [args...]
```

If `--surface` is omitted, cmux uses `CMUX_SURFACE_ID` (only works if the
caller IS a browser surface, which is rare for agents).

## Opening a Browser

```bash
# Open as new pane (most common)
cmux new-pane --type browser --direction right --url http://localhost:3000

# Open from the caller's workspace (creates a split)
cmux browser open http://localhost:3000
cmux browser open-split http://localhost:3000

# Add a browser surface as a tab in an existing pane
cmux new-surface --type browser --pane pane:2 --url http://localhost:3000
```

## Navigation

```bash
cmux browser --surface <ref> navigate <url>
cmux browser --surface <ref> back
cmux browser --surface <ref> forward
cmux browser --surface <ref> reload
cmux browser --surface <ref> url               # alias for get-url
cmux browser --surface <ref> get-url
```

Add `--snapshot-after` to back/forward/reload to auto-snapshot after navigation.

## DOM Snapshot

```bash
cmux browser --surface <ref> snapshot
cmux browser --surface <ref> snapshot --interactive    # only interactive elements
cmux browser --surface <ref> snapshot --compact         # reduced whitespace
cmux browser --surface <ref> snapshot --cursor          # include cursor-interactive
cmux browser --surface <ref> snapshot --max-depth 5     # limit tree depth
cmux browser --surface <ref> snapshot --selector "main" # scope to CSS selector
```

Combine flags: `snapshot --interactive --compact --selector ".content"`

## Interaction

### Click and Hover

```bash
cmux browser --surface <ref> click <selector>
cmux browser --surface <ref> dblclick <selector>
cmux browser --surface <ref> hover <selector>
cmux browser --surface <ref> focus <selector>
cmux browser --surface <ref> scroll-into-view <selector>
```

### Form Input

```bash
cmux browser --surface <ref> fill <selector> "text"     # clear + type
cmux browser --surface <ref> fill <selector>             # empty = clear input
cmux browser --surface <ref> type <selector> "text"      # type without clearing
cmux browser --surface <ref> select <selector> "value"   # select dropdown
cmux browser --surface <ref> check <selector>
cmux browser --surface <ref> uncheck <selector>
```

### Keyboard

```bash
cmux browser --surface <ref> press Enter
cmux browser --surface <ref> press Tab
cmux browser --surface <ref> press Escape
cmux browser --surface <ref> keydown Shift
cmux browser --surface <ref> keyup Shift
```

### Scrolling

```bash
cmux browser --surface <ref> scroll --dy 500           # scroll down
cmux browser --surface <ref> scroll --dy -500          # scroll up
cmux browser --surface <ref> scroll --dx 200           # scroll right
cmux browser --surface <ref> scroll --selector ".list" --dy 300
```

All interaction commands accept `--snapshot-after` to auto-snapshot.

## Reading State

```bash
cmux browser --surface <ref> get url
cmux browser --surface <ref> get title
cmux browser --surface <ref> get text <selector>
cmux browser --surface <ref> get html <selector>
cmux browser --surface <ref> get value <selector>       # input value
cmux browser --surface <ref> get attr <selector> <attr>
cmux browser --surface <ref> get count <selector>       # element count
cmux browser --surface <ref> get box <selector>         # bounding box
cmux browser --surface <ref> get styles <selector>      # computed styles
```

### Visibility/State Checks

```bash
cmux browser --surface <ref> is visible <selector>
cmux browser --surface <ref> is enabled <selector>
cmux browser --surface <ref> is checked <selector>
```

## Waiting

```bash
cmux browser --surface <ref> wait --selector <css>           # element exists
cmux browser --surface <ref> wait --text "Dashboard"         # text appears
cmux browser --surface <ref> wait --url-contains "/settings" # URL matches
cmux browser --surface <ref> wait --load-state complete      # page loaded
cmux browser --surface <ref> wait --load-state interactive   # DOM ready
cmux browser --surface <ref> wait --function "() => window.ready" # custom JS
cmux browser --surface <ref> wait --timeout-ms 10000         # custom timeout
```

## Semantic Locators

Find elements by role, text, label, etc. instead of CSS selectors:

```bash
cmux browser --surface <ref> find role button
cmux browser --surface <ref> find text "Sign In"
cmux browser --surface <ref> find label "Email"
cmux browser --surface <ref> find placeholder "Search..."
cmux browser --surface <ref> find testid "submit-btn"
cmux browser --surface <ref> find alt "Logo"
cmux browser --surface <ref> find title "Close"
cmux browser --surface <ref> find first
cmux browser --surface <ref> find last
cmux browser --surface <ref> find nth 3
```

## JavaScript Evaluation

```bash
cmux browser --surface <ref> eval "document.title"
cmux browser --surface <ref> eval "window.scrollTo(0, document.body.scrollHeight)"
```

## Frames

```bash
cmux browser --surface <ref> frame "iframe.embed"    # enter iframe
cmux browser --surface <ref> frame main               # back to main frame
```

## Dialogs

```bash
cmux browser --surface <ref> dialog accept
cmux browser --surface <ref> dialog accept "confirmation text"
cmux browser --surface <ref> dialog dismiss
```

## Tabs (within a browser surface)

```bash
cmux browser --surface <ref> tab list
cmux browser --surface <ref> tab new http://localhost:3000/other
cmux browser --surface <ref> tab switch 2
cmux browser --surface <ref> tab close
```

## State Persistence

```bash
cmux browser --surface <ref> state save auth.json    # save cookies/storage
cmux browser --surface <ref> state load auth.json    # restore
```

## Cookies and Storage

```bash
cmux browser --surface <ref> cookies get
cmux browser --surface <ref> cookies set '{"name":"token","value":"abc","domain":"localhost"}'
cmux browser --surface <ref> cookies clear

cmux browser --surface <ref> storage local get
cmux browser --surface <ref> storage local set key value
cmux browser --surface <ref> storage session clear
```

## Console and Errors

```bash
cmux browser --surface <ref> console list     # browser console messages
cmux browser --surface <ref> console clear
cmux browser --surface <ref> errors list      # JavaScript errors
cmux browser --surface <ref> errors clear
```

## Visual Debugging

```bash
cmux browser --surface <ref> highlight <selector>    # highlight element
cmux browser --surface <ref> addstyle "body { outline: 1px solid red; }"
cmux browser --surface <ref> addinitscript "console.log('loaded')"
```
