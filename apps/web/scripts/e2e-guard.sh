#!/bin/sh
# Runs its arguments inside a resource-capped cgroup scope so a Playwright
# run (two Next.js webServers + Chromium) cannot freeze the desktop.
#
# CPUQuota leaves two cores for the rest of the machine; MemoryHigh starts
# throttling the run before the kernel swaps the desktop out; MemoryMax
# OOM-kills the test run instead of the session. Set E2E_UNGUARDED=1 to
# bypass (e.g. on CI runners that already isolate the job).
if [ -z "$E2E_UNGUARDED" ] && command -v systemd-run >/dev/null 2>&1; then
  # --scope executes the command as a child of this shell (full env and cwd
  # inherited); systemd only places it in a resource-capped cgroup.
  exec systemd-run --user --scope --quiet \
    -p CPUQuota=600% -p MemoryHigh=12G -p MemoryMax=14G -p MemorySwapMax=2G \
    "$@"
fi
exec "$@"
