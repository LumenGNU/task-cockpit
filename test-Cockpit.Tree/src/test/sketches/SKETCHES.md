# Скетчи

Скетч — это JSONC-файл, который описывает входные данные для `TreeModel` и ожидаемый результат рендеринга. Тест-раннер загружает скетчи, строит дерево и сравнивает его с `expectedRender.snapshot`.

---

## Структура файла

~~~jsonc
// Комментарий: что проверяет этот скетч.
{
    "title": "Название · уточнение",   // отображается в списке тестов
    "sketch": { /* входные данные */ },
    "expectedRender": {
        "formatter": "simple",         // имя форматтера
        "snapshot": [ /* строки ожидаемого дерева */ ]
    }
}
~~~

### `sketch`

| Поле             | Тип                        | Обязательно | Описание                                                            |
|---               |---                         |---          |---                                                                  |
| `scopes`         | `Record<name, scopeEntry>` | да          | Словарь областей видимости (мин. 1 запись). Ключ — имя папки       |
| `pinned`         | объект                     | нет         | Глобальная конфигурация Pinned-раздела                              |
| `treeConfig`     | объект                     | нет         | Настройки дерева (см. ниже)                                         |
| `nodeConfig`     | объект                     | нет         | Настройки узлов (см. ниже)                                          |
| `excludeFolders` | `string[]`                 | нет         | Имена папок, исключённых из отображения                             |

#### `scopeEntry`

| Поле        | Тип        | Обязательно | Описание                                                                        |
|---          |---         |---          |---                                                                              |
| `tasksFile` | `string`   | да          | Путь до `tasks.json` или `.code-workspace`. Уникален среди всех scopes          |
| `tasks`     | `Task[]`   | да          | Список задач                                                                    |
| `pinned`    | `string[]` | нет         | Имена задач (из `tasks`), добавляемых в Pinned-раздел. По умолч. `[]`          |

#### `Task`

~~~jsonc
{
    "name": "build:release",        // Имя задачи. Обязателен, мин. 1 символ
    "hidden": false,                // Задача исключается из отображения. По умолч. false
    "rejectFlag": false,            // Служебный — задача создана не средой. По умолч. false
    "isBackground": false,          // По умолч. false
    "icon": { "id": "gear", "color": "charts.red" },  // необязателен
    "group": { "kind": "Build", "isDefault": true }   // необязателен
}
~~~

Допустимые значения `group.kind`: `"Build"`, `"Test"`, `"Clean"`.

#### `treeConfig`

~~~jsonc
{
    "segmentSeparator": ":",   // разделитель иерархии; false — отключить
    "useGroupKind": false,     // группировать по group.kind
    "showHidden": false        // показывать скрытые задачи
}
~~~

#### `nodeConfig`

~~~jsonc
{
    "useFolderIcon": false,
    "defaultIconName": "tools",
    "tintLabel": false
}
~~~

#### `pinned` (глобальный)

~~~jsonc
{
    "visibility": "AUTO",            // "AUTO" | "HIDE"
    "compressionBehavior": "NORMAL", // "NORMAL" | "SMART"
    "stales": [
        {
            "scopeName": "имя-папки", // произвольное
            "label": "имя-задачи"     // произвольное
        }
    ]
}
~~~

`stales` — битые записи (scope или label не найдены).

---

## `expectedRender`

~~~jsonc
{
    "formatter": "simple",   // "simple" | "icon" | "description"
    "snapshot": [            // строки ожидаемого вывода
        "━[F[ scope ]] ",
        "  ├─ ▶ AAA    "
    ]
}
~~~

### Форматтеры

Все форматтеры используют одинаковые правила для корневых и структурных узлов:

| Тип узла                          | Формат          |
|---                                |---              |
| Pinned                            | `[★[ label ]]`  |
| Workspace                         | `[W[ label ]]`  |
| Папка (Folder)                    | `[F[ label ]]`  |
| Папка в Pinned (multi-root)       | `[ label ]`     |
| Битый избранный                   | `« ✗ label »`   |
| Пустое состояние                  | `« label »`     |

Отличия между форматтерами касаются узлов **Group** и **Runnable / RunnableGroup**:

| Форматтер     | Group                 | Runnable / RunnableGroup    |
|---            |---                    |---                          |
| `simple`      | `label`               | `▶ label`                   |
| `icon`        | `label · $(id~color)` | `▶ label · $(id~color)`     |
| `description` | `label · desc`        | `▶ label · desc`            |

В `icon`: если цвет не задан — `$(id)`. В `description`: суффикс добавляется только если `description` непустой.

### Отступы

Каждое дерево начинается с корневого узла, перед которым стоит `━`. Первый уровень дочерних узлов — 2 пробела + символ ветки:

~~~
━[F[ scope ]]
  ├─ ▶ AAA
  ├─ ▶ BBB
  └─ ▶ CCC
~~~

Разделяющие пустые строки между деревьями тоже должны быть в массиве.

Пробелы в конце каждой строки обрезаются автоматически, поэтому паддинг до одинаковой ширины допустим для лучшей читаемости.

---

## Именование файлов

`kebab-description.jsonc`

- Строчные буквы, слова через дефис
- Тема определяется подпапкой
- Для группировки связанных вариантов используй общий префикс:
  `deep-paths-normal.jsonc`, `deep-paths-smart.jsonc`

Примеры: `flat.jsonc`, `separator-edge-cases.jsonc`, `basic-auto.jsonc`

**Баг-кейсы** размещаются в подпапке `bugs/` соответствующей темы.

Пример: `pinned/bugs/phantom-segment-normal.jsonc`


## Директории

~~~
src/test/sketches/
  01-structural/
    flat/
    hierarchy/
    hidden/
    multi-root/
    exclude-folders/
    pinned/
      bugs/
    empty-states/
  02-appearance/
    description-flags/
    icon-and-color/
  03-stress/
  ...
  и т.д
~~~

Числовые префиксы папок определяют порядок выполнения тестов, там где это нужно.

---

## Временно отключить скетч

Добавьте `~` в начало имени файла — тест-раннер его проигнорирует:

`~02.04-broken-wip.jsonc`

---

## Рекомендации по написанию скетчей

### Именование scope и задач

Имена ключей в `scopes` должны быть короткими и описательными:
- Избегай однобуквенных имён (`a`, `b`) — они ничего не говорят о намерении
- Используй простые нейтральные имена (`scope`, `main`, `lib`), если конкретная роль папки не важна для проверки
- В именах задач сегменты-заглушки пиши как `AAA`, `BBB` и т.п. — читаемо и явно условно

Имена задач должны отражать **роль в проверяемом сценарии**, а не имитировать реальный проект:
- `test-task-1`, `build-task-1` — сразу видно, что это заглушки; конкретные имена не важны, важна их позиция в дереве
- `dev`, `watch`, `prod` — семантика реального проекта; отвлекает от сути теста

Пути в `tasksFile` должны быть минимальными: `app/.vscode/tasks.json` достаточно — абсолютный путь ничего не добавляет.

### Опускай поля по умолчанию

Указывай в `treeConfig` и `nodeConfig` только те поля, которые **влияют на проверяемое поведение**.
Поля с дефолтными значениями загромождают скетч и маскируют суть теста.

Если конфигурация вообще не влияет на сценарий — не включай её.

### Документируй влияющие настройки в комментарии

Если `snapshot` корректен только при определённых значениях настроек — укажи это явно в комментарии к файлу:

~~~jsonc
// Задействованные настройки: segmentSeparator=":" (иерархия по сегментам),
//                            showHidden=true (скрытые задачи показываются).
~~~

Это помогает понять, почему дерево выглядит именно так, без запуска тестов.

### Терминология

Используй «pinned» / «Pinned» вместо «favorites» / «избранные» — и в комментариях, и в `title`.

---

## Примеры

~~~jsonc
// Группировка по свойству group (useGroupKind=true, segmentSeparator отключён).
// Проверяет: создание group-папок, имени группы,
// задачи без group остаются на верхнем уровне,
// порядок не ломается.
{
    "title": "Group kind · basic grouping",
    "sketch": {
        "scopes": {
            "app": {
                "tasksFile": "app/.vscode/tasks.json",
                "tasks": [
                    { "name": "task-1" },
                    { "name": "task-in-Build-group-1", "group": { "kind": "Build" } },
                    { "name": "task-in-Build-group-2", "group": { "kind": "Build" } },
                    { "name": "task-in-Test-group-1",  "group": { "kind": "Test" } },
                    { "name": "task-in-Test-group-2",  "group": { "kind": "Test" } },
                    { "name": "task-2" }
                ]
            }
        },
        "treeConfig": { "useGroupKind": true },
        "nodeConfig": { "useFolderIcon": true }
    },
    "expectedRender": {
        "formatter": "simple",
        "snapshot": [
            "━[F[ app ]]                        ",
            "  ├─ ▶ task-1                      ",
            "  ├─ Build                         ",
            "  │  ├─ ▶ task-in-Build-group-1    ",
            "  │  └─ ▶ task-in-Build-group-2    ",
            "  ├─ Test                          ",
            "  │  ├─ ▶ task-in-Test-group-1     ",
            "  │  └─ ▶ task-in-Test-group-2     ",
            "  └─ ▶ task-2                      "
        ]
    }
}
~~~

~~~jsonc
// Плоский список без иерархии.
// Базовый случай: все задачи на одном уровне, separator отключён.
// Проверяет: сохранение порядка из файла, рендеринг без вложенности.
{
    "title": "basic · flat",
    "sketch": {
        "scopes": {
            "scope": {
                "tasksFile": "scope/.vscode/tasks.json",
                "tasks": [
                    { "name": "AAA" },
                    { "name": "BBB" },
                    { "name": "CCC" }
                ]
            }
        }
    },
    "expectedRender": {
        "formatter": "simple",
        "snapshot": [
            "━[F[ scope ]] ",
            "  ├─ ▶ AAA    ",
            "  ├─ ▶ BBB    ",
            "  └─ ▶ CCC    "
        ]
    }
}
~~~

~~~jsonc
// BUG: (решено) Section::buildCompressedPath
// Без guard'а reverseAndJoin() породит фантомный пустой сегмент.
// Проверяет: SMART-компрессия без артефактов; разный порядок pinned в двух scopes.
//
// Задействованные настройки: segmentSeparator=":", compressionBehavior="SMART".
{
    "title": "BUG phantom segment in pinned · SMART compression",
    "sketch": {
        "scopes": {
            "scope1": {
                "tasksFile": "scope1/.vscode/tasks.json",
                "tasks": [
                    { "name": "aaa:bbb:ccc:ddd:task-in-ddd" },
                    { "name": "aaa:bbb:ccc:task-in-ccc" }
                ],
                "pinned": [
                    "aaa:bbb:ccc:ddd:task-in-ddd",
                    "aaa:bbb:ccc:task-in-ccc"
                ]
            },
            // --- разный порядок, для проверки ---
            "scope2": {
                "tasksFile": "scope2/.vscode/tasks.json",
                "tasks": [
                    { "name": "aaa:bbb:ccc:task-in-ccc" },
                    { "name": "aaa:bbb:ccc:ddd:task-in-ddd" }
                ],
                "pinned": [
                    "aaa:bbb:ccc:task-in-ccc",
                    "aaa:bbb:ccc:ddd:task-in-ddd"
                ]
            }
        },
        "treeConfig": { "segmentSeparator": ":" },
        "pinned": { "compressionBehavior": "SMART" }
    },
    "expectedRender": {
        "formatter": "simple",
        "snapshot": [
            "━[★[ Pinned ]]                     ",
            "  ├─ [ scope1 ]                    ",
            "  │  └─ aaa › bbb › ccc            ",
            "  │     ├─ ▶ ddd › task-in-ddd     ", // BUG`а нет
            "  │     └─ ▶ task-in-ccc           ",
            "  └─ [ scope2 ]                    ",
            "     └─ aaa › bbb › ccc            ",
            "        ├─ ▶ task-in-ccc           ",
            "        └─ ▶ ddd › task-in-ddd     ", // BUG`а нет
            "                                   ",
            "━[F[ scope1 ]]                     ",
            "  └─ aaa                           ",
            "     └─ bbb                        ",
            "        └─ ccc                     ",
            "           ├─ ▶ task-in-ccc        ",
            "           └─ ddd                  ",
            "              └─ ▶ task-in-ddd     ",
            "                                   ",
            "━[F[ scope2 ]]                     ",
            "  └─ aaa                           ",
            "     └─ bbb                        ",
            "        └─ ccc                     ",
            "           ├─ ▶ task-in-ccc        ",
            "           └─ ddd                  ",
            "              └─ ▶ task-in-ddd     "
        ]
    }
}
~~~

~~~jsonc
// Задача-группа: узел одновременно runnable и содержит дочерние задачи.
// Проверяет: корректное отображение задачи с данными, у которой есть потомки.
// "build-all" имеет и собственные данные (icon), и дочерние узлы.
// "test" — чистая группа (implicit intermediate node).
//
// Задействованные настройки: segmentSeparator=":" (иерархия по сегментам).
{
    "title": "Hierarchy · task as group",
    "sketch": {
        "scopes": {
            "app": {
                "tasksFile": "app/.vscode/tasks.json",
                "tasks": [
                    { "name": "test:test-task-1" },
                    { "name": "test:test-task-2" },
                    { "name": "test:test-task-3" },
                    { "name": "build-all:build-task-1" },
                    { "name": "build-all:build-task-2" },
                    { "name": "build-all:build-task-3" },
                    { "name": "build-all", "icon": { "id": "package", "color": "terminal.ansiGreen" } }, // и задача, и группа
                    { "name": "task" }
                ]
            }
        },
        "treeConfig": { "segmentSeparator": ":" }
    },
    "expectedRender": {
        "formatter": "simple",
        "snapshot": [
            "━[F[ app ]]             ",
            "  ├─ test               ",
            "  │  ├─ ▶ test-task-1   ",
            "  │  ├─ ▶ test-task-2   ",
            "  │  └─ ▶ test-task-3   ",
            "  ├─ ▶ build-all        ", // и задача, и группа
            "  │  ├─ ▶ build-task-1  ",
            "  │  ├─ ▶ build-task-2  ",
            "  │  └─ ▶ build-task-3  ",
            "  └─ ▶ task             "
        ]
    }
}
~~~