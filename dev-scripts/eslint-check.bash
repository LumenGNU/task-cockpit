#!/usr/bin/env bash

# Запускает ESLint с --max-warnings 0 для указанного файла или директории.
# Симлинки разыменовываются перед проверкой.
#
# Переменные окружения:
#   TARGET — директория или файл для проверки (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${TARGET:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable TARGET not set or empty\e[0m" >&2 ; exit 1 ; }
TARGET="$(readlink -f "${TARGET}")" || { echo -e "\e[31m[ERROR] Failed to resolve TARGET path\e[0m" >&2 ; exit 1 ; }
readonly TARGET

if [[ -d "${TARGET}" ]]; then
    entity="directory"
elif [[ -f "${TARGET}" ]]; then
    entity="file"
else
    echo -e "\e[31m[ERROR] Target \"${TARGET}\" does not exist\e[0m" >&2
    exit 1
fi

echo -e "\e[1m[LINT] ESLint checking ${entity} \"${TARGET}\" ...\e[0m\n" >&2

npx eslint --max-warnings 0 "${TARGET}" || { cr=$? ; echo -e "\n\e[31;1m[FAIL] Completed\e[0m\n" >&2 ; exit $cr ; }

echo -e "\n\e[32;1m[DONE] Completed\e[0m\n" >&2