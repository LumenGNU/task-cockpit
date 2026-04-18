#!/usr/bin/env bash

# Скрипт сканирует test-fixtures/, и для каждой поддиректории создаёт launch-конфигурацию.
# Это избавляет от ручного редактирования launch.json при добавлении/удалении тестовых фикстур.

set -eu

trap 'echo -e "\n\e[31mProcess terminated\e[0m\n" >&2 ; exit 1' TERM INT

FIXTURES_DIR='test-fixtures' && readonly FIXTURES_DIR
LAUNCH_FILE='.vscode/launch.json' && readonly LAUNCH_FILE

echo -e "\e[1m[DEV] Generate launch.json ...\e[0m\n" >&2

# Базовая конфигурация
base_config='[{
    "name": "Run Extension",
    "type": "extensionHost",
    "request": "launch",
    "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--profile=Clean",
        "--locale=en"
    ],
    "outFiles": ["${workspaceFolder}/~out/**/*.js"],
    "preLaunchTask": "${defaultBuildTask}",
    "env": {
        "USER_TASK_DEBUG": "true",
        "USER_TASK_CONSOLE_LOG": "true"
    }
}]'

# Собираем фикстуры: has_workspace = true если есть {name}.code-workspace
fixtures='[]'
for dir in $(git ls-files --cached --others --exclude-standard "$FIXTURES_DIR/" | grep -oP "^$FIXTURES_DIR/[^/]+" | sort -u); do
    name=$(basename "$dir")
    has_ws=$([[ -f "$dir/$name.code-workspace" ]] && echo true || echo false)
    fixtures=$(echo "$fixtures" | jq --arg n "$name" --argjson ws "$has_ws" '. + [{name: $n, has_workspace: $ws}]')
done

jq -n --argjson base "$base_config" --argjson fixtures "$fixtures" '
{
    version: "0.2.0",
    configurations: ($base + ($fixtures | map(
        (if .has_workspace then "\(.name)/\(.name).code-workspace" else .name end) as $target |
        {
            name: "Run Extension (\(.name))",
            type: "extensionHost",
            request: "launch",
            args: [
                "${workspaceFolder}/test-fixtures/\($target)",
                "--extensionDevelopmentPath=${workspaceFolder}",
                "--profile=Clean",
                "--locale=en"
            ],
            cwd: "${workspaceFolder}/test-fixtures/\(.name)",
            outFiles: ["${workspaceFolder}/~out/**/*.js"],
            env: {
                "USER_TASK_DEBUG": "true",
                "USER_TASK_CONSOLE_LOG": "true"
            },
            preLaunchTask: "${defaultBuildTask}"
        }
    )))
}' > "$LAUNCH_FILE"

echo -e "\n\e[32;1m[DONE] Generated: $(jq '.configurations | length' "$LAUNCH_FILE") configs\e[0m\n" >&2