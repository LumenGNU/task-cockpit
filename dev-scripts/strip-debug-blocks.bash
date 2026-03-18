#!/usr/bin/env bash

# Утилита для удаления отладочного кода (Debug Code Stripper)
#
# ОПИСАНИЕ:
#   Скрипт фильтрует исходный код, удаляя все строки между маркерами
#   (включая и сами маркеры):
#     Начало: // #region DEBUG
#     Конец:  // #endregion DEBUG
#
#   Работает в 2 фазы:
#   1. Валидация: Проверяет все файлы на корректность маркеров (отсутствие
#      незакрытых регионов или лишних закрывающих маркеров). Если найдены
#      ошибки валидации, скрипт прервёт работу.
#   2. Фильтрация: Копирует файлы с сохранением структуры директорий,
#      вырезая отладочные блоки.
#
# ИСПОЛЬЗОВАНИЕ:
#   Скрипт требует установки трех обязательных переменных окружения:
#     SOURCE_DIR   - Путь к исходной директории (например: ./src)
#     DEST_DIR     - Путь к целевой директории (например: ./dist)
#     FIND_FILTERS - Фильтры для утилиты find, чтобы искать только нужные
#                    файлы (например: -name '*.ts')
#
# ПРИМЕР ЗАПУСКА:
#   SOURCE_DIR="./src" DEST_DIR="./build" FIND_FILTERS="-name '*.ts' -o -name '*.js'" ./strip-debug-blocks.bash

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m" >&2 ; exit 1' TERM INT

# Проверка переменных среды
[[ -n "${SOURCE_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SOURCE_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -n "${FIND_FILTERS:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable FIND_FILTERS not set or empty\e[0m" >&2 ; exit 1 ; }

START_MARKER='// #region DEBUG'
END_MARKER='// #endregion DEBUG'

echo -e '\e[1m[STRIP] Stripping debug blocks ...\e[0m'

# Фаза 1: Валидация всех файлов
VALIDATION_FAILED=0

while IFS= read -r -d '' TS_FILE; do
    awk -v start="${START_MARKER}" -v end="${END_MARKER}" -v file="${TS_FILE}" '
        BEGIN { depth = 0; errors = 0 }
        index($0, start) {
            depth++
            open_lines[depth] = NR
            next
        }
        index($0, end) {
            if (depth == 0) {
                printf "%s:%d: closing marker \"%s\" without opening\n", file, NR, end > "/dev/stderr"
                errors++
            } else {
                delete open_lines[depth]
                depth--
            }
            next
        }
        END {
            if (depth > 0) {
                for (i = 1; i <= depth; i++) {
                    printf "%s:%d: unclosed opening marker \"%s\"\n", file, open_lines[i], start > "/dev/stderr"
                }
                errors++
            }
            exit (errors > 0 ? 1 : 0)
        }
    ' "${TS_FILE}" > /dev/null || VALIDATION_FAILED=1
done < <(eval "find \"${SOURCE_DIR}\" ${FIND_FILTERS} -type f -print0")

if [[ ${VALIDATION_FAILED} -eq 1 ]]; then
    echo -e "\e[31m[ERROR] Validation failed. Fix the errors above before filtering.\e[0m" >&2
    exit 1
fi

# Фаза 2: Фильтрация
while IFS= read -r -d '' TS_FILE; do
    # Вычисляем относительный путь от SOURCE_DIR
    REL_PATH="${TS_FILE#${SOURCE_DIR}/}"
    DEST_FILE="${DEST_DIR}/${REL_PATH}"

    # Создаём директорию для файла в DEST_DIR
    mkdir -p "$(dirname "${DEST_FILE}")"

    # Фильтруем и сохраняем в целевой файл
    awk -v start="${START_MARKER}" -v end="${END_MARKER}" '
        BEGIN { depth = 0 }
        index($0, start) { depth++; next }
        index($0, end) { depth--; next }
        depth == 0 { print }
    ' "${TS_FILE}" > "${DEST_FILE}"

    echo " - OK: ${REL_PATH}"
done < <(eval "find -L \"${SOURCE_DIR}\" ${FIND_FILTERS} -type f -print0")

echo -e "\n\e[32;1m[DONE] Files stripped and saved to \"${DEST_DIR}\"\e[0m\n"
