#!/usr/bin/env bash

# Устанавливает production-зависимости через npm ci --omit=dev
# в указанной директории.
#
# Переменные окружения:
#   DEST_DIR — директория с package.json и package-lock.json (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: \"${DEST_DIR}\" not a directory\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR

echo -e "\e[1m[NPM] Installing production dependencies in \"${DEST_DIR}\" ...\e[0m\n" >&2

cd "${DEST_DIR}" &>/dev/null

[[ -f 'package.json' ]] || { echo -e "\e[31m[ERROR] package.json not found\e[0m" >&2 ; exit 1 ; }
[[ -f 'package-lock.json' ]] || { echo -e "\e[31m[ERROR] package-lock.json not found\e[0m" >&2 ; exit 1 ; }

npm ci --omit=dev || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Npm failed\e[0m\n' >&2 ; exit $rc ; }

echo -e "\n\e[32;1m[DONE] Production dependencies installed\e[0m\n" >&2