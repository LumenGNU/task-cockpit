#!/usr/bin/env bash

# Транспилирует TypeScript-проект через tsc с указанным tsconfig.
#
# Переменные окружения:
#   TSCONFIG — путь к tsconfig-файлу (обязательна)
#   DEST_DIR — директория для выходных JS-файлов (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${TSCONFIG:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable TSCONFIG not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -r "${TSCONFIG}" ]] || { echo -e "\e[31m[ERROR] TSCONFIG not readable: ${TSCONFIG:-<not set>}\e[0m" >&2 ; exit 1 ; }
readonly TSCONFIG

[[ -n "${WORK_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable WORK_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${WORK_DIR}" ]] || { echo -e "\e[31m[ERROR] WORK_DIR not a directory: ${WORK_DIR:-<not set>}\e[0m" >&2 ; exit 1 ; }
readonly WORK_DIR

echo -e "\e[1m[TSC] Building (${TSCONFIG}) ...\e[0m\n" >&2

cd "${WORK_DIR}" &>/dev/null || { rc=$? ; echo -e "\n\e[31;1m[FAIL] Change directory failed: ${WORK_DIR}\e[0m\n" >&2 ; exit $rc ;}

npx tsc -p "${TSCONFIG}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Build failed\e[0m\n' >&2 ; exit $rc ;}

echo -e '\n\e[32;1m[DONE] Build complete\e[0m\n' >&2