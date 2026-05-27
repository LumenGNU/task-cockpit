#!/usr/bin/env bash

# Конфигурация vscode-unit-test.mjs предназначена для запуска 
# изолированных unit-тестов. Она работает с уже преобразованными JS-файлами 
# и использует @vscode/test-cli как среду выполнения тестов.
# 
# Хотя тестируются изолированные функции и классы, сам раннер VS Code технически 
# требует запустить среду (Extension Host). Поэтому для тестов подготавливается 
# минимально необходимая структура, имитирующая расширение (JS-модули проекта + заглушка package.json).
# 
# 1. Подготовка (Транспиляция и сборка)
# 
# Перед запуском тестов исходный код TypeScript должен быть транспилирован в JavaScript.
# 
# Процесс сборки (билд) должен сохранять следующую структуру в выходной директории 
# (по умолчанию используется папка ~out-test, но её можно переопределить через переменную $OUT_DIR):
# 
# ~out-test/     — файлы-заглушки (включая фейковый package.json), необходимые для 
#                  старта раннера VS Code.
# ~out-test/test/unit/ — Скомпилированные unit-тесты.
# 
# 2. Настройка переменных окружения
# 
# Скрипт управляется через переменные окружения.
# 
# Обязательная переменная:
# 
# `UNIT_TESTS` — Указывает, какие тесты из test/unit/ запускать. Формат: <название_подпапки>::<префикс_файла>.
# 
# Опциональные переменные:
# 
# `VSC_VERSION` — Версия VS Code для тестов (по умолчанию 1.86.2).
# `VSC_PROFILE` — Имя профиля VS Code, если требуется специфичная настройка.
# `TEST_REPORTER` — Формат вывода Mocha (например, spec, dot, ...).
# `OUT_DIR` — Папка со скомпилированным кодом (по умолчанию ~out-test).
# 
# 3. Примеры запуска
# 
# Запуск всех тестов во всех подпапках:
# 
# export UNIT_TESTS="*::*"
# export TEST_CONFIG_FILE="./vscode-unit-test.mjs"
# ./run-unit-tests.sh
# 
# Запуск всех тестов только из папки parser:
# 
# export UNIT_TESTS="parser::*"
# export TEST_CONFIG_FILE="./vscode-unit-test.mjs"
# ./run-unit-tests.sh
# 
# Запуск конкретной группы тестов (начинающихся с S1-) в папке utils:
# 
# export UNIT_TESTS="utils::S1-"
# export TEST_CONFIG_FILE="./vscode-unit-test.mjs"
# ./run-unit-tests.sh
# --------------------------------------------------------------------------------------
# Вывод в консоль будет минимален.
# Результаты пропускаются через awk для подсветки ошибок и кодов возврата.
#
# Ожидает переменные:
# TEST_CONFIG_FILE - путь к vscode-unit-test.mjs
# UNIT_TESTS       - маска тестов, например "*::*"

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

[[ -n "${UNIT_TESTS:-}" ]] || {
    echo -e "\e[31m[ERROR] UNIT_TESTS is not set. Expected format: '<subdir>::<prefix>' (e.g. '*::*')\e[0m" >&2
    exit 1
}

echo -e "\n\e[34;1m▶ Unit Tests: \"${UNIT_TESTS}\"\e[0m [$(date +'%Y-%m-%d %H:%M:%S')]" >&2

# Безопасное получение ширины терминала (фоллбэк на 80 для CI/CD)
TERM_COLS=$(tput cols 2>/dev/null || echo 80)
printf '%*s\n' "$(($TERM_COLS - 5))" '' | tr ' ' '~' >&2

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
        }' || { echo -e "\n\e[31;1m[FAIL] Unit suite(s) failed\e[0m\n" >&2 ; exit 1 ; }

echo -e "\n\e[32;1m[DONE] All unit tests passed\e[0m\n" >&2
exit 0