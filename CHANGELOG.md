# Changelog

# UNRELEASED

удалена настройка и функциональность useFolderIcon
bug с правильным получением списка задач когда файл User/profile/.../tasks.json имеет не сохраненные изменения в момент запуска любой задачи

### Added

- **Global Tasks view** — new view showing user-scope tasks.
- `excludeFolders` now accepts the workspace scope name (e.g. `"my-project (Workspace)"`)
  to exclude workspace-level tasks from the tree

### Changed

- When folders are excluded, the panel header now shows a visibility counter (e.g. `3/5 folders`),
  replacing the summary previously shown in the workspace item tooltip
- `excludeFolders` now takes effect in single-folder workspaces
- **Breaking:** `taskCockpit.display.useGroupKind` renamed to `taskCockpit.display.groupByTaskGroup`
- **Breaking:** `taskCockpit.validation.duplicateLabels` renamed to `taskCockpit.diagnostics.shadowedTasks`
- **Breaking:** `taskCockpit.validation.dependencies` renamed to `taskCockpit.diagnostics.unreachableDependencies`
- Various UI and UX improvements

### Removed

- `taskCockpit.filtering.excludeWorkspaceTasks` (deprecated since 1.1.0)

### Fixed

- Cursor is now placed at the start of the task definition when jumping to it


## [1.1.1] - 2026-06-15

### Added

- "Collapse All"/"Expand All" button in the Task Explorer panel (issue #6)
- "Find Task" button — quick search and filtering in the task tree (list.find)

## [1.1.0] - 2025-06-20

### Changes

- Help page now opens documentation matching the installed extension version
- `excludeWorkspaceTasks` setting is deprecated and will be removed in a future version

## [1.0.0] - 2025-02-23

### Initial public release

- Hierarchical tree view for tasks from `.vscode/tasks.json`
- Label-based hierarchy via configurable segment separator
- Grouping by `group` property (`useGroupKind`)
- Task icons with custom id/color support, color propagation to labels
- Running task status badges
- Filtering: exclude folders, workspace-scope tasks, individual tasks (`hide`)
- Context menu: run, abort, show terminal, jump to definition
- Open or create task files from panel
- Validation: duplicate label detection
- Validation: missing `dependsOn` references (experimental)
- Markdown tooltips via `detail` field
- Keyboard shortcut support: commands operate on the selected tree item
- Task order preserved from file definition (no automatic sorting)
