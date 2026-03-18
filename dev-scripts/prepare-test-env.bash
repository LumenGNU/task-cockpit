#!/usr/bin/env bash

# Подготавливает окружение для тестового проекта:
#
# - Создаёт симлинк .vscode-test → ../.vscode-test (если отсутствует)
# - Устанавливает зависимости через npm install (если устарели)
# - Удаляет симлинки и пустые каталоги из src/
# - Создаёт симлинки в src/ на файлы из tested-files.list

# например SOURCE_BASE="../Task Cockpit/src"

set -eu

[[ -n "${SOURCE_BASE:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable SOURCE_BASE not set or empty\e[0m"  >&2 ; exit 1 ; }
[[ -d "${SOURCE_BASE}" ]] || { echo -e "\e[31m[ERROR] SOURCE_BASE: not a directory or does not exist\e[0m"  >&2 ; exit 1 ; }
[[ "${SOURCE_BASE}" == */src ]] || { echo -e "\e[31m[ERROR] SOURCE_BASE must end with /src\e[0m" >&2; exit 1; }

trap 'echo -e "\n\e[31mProcess terminated\e[0m" >&2; exit 1' TERM INT

echo -e "\e[1m[START] Preparing test environment ...\e[0m\n"

ERR=0

# ---------------------
LINK=".vscode-test"
TARGET="../.vscode-test"

if [ ! -L "$LINK" ]; then
    ln -s "$TARGET" "$LINK"
    echo -e "  \e[32mCREATED\e[0m  ${LINK}  →  ${TARGET}"
else
    echo -e "  \e[32mOK\e[0m       ${LINK}  (symlink exists)"
fi

# --------------
SENTINEL="node_modules/.package-lock.json"
NEEDS_INSTALL=false

if [ ! -d "node_modules" ] || [ ! -f "$SENTINEL" ]; then
    NEEDS_INSTALL=true
elif [ "package.json" -nt "$SENTINEL" ] || [ "package-lock.json" -nt "$SENTINEL" ]; then
    NEEDS_INSTALL=true
fi

if $NEEDS_INSTALL; then
    npm install
    echo -e "  \e[32mOK\e[0m       node_modules  (installed)"
else
    echo -e "  \e[32mOK\e[0m       node_modules  (up to date)"
fi

# ------------
find src -type l -delete
find src -mindepth 1 -depth -type d -empty -delete
echo -e "  \e[32mOK\e[0m       src  (cleaned symlinks and empty dirs)"


# ------------
LIST_FILE="tested-files.list"

if [ ! -f "$LIST_FILE" ]; then
    echo -e "  \e[33mSKIP\e[0m     ${LIST_FILE}  (not found)"
    echo -e "\n\e[1m[DONE] Completed\e[0m\n"
    exit 0
fi


# -----------------



while IFS= read -r entry || [ -n "$entry" ]; do
    [ -z "$entry" ] && continue

    source_path="$SOURCE_BASE/$entry"

    if [ -d "$source_path" ]; then
        echo -e "  \e[31mERROR\e[0m    src/${entry}  (source is a directory)" >&2
        ERR=1
        continue
    fi

    if [ ! -e "$source_path" ]; then
        echo -e "  \e[31mERROR\e[0m    src/${entry}  (source file does not exist)" >&2
        ERR=1
        continue
    fi

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
        echo -e "  \e[31mERROR\e[0m    ${link_path}  (conflicts with existing file)" >&2
        ERR=1
        continue
    fi

    link_target="${prefix}${SOURCE_BASE}/$entry"

    mkdir -p "$(dirname "$link_path")"
    ln -s "$link_target" "$link_path"
    echo -e "  \e[32mOK\e[0m       ${link_path}  →  ${link_target}"

done < "$LIST_FILE"


# ------------ update .git/info/exclude
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || true)"

if [ -n "$GIT_DIR" ]; then
    EXCLUDE_FILE="$GIT_DIR/info/exclude"

    generated=()
    # путь относительно корня репозитория
    REPO_PREFIX="$(git rev-parse --show-prefix)"


    if [ -f "$LIST_FILE" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            [ -z "$line" ] && continue
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

    echo -e "  \e[32mOK\e[0m       ${EXCLUDE_FILE}  (updated)"
fi

# ----------------------


echo -e "\n\e[1m[DONE] Completed\e[0m\n"

exit $ERR
