#!/usr/bin/env bash

# Подготавливает package.json для публикации: удаляет dev-поля,
# проставляет версию из git-тега, подставляет список иконок codicons,
# убирает DEBUG-команды и нормализует пути иконок.
#
# Переменные окружения:
#   DEST_DIR — целевая директория для выходного package.json (обязательна)

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

[[ -n "${DEST_DIR:-}" ]] || { echo -e "\e[31m[ERROR] Environment variable DEST_DIR not set or empty\e[0m" >&2 ; exit 1 ; }
[[ -d "${DEST_DIR}" ]] || { echo -e "\e[31m[ERROR] DEST_DIR: not a directory or does not exist\e[0m" >&2 ; exit 1 ; }
readonly DEST_DIR

echo -e "\e[1m[PKG] Preparing package.json ...\e[0m\n" >&2

CODICONS_MAP_JSON='node_modules/@vscode/codicons/src/template/mapping.json' && readonly CODICONS_MAP_JSON

# Версия из последнего git тега (Vn.n.n -> n.n.n)
VERSION=$(git tag -l 'v[0-9]*' --sort=-committerdate | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1 | sed 's/^v//') && readonly VERSION
[[ -z "${VERSION}" ]] && { echo -e "\e[31m[ERROR] No version tag found (expected vn.n.n format)\e[0m" >&2 ; exit 1 ; }

# Иконки из mapping.json: извлекаем все имена из всех массивов,
# убираем дубликаты,
# исключаем folder
# и сортируем
ICONS=$(jq '[.[] | .[]] | unique - ["folder", "dash"]' "${CODICONS_MAP_JSON}") && readonly ICONS
ICONS_COUNT=$(echo "${ICONS}" | jq 'length') && readonly ICONS_COUNT

jq --arg ver "${VERSION}" --argjson icons "${ICONS}" '
  del(.scripts, .devDependencies) |
  .main = "extension.js" |
  .version = $ver |
  (.contributes.commands) |= map(select(.command | startswith("task-cockpit.DEBUG") | not)) |
  (.contributes.menus."view/item/context") |= map(select(.command | startswith("task-cockpit.DEBUG") | not)) |
  (.contributes.configuration[] | select(.title == "Display") | .properties["taskCockpit.display.defaultIconName"].enum) = $icons |
  (.contributes.configuration[] | select(.title == "Display") | .properties["taskCockpit.display.defaultIconName"].markdownEnumDescriptions) = ($icons | map("$(\(.))")) |
  walk(if type == "object" and (.icon | type) == "string" then .icon |= sub("^icons/"; "") else . end)
' package.json > "${DEST_DIR}/package.json"

echo ' - removed: .scripts, .devDependencies'
echo ' - set .main: "extension.js"'
echo " - set .version: \"${VERSION}\""
echo ' - removed: commands "task-cockpit.DEBUG*"'
echo ' - removed: context menus "task-cockpit.DEBUG*"'
echo " - set .contributes.configuration[Display].properties[\"taskCockpit.display.defaultIconName\"].enum: ${ICONS_COUNT} icon names"
echo ' - added icon preview descriptions'
echo ' - normalized .icon fields: removed "icons/" prefix'

echo -e "\n\e[32;1m[DONE] Saved at \"${DEST_DIR}/package.json\"\e[0m\n" >&2