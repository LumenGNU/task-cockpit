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
# Результат выполнения тестов будут в $REPORT_DIR/$label.xml

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


[[ -n "${REPORT_DIR:-}" ]] || {
    echo -e "\e[31m[ERROR] Environment variable REPORT_DIR not set or empty\e[0m" >&2
    exit 1
}

readonly TEST_CONFIG_FILE
readonly REPORT_DIR


# Или конкретная фикстура или "*" - для "все"
# экспорт для раннера
export FIXTURE_NAME="${FIXTURE_NAME:-*}"

# Фильтр внутри фиустур, по label (POSIX ERE для jq) не обязателен
readonly TEST_FILTER="${TEST_FILTER:-*}" # POSIX ERE для jq

echo -e "\e[1m[TEST] Running tests suites ...\e[0m\n" >&2

# Собрать список лейблов, подходящих под фильтр
# ---------------------------------------------
LABELS=$(
    npx vscode-test --config "${TEST_CONFIG_FILE}" --list-configuration |
        jq -r --arg f "${TEST_FILTER}" '.[].config.label | select(test($f))' |
        sort -V
) || {
    echo -e "\e[31m[ERROR] vscode-test --list-configuration failed\e[0m" >&2
    exit 1
}
readonly LABELS

if [ -z "${LABELS}" ]; then
    echo -e "\e[31m[ERROR] No tests matched filter: \"${TEST_FILTER}\"\e[0m" >&2
    exit 1
fi

echo -e "  [SUITES] Filter \"${TEST_FILTER}\". Matched $(wc -l <<< "${LABELS}"):" >&2
while IFS= read -r label; do
    echo -e "    • \"${label}\"" >&2
done <<< "${LABELS}"
echo -ne '\n' >&2 # 1 строки


# переменные для раннера
export OUT_TO_FILE='Y'
export REPORT_DIR

# Запустить каждую фикстуру, xunit-результат — в отдельный файл.
# Абсолютный путь, чтобы не зависеть от cwd Extension Host'а.
# $TEST_CONFIG_FILE падает если есть дубликаты label в конфигурации
# --------------------------------------------------------------
FAILED=0
while IFS= read -r label; do

    echo -e "\n\e[34;1m▶ $label\e[0m" >&2
    printf '%*s\n' "$(($(tput cols) - 5))" '' | tr ' ' '.' >&2

    npx vscode-test --config "${TEST_CONFIG_FILE}" --label "$label" 2>&1 |
        awk '{
                if (match($0, /Exit code:[[:space:]]*[0-9]+/)) {
                    code = substr($0, RSTART, RLENGTH)
                    num = code; sub(/Exit code:[[:space:]]*/, "", num)
                    color = (num == "0") ? "\033[32;1m" : "\033[31;1m"
                    print substr($0, 1, RSTART-1) color code "\033[0m" substr($0, RSTART+RLENGTH)
                } else if (match($0, /[0-9]+ tests? failed/)) {
                    print substr($0, 1, RSTART-1) "\033[31;1m" substr($0, RSTART, RLENGTH) "\033[0m" substr($0, RSTART+RLENGTH)
                } else { print }
            }' ||
        FAILED=$((FAILED + 1))

done <<< "${LABELS}"

if [ "$FAILED" -gt 0 ]; then
    echo -e "\n\e[31;1m[FAIL] ${FAILED} suite(s) failed\e[0m\n" >&2
else
    echo -e "\n\e[32;1m[DONE] All passed\e[0m\n" >&2
fi

exit 0
