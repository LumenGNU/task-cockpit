#!/usr/bin/env bash

# Запускает набор тестов VS Code через npx vscode-test.
#
# Обязательные переменные окружения:
#   CONFIG_FILE  — путь к конфигурационному файлу vscode-test (должен быть читаемым)
#   TESTS        — маска тестов в формате '<subdir>::<prefix>', например '*::*'
#                  (интерпретируется в vscode-*-test.mjs)
#
# Вывод:
#   stdout — вывод test runner'а (с подсветкой exit code и счётчика упавших тестов)
#   stderr — мета-информация: заголовок запуска, итог ([DONE] / [FAIL])
#
# Завершается с кодом 1, если vscode-test вернул ненулевой код или прерван сигналом.


set -euo pipefail

trap 'echo -e "\n\e[31;1m[ABORT] Process terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${CONFIG_FILE:-}" ]] || {
    echo -e "\e[31m[ERROR] CONFIG_FILE is not set or empty\e[0m" >&2
    exit 1
}

[[ -r "${CONFIG_FILE}" ]] || {
    echo -e "\e[31m[ERROR] CONFIG_FILE not readable: ${CONFIG_FILE}\e[0m" >&2
    exit 1
}

[[ -n "${TESTS:-}" ]] || {
    echo -e "\e[31m[ERROR] TESTS is not set. Expected format: '<subdir>::<prefix>' (e.g. '*::*')\e[0m" >&2
    exit 1
}

echo -e "\n\e[34;1m▶ Running Tests:\e[0m [$(date +'%Y-%m-%d %H:%M:%S')]" >&2
echo -e "config  : \e[1m${CONFIG_FILE}\e[0m" >&2
echo -e "fixture : \e[1m${SUT_TEST:-All}\e[0m" >&2
echo -e "tests   : \e[1m${TESTS}\e[0m" >&2
# Безопасное получение ширины терминала (фоллбэк на 80 для CI/CD)
TERM_COLS=$(tput cols 2>/dev/null || echo 80)
printf '%*s\n\n' "$(($TERM_COLS - 5))" '' | tr ' ' '~' >&2

npx vscode-test --config "${CONFIG_FILE}" 2>&1 |
    awk '
        EGIN { failed = 0; total = 0 }
        {
            if (match($0, /^Exit code:[[:space:]]*[0-9]+/)) {
                code = substr($0, RSTART, RLENGTH)
                num = code; sub(/Exit code:[[:space:]]*/, "", num)
                color = (num == "0") ? "\033[32;1m" : "\033[31;1m"
                print substr($0, 1, RSTART-1) color code "\033[0m" substr($0, RSTART+RLENGTH)
                print " "
                total++
                if (num + 0 != 0) failed++
            } else if (match($0, /[0-9]+ tests? failed/)) {
                print substr($0, 1, RSTART-1) "\033[31;1m" substr($0, RSTART, RLENGTH) "\033[0m" substr($0, RSTART+RLENGTH)
            } else { print }
        }
        END {
            if (total > 0) {
                color = (failed == 0) ? "\033[32;1m" : "\033[31;1m"
                print color "Runner: " (total - failed) "/" total " passed\033[0m" > "/dev/stderr"
            }
        }
        ' || { echo -e "\n\e[31;1m[FAIL] Test run failed\e[0m\n" >&2 ; exit 1 ; }

echo -e "\n\e[32;1m[DONE] All tests passed\e[0m\n" >&2
exit 0
