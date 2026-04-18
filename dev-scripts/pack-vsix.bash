#!/usr/bin/env bash

# Упаковывает расширение в VSIX-файл через vsce.
# Имя файла включает версию и диапазон совместимости с VS Code.
# Если установлена переменная RELEASE — собирает релизную версию,
# иначе pre-release с временной меткой.
#
# Переменные окружения:
#   SOURCE_DIR — директория с package.json для упаковки (обязательна)
#   DEST_DIR   — целевая директория для сохранения VSIX (обязательна)
#   RELEASE    — если установлена, собирает релизную версию (опционально)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${SOURCE_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SOURCE_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ ! -e "${SOURCE_DIR}" || -d "${SOURCE_DIR}" ]] || { echo -e "\e[31m[ERROR] SOURCE_DIR: \"${SOURCE_DIR}\" exist and not a directory\e[0m" >&2 ; exit 1 ; }

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ ! -e "${DEST_DIR}" || -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: \"${DEST_DIR}\" exist and not a directory\e[0m" >&2 ; exit 1 ; }

readonly SOURCE_DIR

echo -e "\e[1m[VSCE] Packaging extension from \"${SOURCE_DIR}\" files ...\e[0m\n" >&2

DEST_DIR="${PWD}/${DEST_DIR}" && readonly DEST_DIR

cd "${SOURCE_DIR}" &>/dev/null

VERSION=$(jq -r '.version' package.json) && readonly VERSION

# версия либо точная. либо диапазон без semver-сокращений
VSCODE_VERSION_RANGE=$(jq -r '.engines.vscode' package.json) && readonly VSCODE_VERSION_RANGE
_min=$(npx semver -c --ltr "${VSCODE_VERSION_RANGE}")
_max=$(npx semver -c --rtl "${VSCODE_VERSION_RANGE}")
VSCODE_VERSION=$( [[ "$_min" != "$_max" ]] && echo "${_min}-${_max}" || echo "$_min" ) && readonly VSCODE_VERSION


if [[ -n "${RELEASE:-}" ]]; then
    FILE_NAME="${DEST_DIR}/${VERSION}+vscode${VSCODE_VERSION}.vsix"
    RELEASE_FLAG=""
else
    TIMESTAMP=$(date -u +%Y%m%d.%H%M%S) && readonly TIMESTAMP
    FILE_NAME="${DEST_DIR}/${VERSION}-pre.${TIMESTAMP}+vscode${VSCODE_VERSION}.vsix" && readonly FILE_NAME
    RELEASE_FLAG="--pre-release"
fi

npx vsce package --dependencies ${RELEASE_FLAG} --out "${FILE_NAME}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Vsce failed\e[0m\n' >&2 ; exit $rc ;}

echo -e "\n\e[32;1m[DONE] VSIX save at \"${FILE_NAME}\"\e[0m\n" >&2