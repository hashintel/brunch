# cmux Layout Commands Reference

Commands for managing windows, workspaces, panes, and surfaces.

## Discovery

```bash
cmux identify                 # Current workspace/pane/surface (with caller info)
cmux list-windows             # All windows
cmux current-window           # Active window
cmux list-workspaces          # All workspaces
cmux current-workspace        # Active workspace
cmux list-panes               # Panes in current workspace
cmux list-panes --workspace workspace:2
cmux list-pane-surfaces --pane pane:1    # Surfaces (tabs) in a pane
cmux list-panels              # Sidebar panels
```

## Windows

```bash
cmux new-window
cmux focus-window --window window:2
cmux close-window --window window:2
cmux rename-window "my window"
cmux next-window
cmux previous-window
cmux last-window
```

## Workspaces

Workspaces are tabs within a window.

```bash
cmux new-workspace
cmux new-workspace --command "htop"          # start with a command
cmux select-workspace --workspace workspace:2
cmux close-workspace --workspace workspace:2
cmux rename-workspace "dev server"
cmux move-workspace-to-window --workspace workspace:2 --window window:1
cmux reorder-workspace --workspace workspace:2 --index 0
cmux workspace-action --action <name>        # custom actions
```

## Panes

Panes are visual split regions within a workspace.

```bash
# Create pane (splits from current or specified surface)
cmux new-pane --direction right
cmux new-pane --direction down
cmux new-pane --direction left
cmux new-pane --direction up
cmux new-pane --type browser --direction right --url http://localhost:3000

# Alternative: split from a specific surface/pane
cmux new-split right --surface surface:1
cmux new-split down --pane pane:2

# Focus
cmux focus-pane --pane pane:2
cmux last-pane

# Resize (direction: -L left, -R right, -U up, -D down)
cmux resize-pane --pane pane:2 -R --amount 20
cmux resize-pane --pane pane:2 -D --amount 10

# Swap pane positions
cmux swap-pane --pane pane:1 --target-pane pane:2

# Break pane out to its own workspace
cmux break-pane --pane pane:2

# Join a pane into another pane's workspace
cmux join-pane --target-pane pane:1 --pane pane:3

# Focus a panel (sidebar)
cmux focus-panel --panel panel:1
```

## Surfaces

Surfaces are the content inside panes — either terminal or browser.
A pane can have multiple surfaces as tabs.

```bash
# Create new surface (tab) in an existing pane
cmux new-surface --type terminal --pane pane:1
cmux new-surface --type browser --pane pane:1 --url http://localhost:3000

# Close a surface
cmux close-surface --surface surface:3

# Move surface to a different pane
cmux move-surface --surface surface:3 --pane pane:1
cmux move-surface --surface surface:3 --pane pane:1 --index 0

# Reorder surface tabs
cmux reorder-surface --surface surface:3 --index 0
cmux reorder-surface --surface surface:3 --before surface:1

# Drag surface to create a new split
cmux drag-surface-to-split --surface surface:3 right

# Rename the tab
cmux rename-tab --surface surface:3 "Server"

# Tab actions
cmux tab-action --action <name> --surface surface:3

# Health check
cmux surface-health
cmux trigger-flash --surface surface:3    # visual flash for identification

# Refresh all surfaces
cmux refresh-surfaces
```

## Search

```bash
cmux find-window "server"               # search window/workspace names
cmux find-window --content "error"      # search screen content
cmux find-window --select "server"      # find and focus
```

## Sidebar Metadata

```bash
# Status key-value pairs
cmux set-status "phase" "testing" --icon "🧪" --color "#00ff00"
cmux clear-status "phase"
cmux list-status

# Progress bar
cmux set-progress 0.5 --label "Running tests..."
cmux clear-progress

# Log messages
cmux log "Build complete" --level info --source "build"
cmux log "Test failed" --level error
cmux list-log --limit 20
cmux clear-log

# Full sidebar state
cmux sidebar-state
```

## Notifications

```bash
cmux notify --title "Build Complete" --body "All tests passed"
cmux list-notifications
cmux clear-notifications
```

## Hooks

```bash
cmux set-hook pane-focus-in "cmux log 'focused pane'"
cmux set-hook --list
cmux set-hook --unset pane-focus-in
```

## Display

```bash
cmux display-message "Hello"
cmux display-message --print "Current workspace: #{workspace_name}"
```

## JSON Output

Add `--json` to any command for machine-readable output:

```bash
cmux list-panes --json
cmux identify --json
```

## UUID Mode

By default cmux shows short refs. To see UUIDs:

```bash
cmux --id-format uuids list-panes
cmux --id-format both list-panes     # show both refs and UUIDs
```
