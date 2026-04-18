#!/usr/bin/env bash

# Создаёт пустую директорию DEST_DIR. Если директория существует — очищает её
# содержимое через gio trash. Имя директории должно начинаться с ~.
#
# Переменные окружения:
#   DEST_DIR — целевая директория (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: \"${DEST_DIR}\" exists and not a directory\e[0m" >&2 ; exit 1 ; }
[[ "$(basename "${DEST_DIR}")" == ~* ]] || { echo -e "\e[31m[ERROR] Directory name must start with ~: \"${DEST_DIR}\"\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR

echo -e "\e[1m[CREATE] Create empty directory \"${DEST_DIR}\" ...\e[0m\n" >&2

if [[ -d "${DEST_DIR}" ]]; then
    find "${DEST_DIR}" -mindepth 1 -maxdepth 1 -exec gio trash -- {} +
    echo -e "\n\e[32;1m[DONE] Cleaned and ready: \"${DEST_DIR}\"\e[0m\n" >&2
else
    mkdir "${DEST_DIR}"
    echo -e "\n\e[32;1m[DONE] Created: \"${DEST_DIR}\"\e[0m\n" >&2
fi

