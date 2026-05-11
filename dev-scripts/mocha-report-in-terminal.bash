#!/usr/bin/env bash

# Читает XML-отчёты Mocha из RESULTS_DIR
# и выводит результаты в терминал через XSLT-преобразование.
#
# Переменные окружения:
#   RESULTS_DIR        — директория с XML-отчётами (обязательна)


set -euo pipefail

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${RESULTS_DIR:-}" ]] || {
    echo -e "\e[31m[ERROR] Environment variable RESULTS_DIR not set or empty\e[0m" >&2
    exit 1
}


readonly RESULTS_DIR


XSLT="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" && pwd)/mocha-report-in-terminal.xslt" && readonly XSLT
[[ -f "${XSLT}" ]] || {
    echo -e "\e[31m[ERROR] XSLT file not found: ${XSLT}\e[0m" >&2
    exit 1
}

echo -e "\e[1m[REPORT] Mocha results from \"${RESULTS_DIR}\" ...\e[0m\n" >&2

for xml in "${RESULTS_DIR}"/*.xml; do
    [[ -f "${xml}" ]] || continue # пропустить если glob ничего не нашёл
    LABEL="$(basename "${xml%.xml}")"

    printf '\n%b\n' "$(xsltproc --stringparam TITLE "${LABEL}" "${XSLT}" "${xml}")"
done

echo -e "\n\e[32;1m[DONE] Completed\e[0m\n" >&2
