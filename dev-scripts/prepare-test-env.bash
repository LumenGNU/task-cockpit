#!/usr/bin/env bash

# ## Назначение
#
# Подготавливает изолированное тестовое окружение, в котором тесты работают с исходниками 
# основного проекта через симлинки — без копирования файлов и без включения их в git репозитория.
# 
# Позволяет тестировать отдельные файлы и модули основного проекта изолированно — 
# даже если остальной код проекта сломан, не компилируется или находится в промежуточном состоянии.
# 
# Вместо того чтобы тестировать весь проект целиком, скрипт подключает к тестовому окружению 
# только явно перечисленные файлы (через симлинки), не затрагивая остальное, не сщхдавая лишних
# записей в git.
# 
# ## Переменные, окружение
# 
# `SOURCE_BASE` — обязательная, путь к директории src/ основного проекта.
# 
# ~~~
# export SOURCE_BASE="../Task Cockpit/src"
# ~~~
# 
# Требования (проверяются при старте, иначе немедленный выход):
# 
# - переменная должна быть задана и непустой
# - путь должен существовать и быть директорией
# - путь должен оканчиваться на /src
# 
# ## Этапы выполнения
# 
# ### 1. Симлинк .vscode-test
# 
# Создаёт .vscode-test → ../.vscode-test в корне тестового проекта, если симлинк отсутствует. 
# Нужен для VS Code Test Runner, который ищет бинарники Electron/Chromium по этому пути.
# 
# Идемпотентен: если симлинк уже есть — пропускает.
# 
# ### 2. npm install
# Устанавливает зависимости, если они устарели или отсутствуют. Решение принимается по 
# трём условиям (любое → установка):
# 
# - node_modules/ не существует
# - node_modules/.package-lock.json не существует
# - package.json или package-lock.json новее node_modules/.package-lock.json
# 
# .package-lock.json используется как sentinel, он достаточно надёжно отражает актуальность
# node_modules.
# 
# ### 3. Очистка src/
# 
# ~~~
# find src -type l -exec gio trash -- {} +
# find src -mindepth 1 -depth -type d -empty -exec gio trash -- {} +
# ~~~
#
# - Удаляет все симлинки из src/ (независимо от их назначения)
# - Затем удаляет пустые директории (в порядке глубины — сначала вложенные)
# - Использует gio trash — файлы попадают в корзину, не уничтожаются безвозвратно
# 
# Реальные файлы в src/ (не симлинки) не затрагиваются.
# 
# ### 4. Создание симлинков по tested-files.list
# Основная логика. Файл tested-files.list — список путей относительно SOURCE_BASE, по одному на строку.
# 
# Формат файла:
# 
# ~~~
# Это комментарий — строка пропускается
# utils/asyncQueue.ts
# monitor/Monitor.ts
# 
# # Пустые строки тоже пропускаются
# hierarchy/Hierarchy.ts
# ~~~
#
# Для каждой строки:
# 
# - Проверяет, что $SOURCE_BASE/$entry существует и является файлом (не директорией)
# - Вычисляет относительный путь от места расположения будущего симлинка до источника
# - Создаёт промежуточные директории (mkdir -p)
# - Создаёт симлинк src/$entry → <относительный путь>
# 
# Вычисление относительного пути — нюанс:
# Симлинк лежит в src/$entry, поэтому таргет должен быть относительным от директории симлинка. Скрипт 
# считает глубину entry в дереве (Foo/Bar/baz.ts → глубина 2) и строит соответствующий префикс из ../:
# 
# entry → симлинк в → prefix → таргет
# 
# `Bar.ts` → `src/` → `../` → `../$SOURCE_BASE/Bar.ts`
# `Foo/Bar.ts` → `src/Foo/` → `../../` → `../../$SOURCE_BASE/Foo/Bar.ts`
# `A/B/C.ts` → `src/A/B/` → `../../../` → `../../../$SOURCE_BASE/A/B/C.ts`
# 
# Ошибки (не прерывают выполнение, накапливаются):
# 
# - источник — директория, а не файл
# - источник не существует
# - в src/$entry уже лежит реальный файл (не симлинк) — конфликт
# 
# Скрипт завершится с exit $ERR 1 если хотя бы одна ошибка.
# 
# Если tested-files.list отсутствует — скрипт завершается успешно (exit 0), пропустив этот и 
# следующий этап.
# 
# ### 5. Обновление .git/info/exclude
# 
# Автоматически исключает созданные симлинки из git репозитория — без правки .gitignore.
# 
# Логика обновления:
# 
# - Читает текущий exclude, выбрасывает строки с префиксом $REPO_PREFIX/src/ (управляемая секция)
# - Формирует новый список из текущего tested-files.list (без комментариев и пустых строк)
# - Объединяет остаток старого файла с новым списком, сортирует (sort -u), добавляет маркер 
#   `# managed by prepare-test-env.bash`
# - Перезаписывает файл
# 
# Закомментированная строка в tested-files.list не попадёт в exclude (Обычно это не проблема, 
# но стоит иметь в виду.)
# 
# Если проект не является git-репозиторием (git rev-parse возвращает пустоту) — этап пропускается 
# без ошибки.
# 
# ## Поведение при ошибках
# 
# SOURCE_BASE не задан / не директория / не /src  : немедленный выход, код 1
# SIGTERM / SIGINT                                : trap, сообщение, выход 1
# set -eu                                         : любая неожиданная ошибка bash — выход
# Ошибка в конкретном entry                       : сообщение в stderr, ERR=1, продолжение
# Ошибки в entries                                : выход с кодом 1 после завершения всех этапов
# 
# ## Типичное использование
# 
# ~~~
# export SOURCE_BASE="../Task Cockpit/src"
# bash prepare-test-env.bash
# ~~~
# 
# Или через .env + direnv, или завернув в задачу VS Code.
# 
# ---------------------------------------------------------------------------------------------------------------------
set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${SOURCE_BASE:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SOURCE_BASE not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${SOURCE_BASE}" ]] || { echo -e "\e[31m[ERROR] SOURCE_BASE: not a directory or does not exist\e[0m" >&2 ; exit 1 ; }
[[ "${SOURCE_BASE}" == */src ]] || { echo -e "\e[31m[ERROR] SOURCE_BASE must end with /src\e[0m" >&2 ; exit 1 ; }
readonly SOURCE_BASE

echo -e "\e[1m[PREP] Preparing test environment ...\e[0m\n" >&2

ERR=0

# ---------------------
LINK=".vscode-test" && readonly LINK
TARGET="../.vscode-test" && readonly TARGET

if [ ! -L "$LINK" ]; then
    ln -s "$TARGET" "$LINK"
    echo -e "  \e[32mCREATED\e[0m  ${LINK}  →  ${TARGET}"
else
    echo -e "  \e[32m     OK\e[0m  ${LINK}  (symlink exists)"
fi

# --------------
SENTINEL="node_modules/.package-lock.json" && readonly SENTINEL
NEEDS_INSTALL=false

if [ ! -d "node_modules" ] || [ ! -f "$SENTINEL" ]; then
    NEEDS_INSTALL=true
elif [ "package.json" -nt "$SENTINEL" ] || [ "package-lock.json" -nt "$SENTINEL" ]; then
    NEEDS_INSTALL=true
fi

if $NEEDS_INSTALL; then
    npm install
    echo -e "  \e[32m     OK\e[0m  node_modules  (installed)"
else
    echo -e "  \e[32m     OK\e[0m  node_modules  (up to date)"
fi

# ------------
find src -type l -exec gio trash -- {} +
find src -mindepth 1 -depth -type d -empty -exec gio trash -- {} +
echo -e "  \e[32m     OK\e[0m  src  (cleaned symlinks and empty dirs)"


# ------------
LIST_FILE="tested-files.list" && readonly LIST_FILE

if [ ! -f "$LIST_FILE" ]; then
    echo -e "  \e[33m   SKIP\e[0m  ${LIST_FILE}  (not found)"
    echo -e "\n\e[32;1m[DONE] Completed\e[0m\n" >&2
    exit 0
fi


# -----------------



while IFS= read -r entry || [ -n "$entry" ]; do

    [ -z "$entry" ] && continue         # пропуск пустых
    [[ "$entry" == \#* ]] && continue   # и закомментированных строк

    source_path="$SOURCE_BASE/$entry"

    if [ -d "$source_path" ]; then
        echo -e "  \e[31m  ERROR\e[0m  src/${entry}  (source is a directory)" >&2
        ERR=1
        continue
    fi

    if [ ! -e "$source_path" ]; then
        echo -e "  \e[31m  ERROR\e[0m  src/${entry}  (source file does not exist)" >&2
        ERR=1
        continue
    fi

    # Вычисляем глубину entry в дереве src/:
    # для "Foo/Bar.ts" depth=1, prefix будет "../../" —
    # чтобы из src/Foo/ добраться до SOURCE_BASE

    entry_dir=$(dirname "$entry")
    if [ "$entry_dir" = "." ]; then
        depth=0
    else
        depth=$(echo "$entry_dir" | tr -cd '/' | wc -c)
        depth=$((depth + 1))
    fi

    prefix=""
    for ((i=0; i <= depth; i++)); do
        prefix="../$prefix"
    done

    link_path="src/$entry"

    if [ -e "$link_path" ] && [ ! -L "$link_path" ]; then
        echo -e "  \e[31m  ERROR\e[0m  ${link_path}  (conflicts with existing file)" >&2
        ERR=1
        continue
    fi

    link_target="${prefix}${SOURCE_BASE}/$entry"

    mkdir -p "$(dirname "$link_path")"
    ln -s "$link_target" "$link_path"
    echo -e "  \e[32m     OK\e[0m  ${link_path}  →  ${link_target}"

done < "$LIST_FILE"


# ------------ update .git/info/exclude
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || true)" && readonly GIT_DIR

if [ -n "$GIT_DIR" ]; then
    EXCLUDE_FILE="$GIT_DIR/info/exclude" && readonly EXCLUDE_FILE

    generated=()
    # путь относительно корня репозитория
    REPO_PREFIX="$(git rev-parse --show-prefix)" && readonly REPO_PREFIX


    if [ -f "$LIST_FILE" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            [ -z "$line" ] && continue          # пропуск пустых
            [[ "$line" == \#* ]] && continue    # и закомментированных строк
            generated+=("${REPO_PREFIX}src/$line")
        done < "$LIST_FILE"
    fi

    existing=()
    if [ -f "$EXCLUDE_FILE" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            [[ -z "$line" || "$line" == \#* ]] && continue
            [[ "$line" == "${REPO_PREFIX}src/"* ]] && continue
            existing+=("$line")
        done < "$EXCLUDE_FILE"
    fi

    {
        echo "# managed by prepare-test-env.bash"
        printf '%s\n' "${existing[@]}" "${generated[@]}" | sort -u
    } > "$EXCLUDE_FILE"

    echo -e "  \e[32m     OK\e[0m  ${EXCLUDE_FILE}  (updated)"
fi

# ----------------------

if [[ $ERR -eq 0 ]]; then
echo -e "\n\e[32;1m[DONE] Completed\e[0m\n" >&2
else
echo -e "\n\e[31;1m[FAIL] Errors occurred during execution\e[0m\n" >&2
fi

exit $ERR