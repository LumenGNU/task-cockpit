#!/usr/bin/env bash

# Копирует файлы из SOURCE_DIR в DEST_DIR с помощью rsync,
# применяя паттерны включения и исключения.
#
# Переменные окружения:
#   SOURCE_DIR — откуда копировать (обязательна)
#   DEST_DIR   — куда копировать (обязательна)
#   INCLUDES   — паттерны включения через пробел (обязательна)
#   EXCLUDES   — паттерны исключений через пробел (опционально)

# @fixme отсутствующий источник не вызывает ошибки. а должен!

set -eu
shopt -s nullglob

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${SOURCE_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SOURCE_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${INCLUDES:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable INCLUDES not set or empty\e[0m" >&2 ; exit 1 ; }
readonly SOURCE_DIR
readonly DEST_DIR
readonly INCLUDES

echo -e "\e[1m[COPY] From \"${SOURCE_DIR}/\" to \"${DEST_DIR}/\"\e[0m\n" >&2

[[ -d "${SOURCE_DIR}" ]] || { echo -e "\e[31m[ERROR] SOURCE_DIR \"${SOURCE_DIR}\" is not a directory or does not exist\e[0m" >&2 ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR \"${DEST_DIR}\" is not a directory or does not exist\e[0m" >&2 ; exit 1 ; }


# Сборка include-аргументов
include_args=()
echo ' - [INCLUDES]:' >&2
read -ra patterns <<< "$INCLUDES"
for pattern in "${patterns[@]}"; do
    echo "   - ${pattern}" >&2
    include_args+=(--include="$pattern")
done

# Сборка exclude-аргументов
exclude_args=()
if [[ -n "${EXCLUDES:-}" ]]; then
    echo ' - [EXCLUDES]:' >&2
    read -ra patterns <<< "$EXCLUDES"
    for pattern in "${patterns[@]}"; do
        echo "   - ${pattern}" >&2
        exclude_args+=(--exclude="$pattern")
    done
fi

# @todo: порядок exclude/include аргументов rsync
# Rsync применяет первое совпавшее правило. Если хочется исключить,
# например, node_modules/ — это исключение должно стоять до --include='*/',
# иначе директория сначала совпадёт с --include='*/'
# и никогда не дойдёт до своего exclude-правила.
rsync -amL "${exclude_args[@]}" "${include_args[@]}" --exclude='*' "${SOURCE_DIR}/" "${DEST_DIR}/" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Copying failed\e[0m\n' >&2 ; exit $rc ;}

echo -e '\n\e[32;1m[DONE] Copying complete\e[0m\n' >&2
