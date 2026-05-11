#!/usr/bin/env bash

# Переименовывает директорию SRC_DIR в NEW_NAME (в том же каталоге).
# Переменные окружения:
#   SRC_DIR  — исходная директория (обязательна, должна существовать)
#   NEW_NAME — новое имя (обязательно)
# Ограничение: исходное имя (последний компонент пути) должно начинаться с `~`

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

# Проверка SRC_DIR
[[ -n "${SRC_DIR:-}" ]] || {
    echo -e "\e[31m[ERROR] Environment variable SRC_DIR not set or empty\e[0m" >&2
    exit 1
}
# Проверка NEW_NAME
[[ -n "${NEW_NAME:-}" ]] || {
    echo -e "\e[31m[ERROR] Environment variable NEW_NAME not set or empty\e[0m" >&2
    exit 1
}
readonly SRC_DIR
readonly NEW_NAME
[[ -e "${SRC_DIR}" ]] || {
    echo -e "\e[31m[ERROR] SRC_DIR: \"${SRC_DIR}\" is not exists\e[0m" >&2
    exit 1
}
[[ -d "${SRC_DIR}" ]] || {
    echo -e "\e[31m[ERROR] SRC_DIR: \"${SRC_DIR}\" is not a directory\e[0m" >&2
    exit 1
}

src_name="$(basename "$SRC_DIR")"
[[ "$src_name" == ~* ]] || {
    echo -e "\e[31m[ERROR] Source directory name must start with '~', got: \"$src_name\"\e[0m" >&2
    exit 1
}

echo -e "\e[1m[RENAME] Renaming directory \"${SRC_DIR}\" to \"${NEW_NAME}\" ...\e[0m\n" >&2

# TODO если NEW_NAME уществует и директория -- удалить. если файл - ошибка
DST_PATH="$(dirname "$SRC_DIR")/${NEW_NAME}"
readonly DST_PATH
if [[ -e "$DST_PATH" ]]; then
    if [[ -d "$DST_PATH" ]]; then
        # echo -e "\e[33m[WARN] Target directory \"${DST_PATH}\" already exists, removing...\e[0m" >&2
        gio trash -- "$DST_PATH" &>/dev/null || {
            echo -e "\e[31m[ERROR] Failed to remove existing target directory\e[0m" >&2
            exit 1
        }
    else
        echo -e "\e[31m[ERROR] Target \"${DST_PATH}\" exists and is not a directory\e[0m" >&2
        exit 1
    fi
fi

gio rename -- "${SRC_DIR}" "${NEW_NAME}" &>/dev/null || {
    ERR_CODE=$?
    echo -e "\e[31m[ERROR] Renaming failed with code ${ERR_CODE}\e[0m" >&2
    exit "${ERR_CODE}"
}

echo -e "\n\e[32;1m[DONE] Directory \"${src_name}\" renamed to \"${NEW_NAME}\"\e[0m\n" >&2
