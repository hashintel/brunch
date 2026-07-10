import os
import pty
import select
import signal
import subprocess
import sys
import time

command = os.environ["BRUNCH_LOGIN_COMMAND"]
scenario = os.environ["SCENARIO"]
secret = os.environ["SENTINEL_SECRET"]
timeout = float(os.environ["PROBE_TIMEOUT_SECONDS"])

master_fd, slave_fd = pty.openpty()
process = subprocess.Popen(
    ["/bin/sh", "-c", command],
    stdin=slave_fd,
    stdout=slave_fd,
    stderr=slave_fd,
    cwd=os.getcwd(),
    env=os.environ.copy(),
    close_fds=True,
    start_new_session=True,
)
os.close(slave_fd)

captured = bytearray()
sent_provider = False
sent_secret = False
sent_cancel = False
start = time.monotonic()
exit_code = None

try:
    while True:
        if time.monotonic() - start > timeout:
            raise TimeoutError(f"timed out waiting for brunch login {scenario} flow")

        readable, _, _ = select.select([master_fd], [], [], 0.05)
        if readable:
            try:
                chunk = os.read(master_fd, 4096)
            except OSError:
                chunk = b""
            if chunk:
                captured.extend(chunk)
                text = captured.decode("utf-8", errors="replace")
                if not sent_provider and "Provider number" in text:
                    os.write(master_fd, b"2\n")
                    sent_provider = True
                if scenario == "success" and sent_provider and not sent_secret and "API key" in text:
                    os.write(master_fd, (secret + "\n").encode())
                    sent_secret = True
                if scenario == "cancel" and sent_provider and not sent_cancel and "API key" in text:
                    os.write(master_fd, b"q\n")
                    sent_cancel = True

        exit_code = process.poll()
        if exit_code is not None:
            break
finally:
    try:
        os.close(master_fd)
    except OSError:
        pass
    if process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except PermissionError:
            process.kill()
        process.wait()

sys.stdout.buffer.write(bytes(captured))
if scenario == "success" and not sent_secret:
    raise SystemExit("probe never reached the hidden API-key prompt")
if scenario == "cancel" and not sent_cancel:
    raise SystemExit("probe never reached the cancellation prompt")
if scenario == "success" and exit_code != 0:
    raise SystemExit(f"expected success exit 0, got {exit_code}")
if scenario == "cancel" and exit_code == 0:
    raise SystemExit("expected cancellation to exit nonzero")
