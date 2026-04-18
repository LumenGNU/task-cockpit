#!/usr/bin/env bash

# Запускает проверку типов TypeScript через tsc --noEmit.
#
# Переменные окружения:
#   TSCONFIG — путь к tsconfig-файлу (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${TSCONFIG:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable TSCONFIG not set or empty\e[0m" >&2 ; exit 1 ; }
readonly TSCONFIG

echo -e "\e[1m[LINT] Typescript type check (\"./${TSCONFIG}\") ...\e[0m\n" >&2

npx tsc --noEmit -p "./${TSCONFIG}" || { rc=$? ; echo -e '\n\e[31;1m[FAIL] Type check failed\e[0m\n' >&2 ; exit $rc ;}

echo -e '\n\e[32;1m[DONE] No type errors\e[0m\n' >&2