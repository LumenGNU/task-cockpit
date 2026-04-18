#!/usr/bin/env bash

# Устанавливает зависимости проекта через npm install
# в указанной директории.
#
# Переменные окружения:
#   DEST_DIR — директория с package.json (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: \"${DEST_DIR}\" not a directory\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR

echo -e "\e[1m[NPM] Installing project dependencies in \"${DEST_DIR}\" ...\e[0m\n" >&2

cd "${DEST_DIR}" &>/dev/null

[[ -f 'package.json' ]] || { echo -e "\e[31m[ERROR] package.json not found\e[0m" >&2 ; exit 1 ; }

npm install || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Npm failed\e[0m\n' >&2 ; exit $rc ; }

echo -e "\n\e[32;1m[DONE] Project dependencies installed\e[0m\n" >&2
