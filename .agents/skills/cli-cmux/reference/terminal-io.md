# cmux Terminal I/O Reference

Commands for reading from and sending input to terminal surfaces.

## Reading Screen Content

```bash
# Read current viewport of a surface
cmux read-screen --surface <ref>

# Read with scrollback history
cmux read-screen --surface <ref> --scrollback

# Limit scrollback lines
cmux read-screen --surface <ref> --scrollback --lines 50

# tmux-compatible alias
cmux capture-pane --surface <ref> --scrollback --lines 100
```

Without `--surface`, reads from caller's surface (usually your own — not useful).

## Sending Text

```bash
# Send literal text (as if typed)
cmux send --surface <ref> "npm run dev"

# Send text with newline (Enter)
cmux send --surface <ref> $'npm run dev\n'

# Send to a panel (sidebar) instead of a surface
cmux send-panel --panel <ref> "some text"
```

**Important**: `send` types text but does NOT press Enter. Append `\n` or
follow with `send-key Enter`.

## Sending Keys

```bash
# Basic keys
cmux send-key --surface <ref> Enter
cmux send-key --surface <ref> Tab
cmux send-key --surface <ref> Escape
cmux send-key --surface <ref> Backspace
cmux send-key --surface <ref> Space

# Arrow keys
cmux send-key --surface <ref> Up
cmux send-key --surface <ref> Down
cmux send-key --surface <ref> Left
cmux send-key --surface <ref> Right

# Modifier combinations
cmux send-key --surface <ref> Ctrl+C
cmux send-key --surface <ref> Ctrl+D
cmux send-key --surface <ref> Ctrl+Z
cmux send-key --surface <ref> Ctrl+L     # clear screen

# Panel variant
cmux send-key-panel --panel <ref> Enter
```

## Pipe Pane

Stream surface output to a shell command:

```bash
cmux pipe-pane --command "tee /tmp/surface-output.log" --surface <ref>
```

## Clear History

```bash
cmux clear-history --surface <ref>
```

## Clipboard (Buffers)

```bash
cmux set-buffer "text to copy"
cmux set-buffer --name mybuf "named buffer"
cmux list-buffers
cmux paste-buffer --surface <ref>
cmux paste-buffer --name mybuf --surface <ref>
```

## Wait for Signal

Coordinate between panes using named signals:

```bash
# In one pane/script: wait for a signal
cmux wait-for server-ready --timeout 30

# In another pane/script: send the signal
cmux wait-for --signal server-ready
```

## Respawn

Restart the shell in a surface:

```bash
cmux respawn-pane --surface <ref>
cmux respawn-pane --surface <ref> --command "zsh"
```

## Practical Patterns

### Run a command and read its output

```bash
cmux send --surface surface:2 "echo hello"
cmux send-key --surface surface:2 Enter
sleep 1
cmux read-screen --surface surface:2
```

### Wait for a dev server to start

```bash
cmux send --surface surface:2 "npm run dev"
cmux send-key --surface surface:2 Enter

# Poll read-screen until the ready message appears
# (use a loop in a script, or just read-screen a few times)
cmux read-screen --surface surface:2
```

### Kill a running process

```bash
cmux send-key --surface surface:2 Ctrl+C
```

### Navigate a menu-driven TUI

```bash
cmux send-key --surface surface:2 Down
cmux send-key --surface surface:2 Down
cmux send-key --surface surface:2 Enter
cmux read-screen --surface surface:2
```
