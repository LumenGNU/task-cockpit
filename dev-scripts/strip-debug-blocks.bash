#!/usr/bin/env bash

# Утилита для удаления отладочного кода (Debug Code Stripper)
#
# ОПИСАНИЕ:
#   Скрипт фильтрует исходный код, удаляя блоки между маркерами
#   (включая сами маркеры):
#     // #region DEBUG  …  // #endregion DEBUG
#     // #region TEST   …  // #endregion TEST
#
#   Два режима работы (STRIP_MODE):
#     prod — удаляются блоки DEBUG и TEST
#     test — удаляются только блоки DEBUG; блоки TEST остаются как есть
#
#   Работает в 2 фазы:
#   1. Валидация: Проверяет все файлы на корректность маркеров обоих типов
#      (незакрытые регионы, лишние закрывающие маркеры, перекрёстная
#      вложенность). Если найдены ошибки — скрипт прервёт работу.
#   2. Фильтрация: Копирует файлы с сохранением структуры директорий,
#      вырезая блоки согласно выбранному режиму.
#
# ИСПОЛЬЗОВАНИЕ:
#   Обязательные переменные окружения:
#     SOURCE_DIR   - Путь к исходной директории (например: ./src)
#     DEST_DIR     - Путь к целевой директории (например: ./dist)
#     FIND_FILTERS - Фильтры для утилиты find (например: -name '*.ts')
#     STRIP_MODE   - Режим: prod | test
#
# ПРИМЕР ЗАПУСКА:
#   SOURCE_DIR="./src" DEST_DIR="./build" FIND_FILTERS="-name '*.ts'" STRIP_MODE=prod ./strip-debug-blocks.bash
#
# @note: список файлов вычисляется дважды — в фазе валидации и фазе фильтрации.
# Изменения в файловой системе между фазами теоретически дадут расхождение.

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

# Проверка переменных среды
[[ -n "${SOURCE_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SOURCE_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${FIND_FILTERS:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable FIND_FILTERS not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${STRIP_MODE:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable STRIP_MODE not set or empty\e[0m" >&2 ; exit 1 ; }
readonly SOURCE_DIR
readonly DEST_DIR
readonly FIND_FILTERS
readonly STRIP_MODE

case "${STRIP_MODE}" in
    prod|test) ;;
    *) echo -e "\e[31m[ERROR] STRIP_MODE must be 'prod' or 'test', got '${STRIP_MODE}'\e[0m" >&2 ; exit 1 ;;
esac

START_DEBUG='// #region DEBUG' && readonly START_DEBUG
END_DEBUG='// #endregion DEBUG' && readonly END_DEBUG
START_TEST='// #region TEST' && readonly START_TEST
END_TEST='// #endregion TEST' && readonly END_TEST

echo -e "\e[1m[STRIP] Mode: ${STRIP_MODE} — Stripping debug blocks ...\e[0m\n" >&2

# Фаза 1: Валидация всех файлов (оба типа маркеров, стековая проверка)
VALIDATION_FAILED=0

while IFS= read -r -d '' TS_FILE; do
    awk \
        -v sd="${START_DEBUG}" -v ed="${END_DEBUG}" \
        -v st="${START_TEST}" -v et="${END_TEST}" \
        -v file="${TS_FILE}" \
    '
        BEGIN { depth = 0; errors = 0 }
        index($0, sd) {
            depth++
            stack_type[depth] = "DEBUG"
            stack_line[depth] = NR
            next
        }
        index($0, st) {
            depth++
            stack_type[depth] = "TEST"
            stack_line[depth] = NR
            next
        }
        index($0, ed) {
            if (depth == 0) {
                printf "  \033[31mFAIL\033[0m  %s:%d: closing marker \"%s\" without opening\n", file, NR, ed
                errors++
            } else if (stack_type[depth] != "DEBUG") {
                printf "  \033[31mFAIL\033[0m  %s:%d: expected \"%s\" to close %s block (line %d), got \"%s\"\n", file, NR, et, stack_type[depth], stack_line[depth], ed
                errors++
            } else {
                delete stack_type[depth]
                delete stack_line[depth]
                depth--
            }
            next
        }
        index($0, et) {
            if (depth == 0) {
                printf "  \033[31mFAIL\033[0m  %s:%d: closing marker \"%s\" without opening\n", file, NR, et
                errors++
            } else if (stack_type[depth] != "TEST") {
                printf "  \033[31mFAIL\033[0m  %s:%d: expected \"%s\" to close %s block (line %d), got \"%s\"\n", file, NR, ed, stack_type[depth], stack_line[depth], et
                errors++
            } else {
                delete stack_type[depth]
                delete stack_line[depth]
                depth--
            }
            next
        }
        END {
            if (depth > 0) {
                for (i = 1; i <= depth; i++) {
                    printf "  \033[31mFAIL\033[0m  %s:%d: unclosed %s block\n", file, stack_line[i], stack_type[i]
                }
                errors++
            }
            exit (errors > 0 ? 1 : 0)
        }
    ' "${TS_FILE}" > /dev/null || VALIDATION_FAILED=1
done < <(eval "find -L \"${SOURCE_DIR}\" ${FIND_FILTERS} -type f -print0")

if [[ ${VALIDATION_FAILED} -eq 1 ]]; then
    echo -e "\e[31m[ERROR] Validation failed. Fix the errors above before filtering.\e[0m" >&2
    exit 1
fi

# Фаза 2: Фильтрация
while IFS= read -r -d '' TS_FILE; do
    REL_PATH="${TS_FILE#"${SOURCE_DIR}"/}"
    DEST_FILE="${DEST_DIR}/${REL_PATH}"

    mkdir -p "$(dirname "${DEST_FILE}")"

    if [[ "${STRIP_MODE}" == "prod" ]]; then
        # PROD: удаляем и DEBUG, и TEST блоки
        awk \
            -v sd="${START_DEBUG}" -v ed="${END_DEBUG}" \
            -v st="${START_TEST}" -v et="${END_TEST}" \
        '
            BEGIN { depth = 0 }
            index($0, sd) { depth++; next }
            index($0, ed) { depth--; next }
            index($0, st) { depth++; next }
            index($0, et) { depth--; next }
            depth == 0 { print }
        ' "${TS_FILE}" > "${DEST_FILE}"
    else
        # TEST: удаляем только DEBUG блоки; TEST маркеры и содержимое остаются
        awk \
            -v sd="${START_DEBUG}" -v ed="${END_DEBUG}" \
        '
            BEGIN { depth = 0 }
            index($0, sd) { depth++; next }
            index($0, ed) { depth--; next }
            depth == 0 { print }
        ' "${TS_FILE}" > "${DEST_FILE}"
    fi

    echo -e "  \e[32mOK\e[0m  ${REL_PATH}"
done < <(eval "find -L \"${SOURCE_DIR}\" ${FIND_FILTERS} -type f -print0")

echo -e "\n\e[32;1m[DONE] Files stripped and saved to \"${DEST_DIR}\"\e[0m\n" >&2