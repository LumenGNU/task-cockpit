#!/usr/bin/env bash

# Запускает тестовые фикстуры через vscode-test, фильтруя по MOCHA_TEST_FILTER.
# Каждая фикстура запускается отдельно, результат сохраняется в RESULTS_DIR
# в формате xunit (по одному XML-файлу на фикстуру).
#
# Переменные окружения:
#   MOCHA_TEST_FILTER — префикс для фильтрации конфигураций (обязательна)
#   RESULTS_DIR       — директория для сохранения XML-результатов (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

# Фильтр фикстур обязателен
[[ -n "${MOCHA_TEST_FILTER:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable MOCHA_TEST_FILTER not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${RESULTS_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable RESULTS_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
readonly RESULTS_DIR
readonly MOCHA_TEST_FILTER

echo -e "\e[1m[TEST] Running test fixtures (filter: \"${MOCHA_TEST_FILTER}\") ...\e[0m\n" >&2

# Собрать список лейблов, подходящих под фильтр
LABELS=$(npx vscode-test --config ./vscode-test.mjs --list-configuration 2>/dev/null \
  | jq -r --arg f "${MOCHA_TEST_FILTER}" '.[].config.label | select(startswith($f))') && readonly LABELS

if [ -z "${LABELS}" ]; then
  echo -e "\e[31m[ERROR] No tests matched filter: ${MOCHA_TEST_FILTER}\e[0m" >&2
  exit 1
fi

FAILED=0
# Запустить каждую фикстуру, xunit-результат — в отдельный файл.
# Абсолютный путь, чтобы не зависеть от cwd Extension Host'а.
while IFS= read -r label; do
  echo -e "\e[36m▶ $label\e[0m" >&2

  MOCHA_XUNIT_FILE="$(pwd)/${RESULTS_DIR}/${label}.xml" \
    npx vscode-test --config ./vscode-test.mjs --label "$label" \
      || FAILED=$((FAILED + 1)) # TODO меньше лог вывода

done <<< "${LABELS}"

if [ "$FAILED" -gt 0 ]; then
  echo -e "\n\e[31;1m[FAIL] ${FAILED} configuration(s) failed\e[0m\n" >&2
  exit 1
fi

echo -e "\n\e[32;1m[DONE] All passed\e[0m\n" >&2