#!/usr/bin/env bash

# Создаёт директорию DEST_DIR, если она не существует.
#
# Переменные окружения:
#   DEST_DIR — целевая директория для создания (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: \"${DEST_DIR}\" exist and not a directory\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR

echo -e "\e[1m[CREATE] Create directory \"${DEST_DIR}\" ...\e[0m\n" >&2

[[ -d "${DEST_DIR}" ]] || mkdir "${DEST_DIR}"

# Directory "..." created выводится даже если директория уже существовала и mkdir не вызывался. 
# Но это скорее вопрос формулировки.
# А с другой стороны: если она "есть" значит она была "created", просто не прямо сейчас :)
echo -e "\n\e[32;1m[DONE] Directory \"${DEST_DIR}\" created\e[0m\n" >&2
