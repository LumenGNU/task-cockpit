#!/usr/bin/env bash
# Запускает ESLint

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

die() {
    echo -e "\e[31m[ERROR] $*\e[0m" >&2
    exit 1
}

warn() {
    echo -e "\e[33m[WARN] $*\e[0m" >&2
}


lin() {
    npx eslint --max-warnings 0 -- $* || {
        cr=$?
        echo -e "\n\e[31;1m[FAIL] Completed\e[0m\n" >&2
        exit $cr
    }
}

REPO_ROOT="$(git rev-parse --show-toplevel 2> /dev/null)" ||
    die "Not inside a git repository"
readonly REPO_ROOT

lint_files=()
while IFS= read -r rel; do

    abs="${REPO_ROOT}/${rel}"

    # Если это симлинк — пропускаем и уведомляем
    if [[ -L "${abs}" ]]; then
        warn "Skipping symlink: ${rel}"
        continue
    fi

    # Проверяем, что это обычный файл (на случай странных и "уже удаленных" файлов в git)
    if [[ -f "${abs}" ]] ; then
        lint_files+=("${abs}")
    else
        warn "Skipping non-file: ${rel}"
        continue
    fi

    lint_files+=("${abs}")

done < <(
    git -C "${REPO_ROOT}" ls-files --cached --others --exclude-standard -- |
        grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' |
        sort
)


npx eslint --max-warnings 0 -- "${lint_files[@]}" ||
    {
        cr=$?
        echo -e "\n\e[31;1m[FAIL] Completed\e[0m\n" >&2
        exit $cr
    }

echo -e "\n\e[32;1m[DONE] Completed\e[0m\n" >&2
