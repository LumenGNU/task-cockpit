#!/usr/bin/env bash

# Удаляет содержимое директории, перемещая файлы в корзину через gio trash.
#
# Переменные окружения:
#   DEST_DIR — директория, содержимое которой удаляется (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: \"${DEST_DIR}\" not a directory\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR

echo -e "\e[1m[CLEAN] Removing contents of \"${DEST_DIR}\" ...\e[0m\n" >&2

[[ -d "${DEST_DIR}" ]] || { echo -e "\n\e[32;1m[DONE] Directory \"${DEST_DIR}\" not exists\e[0m\n" >&2 ; exit 0 ; }

find "${DEST_DIR}" -mindepth 1 -maxdepth 1 -exec gio trash -- {} +

echo -e "\n\e[32;1m[DONE] Directory \"${DEST_DIR}\" cleaned\e[0m\n" >&2
