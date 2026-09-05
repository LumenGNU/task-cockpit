#!/usr/bin/env bash
# ./cycle-tasks.sh 3
# ./cycle-tasks.sh 4 5
# MIN_TASKS=2 MAX_TASKS=5 ./cycle-tasks.sh 2
set -euo pipefail

FILE="${FILE:-.vscode/tasks.json}"

DELAY="${1:-3}"
BURST="${2:-0}"
MIN_TASKS="${3:-${MIN_TASKS:-1}}"
MAX_TASKS="${4:-${MAX_TASKS:-4}}"

TASKS_POOL='[
    {"label":"build",  "type":"shell","command":"echo build"},
    {"label":"test",   "type":"shell","command":"echo test"},
    {"label":"lint",   "type":"shell","command":"echo lint"},
    {"label":"watch",  "type":"shell","command":"echo watch"},
    {"label":"serve",  "type":"shell","command":"echo serve"},
    {"label":"deploy", "type":"shell","command":"echo deploy"},
    {"label":"format", "type":"shell","command":"echo format"},
    {"label":"check",  "type":"shell","command":"echo check"},

    {"label":"build",      "type":"shell","command":"echo build",
     "icon":{"id":"tools",        "color":"terminal.ansiGreen"},
     "group":"build", "isBackground":false},

    {"label":"test",       "type":"shell","command":"echo test",
     "icon":{"id":"beaker",       "color":"terminal.ansiBlue"},
     "group":"test",  "isBackground":false},

    {"label":"lint",       "type":"shell","command":"echo lint",
     "icon":{"id":"search",       "color":"terminal.ansiYellow"},
     "group":"build", "isBackground":false},

    {"label":"typecheck",  "type":"shell","command":"echo typecheck",
     "icon":{"id":"shield",       "color":"terminal.ansiBlue"},
     "group":"build", "isBackground":false},

    {"label":"format",     "type":"shell","command":"echo format",
     "icon":{"id":"wrench",       "color":"terminal.ansiWhite"},
     "group":"build", "isBackground":false},

    {"label":"bundle",     "type":"shell","command":"echo bundle",
     "icon":{"id":"package",      "color":"terminal.ansiYellow"},
     "group":"build", "isBackground":false},

    {"label":"clean",      "type":"shell","command":"echo clean",
     "icon":{"id":"trash",        "color":"terminal.ansiRed"},
     "isBackground":false},

    {"label":"watch",      "type":"shell","command":"echo watch",
     "icon":{"id":"eye",          "color":"terminal.ansiCyan"},
     "group":"build", "isBackground":true},

    {"label":"dev",        "type":"shell","command":"echo dev",
     "icon":{"id":"gear",         "color":"terminal.ansiCyan"},
     "isBackground":true},

    {"label":"serve",      "type":"shell","command":"echo serve",
     "icon":{"id":"server",       "color":"terminal.ansiMagenta"},
     "isBackground":true},

    {"label":"deploy",     "type":"shell","command":"echo deploy",
     "icon":{"id":"rocket",       "color":"terminal.ansiRed"},
     "isBackground":false},

    {"label":"db:migrate", "type":"shell","command":"echo db:migrate",
     "icon":{"id":"database",     "color":"terminal.ansiMagenta"},
     "isBackground":false},

    {"label":"db:seed",    "type":"shell","command":"echo db:seed",
     "icon":{"id":"database",     "color":"terminal.ansiGreen"},
     "isBackground":false},

    {"label":"e2e",        "type":"shell","command":"echo e2e",
     "icon":{"id":"telescope",    "color":"terminal.ansiBlue"},
     "group":"test",  "isBackground":false},

    {"label":"coverage",   "type":"shell","command":"echo coverage",
     "icon":{"id":"graph",        "color":"terminal.ansiGreen"},
     "group":"test",  "isBackground":false}
]'

pool_size=$(jq 'length' <<< "$TASKS_POOL")

write_state() {
    local clamp=$(( MAX_TASKS < pool_size ? MAX_TASKS : pool_size ))
    local count=$(( MIN_TASKS + RANDOM % (clamp - MIN_TASKS + 1) ))

    local indices
    indices=$(shuf -i "0-$(( pool_size - 1 ))" -n "$count" | jq -s '.')

    local result
    result=$(jq -n \
        --argjson pool    "$TASKS_POOL" \
        --argjson indices "$indices" \
        '{"version":"2.0.0","tasks":[$indices[] | $pool[.]]}')

    printf '%s\n' "$result" > "$FILE"

    local labels
    labels=$(jq -r '[.tasks[].label] | join(" ")' <<< "$result")
    echo "[$(date +%H:%M:%S)] ($count) [$labels] → $FILE"
}

echo "File: $FILE | delay: ${DELAY}s | burst: $BURST"
echo "Pool: $pool_size tasks | range: ${MIN_TASKS}..${MAX_TASKS}"
echo "Ctrl+C to stop."
echo "---"

while true; do
    if (( BURST > 0 )); then
        for (( b = 0; b < BURST; b++ )); do
            write_state
            sleep 0.1
        done
        echo "  [burst done]"
    else
        write_state
    fi
    sleep "$DELAY"
done
