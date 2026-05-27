#!/usr/bin/env bash
# Подготавливает package.json для test runner-а: удаляет dev-поля
# и переключает точку входа на скомпилированный extension.js.
#
# Переменные окружения:
#   DEST_DIR — целевая директория для выходного package.json (обязательна)
set -eu
trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT
[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: not a directory or does not exist\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR
echo -e "\e[1m[PKG] Preparing package.json ...\e[0m\n" >&2
jq '
  del(.scripts, .devDependencies) |
  .main = "~stripped/extension.js"
' package.json > "${DEST_DIR}/package.json"
echo ' - removed: .scripts, .devDependencies'
echo ' - set .main: "~stripped/extension.js"'
echo -e "\n\e[32;1m[DONE] Saved at \"${DEST_DIR}/package.json\"\e[0m\n" >&2