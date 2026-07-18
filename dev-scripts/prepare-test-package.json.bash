#!/usr/bin/env bash
# Подготавливает package.json для test runner-а: удаляет dev-поля
# и переключает точку входа на скомпилированный extension.js.
#
# Переменные окружения:
#   DEST_DIR     — целевая директория для выходного package.json (обязательна)
#   EXTENSION_JS — путь к extension.js ОТНОСИТЕЛЬНО DEST_DIR (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: not a directory or does not exist\e[0m" >&2 ; exit 1 ; }

[[ -n "${EXTENSION_JS:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable EXTENSION_JS not set or empty\e[0m" >&2 ; exit 1 ; }
[[ "${EXTENSION_JS}" != /* ]] || { echo -e "\e[31m[ERROR] EXTENSION_JS must be relative to DEST_DIR, got an absolute path: ${EXTENSION_JS}\e[0m" >&2 ; exit 1 ; }
[[ "${EXTENSION_JS}" != *..* ]] || { echo -e "\e[31m[ERROR] EXTENSION_JS must not escape DEST_DIR (contains '..'): ${EXTENSION_JS}\e[0m" >&2 ; exit 1 ; }
[[ -f "${DEST_DIR}/${EXTENSION_JS}" ]] || { echo -e "\e[31m[ERROR] EXTENSION_JS: file does not exist inside DEST_DIR: ${DEST_DIR}/${EXTENSION_JS}\e[0m" >&2 ; exit 1 ; }

readonly DEST_DIR EXTENSION_JS

echo -e "\e[1m[PKG] Preparing package.json ...\e[0m\n" >&2

jq --arg main "${EXTENSION_JS}" '
  del(.scripts, .devDependencies) |
  .main = $main
' package.json > "${DEST_DIR}/package.json"

echo ' - removed: .scripts, .devDependencies'
echo " - set .main: \"${EXTENSION_JS}\""

echo -e "\n\e[32;1m[DONE] Saved at \"${DEST_DIR}/package.json\"\e[0m\n" >&2
