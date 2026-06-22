# multi-root-basic

Минимальная фикстура **multi-root workspace** с двумя папками.

## Структура

~~~
multi-root-basic/
├── multi-root-basic.code-workspace   // workspace-уровень: две папки + одна задача
├── folder1/
│   └── .vscode/
│       └── tasks.json                // три задачи
└── folder2/
    └── .vscode/
        └── tasks.json                // одна задача
~~~


## Характеристики

- Задачи на трёх уровнях: workspace, folder1, folder2
- Одна задача без иконки; три разных иконки: `zap`, `rocket`, `package`
- Иконка `zap` присутствует в двух разных источниках (workspace и folder1)
- Нет `settings` в `.code-workspace`, нет `settings.json` в подкаталогах — настройки по умолчанию


## Задачи

### workspace

| Метка               | Иконка |
|---------------------|--------|
| `task-in-workspace` | `zap`  |

### folder1

| Метка              | Иконка   |
|--------------------|----------|
| `task1-in-folder1` | —        |
| `task2-in-folder1` | `zap`    |
| `task3-in-folder1` | `rocket` |


### folder1

| Метка             | Иконка    |
|-------------------|-----------|
| `task-in-folder2` | `package` |


## Настройки

Нет, все по умолчанию.
