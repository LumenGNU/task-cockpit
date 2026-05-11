#!/usr/bin/env bash

# Транспилирует TypeScript-проект через tsc с указанным tsconfig.
#
# Переменные окружения:
#   TSCONFIG — путь к tsconfig-файлу (обязательна)
#   DEST_DIR — директория для выходных JS-файлов (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${TSCONFIG:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable TSCONFIG not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
readonly TSCONFIG
readonly DEST_DIR

echo -e "\e[1m[TSC] Building (${TSCONFIG}) ...\e[0m\n" >&2

if [[ -d "${DEST_DIR}" && -n "$(find "${DEST_DIR}" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo -e "\e[31m[ERROR] DEST_DIR is not empty: ${DEST_DIR}\e[0m" >&2
    exit 1
fi

npx tsc -p "${TSCONFIG}" --outDir "${DEST_DIR}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Build failed\e[0m\n' >&2 ; exit $rc ;}

echo -e '\n\e[32;1m[DONE] Build complete\e[0m\n' >&2