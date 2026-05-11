#!/usr/bin/env bash

# Удаляет директорию DEST_DIR, перемещая её в корзину через gio trash.
#
# Переменные окружения:
#   DEST_DIR — целевая директория для удаления (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: \"${DEST_DIR}\" is not a directory\e[0m" >&2 ; exit 1 ; }
# только директории с префиксом `~` в имени можно удалять скриптом
if [[ "$(basename "$DEST_DIR")" != ~* ]]; then
    echo -e "\e[31m[ERROR] Directory name must start with '~', got: \"$(basename "$DEST_DIR")\"\e[0m" >&2
    exit 1
fi

echo -e "\e[1m[RM] Removing directory \"${DEST_DIR}\" ...\e[0m\n" >&2

[[ -d "${DEST_DIR}" ]] && gio trash -- "${DEST_DIR}"

echo -e "\n\e[32;1m[DONE] Directory \"${DEST_DIR}\" removed\e[0m\n" >&2