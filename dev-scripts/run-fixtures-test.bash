#!/usr/bin/env bash

# Вывод в консоль будет минимален
#
# ▶ fixture::Configuration
# ....................................
# - Resolving version...
# ✔ Validated version: ...
# ✔ Found existing install in /...
# ...
# Started local extension host with pid ...
# Loading development extension at /...
# 1 test failed.
# Exit code: 1
# ....
# [FAIL] 1 suite(s) failed
#
# ---Результат выполнения тестов будут в $REPORT_DIR/$label.xml

set -euo pipefail

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${TEST_CONFIG_FILE:-}" ]] || {
    echo -e "\e[31m[ERROR] TEST_CONFIG_FILE is not set or empty\e[0m" >&2
    exit 1
}

[[ -r "${TEST_CONFIG_FILE}" ]] || {
    echo -e "\e[31m[ERROR] TEST_CONFIG_FILE not readable: ${TEST_CONFIG_FILE:-<not set>}\e[0m" >&2
    exit 1
}


# [[ -n "${REPORT_DIR:-}" ]] || {
#     echo -e "\e[31m[ERROR] Environment variable REPORT_DIR not set or empty\e[0m" >&2
#     exit 1
# }


readonly FIXTURES_TESTS
readonly TEST_REPORT_TO_FILE

readonly TEST_CONFIG_FILE
# readonly REPORT_DIR


echo -e "\n\e[34;1m▶ \"${FIXTURES_TESTS}\" \e[0m" >&2
printf '%*s\n' "$(($(tput cols) - 5))" '' | tr ' ' '~' >&2

npx vscode-test --config "${TEST_CONFIG_FILE}" 2>&1 |
    awk '{
            if (match($0, /Exit code:[[:space:]]*[0-9]+/)) {
                code = substr($0, RSTART, RLENGTH)
                num = code; sub(/Exit code:[[:space:]]*/, "", num)
                color = (num == "0") ? "\033[32;1m" : "\033[31;1m"
                print substr($0, 1, RSTART-1) color code "\033[0m" substr($0, RSTART+RLENGTH)
            } else if (match($0, /[0-9]+ tests? failed/)) {
                print substr($0, 1, RSTART-1) "\033[31;1m" substr($0, RSTART, RLENGTH) "\033[0m" substr($0, RSTART+RLENGTH)
            } else { print }
        }' || { echo -e "\n\e[31;1m[FAIL] Suite(s) failed\e[0m\n" >&2 ; exit 1 ; }


echo -e "\n\e[32;1m[DONE] All passed\e[0m\n" >&2
exit 0
