#!/usr/bin/env bash

# Утилита для объединения coverage-отчётов (Coverage Merger)
#
# ОПИСАНИЕ:
#   Скрипт собирает отдельные coverage-отчёты из подкаталогов входной
#   директории и генерирует единый сводный отчёт через nyc.
#
#   Работает в 3 фазы:
#   1. Подготовка: Извлекает coverage-final.json из каждого подкаталога
#      входной директории, переименовывая по имени подкаталога, и удаляет
#      опустевшие подкаталоги.
#   2. Обнаружение: Выводит список найденных отчётов. Если ни одного
#      не найдено — прерывает работу.
#   3. Генерация: Запускает nyc report для создания сводного отчёта
#      в форматах text (консоль) и html (файл).
#
# ИСПОЛЬЗОВАНИЕ:
#   Скрипт требует установки двух обязательных переменных окружения:
#     IN_DIR  - Директория с coverage-отчётами (подкаталоги с
#               coverage-final.json внутри)
#     OUT_DIR - Директория для сохранения сводного отчёта
#
# ПРИМЕР ЗАПУСКА:
#   IN_DIR="~coverage-reports" OUT_DIR="~coverage-summary" ./merge-coverage.bash

set -eu
shopt -s nullglob

trap 'echo -e "\n\e[31mProcess terminated\e[0m" >&2 ; exit 1' TERM INT

[[ -n "${IN_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable IN_DIR not set or empty\e[0m" ; exit 1 ; }
[[ -d "${IN_DIR}" ]] || { echo -e "\e[31m[ERROR] IN_DIR: not a directory or does not exist\e[0m" ; exit 1 ; }
[[ -n "${OUT_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable OUT_DIR not set or empty\e[0m" ; exit 1 ; }
[[ -d "${OUT_DIR}" ]] || { echo -e "\e[31m[ERROR] OUT_DIR: not a directory or does not exist\e[0m" ; exit 1 ; }

echo -e "\e[1m[COVERAGE] Merging coverage from \"${IN_DIR}\" ...\e[0m"

for d in "${IN_DIR}"/*/; do
  name=$(basename "$d")
  mv "$d/coverage-final.json" "${IN_DIR}/${name}.json"
  rm -rf "$d"
done

found=()
for f in "${IN_DIR}"/*.json; do
  found+=("$(basename "${f%.json}")")
done

if [ ${#found[@]} -eq 0 ]; then
  echo -e "\e[31m[ERROR] No coverage reports found\e[0m"
  exit 1
fi

for name in "${found[@]}"; do
  echo "  - FOUND: $name"
done

echo -e "\n Report:"

npx nyc report --temp-dir "${IN_DIR}" --reporter=text --reporter=html --report-dir "${OUT_DIR}"

echo -e "\n\e[32;1m[DONE] Summary coverage report saved at \"${OUT_DIR}\"\e[0m\n"
