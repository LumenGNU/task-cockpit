#!/usr/bin/env bash

# Выводит форматированный баннер в stderr.
#
# Переменные среды
# 
# - `MESSAGE`    Текст баннера
# - `TAG`        Префикс сообщения; выводится как `[TAG]` перед текстом
# - `TIMESTAMP`  Формат для `date +`; если задана, добавляет `(дата-время)` после текста
# 
# - Очищает терминал перед выводом.
# - Выводит сообщение жирным шрифтом в stderr.
# - Если `MESSAGE` не задана — завершается с ошибкой.
# - Прерывание по `SIGTERM`/`SIGINT` сопровождается сообщением об ошибке.

set -eu
trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT


[[ -n "${MESSAGE:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable MESSAGE not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${TYPE:-}" ]] && [[ "${TYPE}" =~ ^[0-9]+$ ]] || { echo -e "\e[31m[ERROR] Environment variable TYPE not set or empty\e[0m" >&2 ; exit 1 ; }

readonly MESSAGE
readonly TYPE

TEXT="${MESSAGE}"
LABEL=""
[[ -n "${TAG:-}" ]]       && LABEL="[${TAG}] "
[[ -n "${TIMESTAMP:-}" ]] && TEXT="${TEXT} ($(date +"${TIMESTAMP}"))"

case "${CLEAR:-}" in
    1|y|yes|true) clear ;;
esac

export BOXES="$(dirname "${BASH_SOURCE[0]}")/boxes"

echo -e "\e[1m${LABEL}${TEXT}\e[0m" | 
    boxes                                         \
        -d "box-${TYPE}"                          \
        -s "$(tput cols)x"                        \
        -a c                                      \
    >&2