#!/usr/bin/env bash

# Экспортирует SVG-файл в указанный формат через Inkscape.
#
# Переменные окружения:
#   SRC_SVG     — исходный SVG-файл (обязательна)
#   TARGET_DIR  — директория для сохранения результата (обязательна)
#   TARGET_TYPE — формат экспорта, например png или pdf (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${SRC_SVG:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SRC_SVG not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${TARGET_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable TARGET_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${TARGET_TYPE:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable TARGET_TYPE not set or empty\e[0m" >&2 ; exit 1 ; }
readonly SRC_SVG
readonly TARGET_DIR
readonly TARGET_TYPE


echo -e "\e[1m[SVG] Export \"${SRC_SVG}\" ...\e[0m\n" >&2

[[ -f "${SRC_SVG}" ]] || { echo -e "\e[31m[ERROR] SRC_SVG \"${SRC_SVG}\" is not a file or does not exist\e[0m" >&2 ; exit 1 ; }
[[ "${SRC_SVG}" == *.svg ]] || { echo -e "\e[31m[ERROR] SRC_SVG \"${SRC_SVG}\" must have .svg extension\e[0m" >&2 ; exit 1 ; }
[[ -d "${TARGET_DIR}" ]] || { echo -e "\e[31m[ERROR] TARGET_DIR \"${TARGET_DIR}\" is not a directory or does not exist\e[0m" >&2 ; exit 1 ; }

TARGET_FILE="${TARGET_DIR}/$(basename "${SRC_SVG}" .svg).${TARGET_TYPE}"

inkscape --export-type="${TARGET_TYPE}" --export-filename="${TARGET_FILE}" "${SRC_SVG}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Export failed\e[0m\n' >&2 ; exit $rc ;}

echo -e "\n\e[32;1m[DONE] Saved at ${TARGET_FILE}\e[0m\n" >&2