#!/usr/bin/env bash

# Проверяет наличие утилит, перечисленных в переменной окружения REQUIRED_CMDS.
#
# Переменные окружения:
#   REQUIRED_CMDS — разделённый пробелами список команд для проверки (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${REQUIRED_CMDS:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable REQUIRED_CMDS not set or empty\e[0m" >&2 ; exit 1 ; }
readonly REQUIRED_CMDS

echo -e "\e[1m[CHECK] Checking required utilities ...\e[0m\n" >&2

read -ra required_cmds <<< "$REQUIRED_CMDS"

missing=0
for cmd in "${required_cmds[@]}"; do
    if command -v "$cmd" > /dev/null 2>&1; then
        echo -e "  \e[32m  OK\e[0m  $cmd"
    else
        echo -e "  \e[31mFAIL\e[0m  $cmd"
        missing=1
    fi
done

if (( missing )); then
    echo -e "\n\e[31;1m[FAIL] Missing dependencies\e[0m\n" >&2
else
    echo -e "\n\e[32;1m[DONE] All dependencies found\e[0m\n" >&2
fi
exit $missing