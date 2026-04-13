# TODO: УСТАРЕЛО
Скетчи

Скетч — это JSONC-файл, который описывает входные данные для `TreeModel` и ожидаемый результат в виде ASCII-дерева. Тест-раннер загружает скетчи, строит дерево и сравнивает его с ожидаемым `asciiTree`.

---

## Структура файла

```jsonc
// Комментарий: что проверяет этот скетч.
{
    "title": "Название · уточнение",  // отображается в списке тестов
    "sketch": { /* входные данные */ },
    "asciiTree": [ /* строки ожидаемого дерева */ ]
}
```

### `sketch`

| Поле             | Тип                    | Обязательно | Описание                                                                                                                        |
|---               |---                     |---          |---                                                                                                                              |
| `scopes`         | `Record<name, path>`   | да          | Словарь областей видимости. Ключ — имя папки (случайное, не повторяемое), значение — путь до `tasks.json` или `.code-workspace` |
| `tasks`          | `Record<name, Task[]>` | да          | Ключи должны **точно совпадать** с ключами `scopes`                                                                             |
| `treeConfig`     | объект                 | нет         | Настройки дерева (см. ниже)                                                                                                     |
| `nodeConfig`     | объект                 | нет         | Настройки узлов (см. ниже)                                                                                                      |
| `pinned`         | объект                 | нет         | Конфигурация Pinned-раздела                                                                                                     |
| `excludeFolders` | `string[]`             | нет         | Имена папок, исключённых из отображения                                                                                         |

#### `Task`

```jsonc
{
    "name": "build:release",        // Имя задачи. Обязателен, мин. 1 символ
    "hidden": false,                // Задача исключается из отображения. Необязателен, по умолч. false
    "rejectFlag": false,            // Служебный — есть определение в файле, но среда не создавала эту задачу. Необязателен, по умолч. false
    "isBackground": false,          // Необязателен, по умолч. false
    "icon": { "id": "gear", "color": "charts.red" },  // необязателен
    "group": { "kind": "Build", "isDefault": true }   // необязателен
}
```

Допустимые значения `group.kind`: `"Build"`, `"Test"`, `"Clean"`.

#### `treeConfig`
Настройки построения дерева
```jsonc
{
    "segmentSeparator": ":",   // разделитель иерархии; false — отключить
    "useGroupKind": false,     // группировать по group.kind
    "showHidden": false        // показывать скрытые задачи
}
```

#### `nodeConfig`
Настройки отображения
```jsonc
{
    "useFolderIcon": false,
    "defaultIconName": "tools",
    "tintLabel": false
}
```

#### `pinned`

```jsonc
{
    "visibility": "AUTO",            // "AUTO" | "HIDE"
    "compressionBehavior": "NORMAL", // "NORMAL" | "SMART"
    "refs": [
        { 
            "scope": "имя-папки", // Должно существовать в `scopes`
            "label": "имя-задачи" // Должно существовать в `tasks`
        }
    ],
    "stales": [
        { 
            "scopeName": "имя-папки", // произвольное
            "label": "имя-задачи"  // произвольное
        }
    ]
}
```

`refs` — живые избранные (scope и label **должны существовать** в `scopes`/`tasks`).  
`stales` — битые записи (scope или label не найдены) — рендерятся как `« ✗ ... »`.

---

## `asciiTree`

Массив строк — ожидаемый вывод `TreeModel.printTree`. 

Текст меток зависит от используемого formatter.

`simpleLabelFormatter` (используется по умолчанию):

| Тип узла                          | Формат                                  |
|---                                |---                                      |
| Pinned                            | `[★[ label ]]`                          |
| Workspace                         | `[W[ label ]]`                          |
| Папка (Folder)                    | `[F[ label ]]`                          |
| Папка в Pinned (multi-root)       | `[ label ]`                             |
| Битый избранный                   | `« ✗ label »`                           |
| Группа (Group)                    | `label`                                 |
| Задача (Runnable / RunnableGroup) | `▶ label`                               |
| Пустое состояние корневых         | `« No tasks to display in this scope »` |

Разделяющие пустые строки между деревьями тоже должны быть в массиве.

Пробелы в конце каждой строки обрезаются автоматически, поэтому паддинг до одинаковой ширины допустим, для лучшей читаемости.

---

## Именование файлов

```
NN.MM-kebab-description.jsonc
```

- `NN` — номер темы 
    - 01 = flat
    - 02 = hierarchy (segmentSeparator, useGroupKind)
    - 07 = hidden
    - 08 = multi-root особенности
    - 09 = exclude
    - 10 = pinned
    - 11 = appearance
    - 16 = empty
    - 21 = stress
- `MM` — вариант внутри темы
- Описание через дефис, строчными буквами

Примеры: `01.01-flat.jsonc`, `02.03-hierarchy-separator-edge-cases.jsonc`, `09.02-exclude-folders-workspace.jsonc`

**Баг-кейсы** именуются с префиксом `BUG.`:

```
BUG.NN.MM-short-description.jsonc
```

Пример: `BUG.10.01-pinned-fantom-segment-compressionBehavior=NORMAL.jsonc`


## Директории

- `src/test/sketches` — общая для файлов sketch.jsonc

- `src/test/sketches/structural-testing` — тесты структуры, правила построения дерева

---

## Временно отключить скетч

Добавьте `~` в начало имени файла — тест-раннер его проигнорирует:

```
~02.04-broken-wip.jsonc
```

---

## Рекомендации по написанию скетчей

### Именование scope и задач

Имена ключей в `scopes` и `tasks` должны быть короткими и описательными:
- Избегай однобуквенных имён (`a`, `b`) — они ничего не говорят о намерении
- Используй простые нейтральные имена (`scope`, `main`, `lib`), если конкретная роль папки не важна для проверки
- В именах задач сегменты-заглушки пиши как `AAA`, `BBB` и т.п. — читаемо и явно условно

Имена задач должны отражать **роль в проверяемом сценарии**, а не имитировать реальный проект:
- `test-task-1`, `build-task-1` — сразу видно, что это заглушки; конкретные имена не важны, важна их позиция в дереве
- `dev`, `watch`, `prod` — семантика реального проекта; отвлекает от сути теста

Пути в `scopes` должны быть минимальными: `app/.vscode/tasks.json` достаточно — абсолютный путь ничего не добавляет.

### Опускай поля по умолчанию

Указывай в `treeConfig` и `nodeConfig` только те поля, которые **влияют на проверяемое поведение**.
Поля с дефолтными значениями загромождают скетч и маскируют суть теста.

Если конфигурация вообще не влияет на сценарий — не включай ее.

### Документируй влияющие настройки в комментарии

Если `asciiTree` корректен только при определённых значениях настроек — укажи это явно в комментарии к файлу:

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
            "app": "/workspace/app/.vscode/tasks.json"
        },
        "tasks": {
            "app": [
                { "name": "task-1" },
                { "name": "task-in-Build-group-1", "group": { "kind": "Build" } },
                { "name": "task-in-Build-group-2", "group": { "kind": "Build" }  },
                { "name": "task-in-Test-group-1", "group": { "kind": "Test" } },
                { "name": "task-in-Test-group-2", "group": { "kind": "Test" } },
                { "name": "task-2" }
            ]
        },
        "treeConfig": { "useGroupKind": true },
        "nodeConfig": { "useFolderIcon": true }
    },
    "asciiTree": [
        "[F[ app ]]                      ",
        " ├─ ▶ task-1                    ",
        " ├─ Build                       ",
        " │  ├─ ▶ task-in-Build-group-1  ",
        " │  └─ ▶ task-in-Build-group-2  ",
        " ├─ Test                        ",
        " │  ├─ ▶ task-in-Test-group-1   ",
        " │  └─ ▶ task-in-Test-group-2   ",
        " └─ ▶ task-2                    "
    ]
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
            "scope": "scope/.vscode/tasks.json"
        },
        "tasks": {
            "scope": [
                { "name": "AAA" },
                { "name": "BBB" },
                { "name": "CCC" }
            ]
        }
    },
    "asciiTree": [
        "[F[ scope ]] ",
        " ├─ ▶ AAA  ",
        " ├─ ▶ BBB  ",
        " └─ ▶ CCC  "
    ]
}
~~~

~~~jsonc
{
    "title": "BUG phantom segment in pinned · SMART compression",
    "sketch": {
        "scopes": {
            "scope1": "scope1/.vscode/tasks.json",
            "scope2": "scope1/.vscode/tasks.json"
        },
        "tasks": {
            "scope1": [
                { "name": "aaa:bbb:ccc:ddd:task-in-ddd" },
                { "name": "aaa:bbb:ccc:task-in-ccc" }
            ],
            "scope2": [
                { "name": "aaa:bbb:ccc:task-in-ccc" },
                { "name": "aaa:bbb:ccc:ddd:task-in-ddd" }
            ]
        },
        "treeConfig": {
            "segmentSeparator": ":"
        },
        "pinned": {
            "compressionBehavior": "SMART",
            "refs": [
                // BUG: (решено) Section::buildCompressedPath
                // Без guard'а reverseAndJoin() породит фантомный пустой сегмент.
                {
                    "scope": "scope1",
                    "label": "aaa:bbb:ccc:ddd:task-in-ddd"
                },
                {
                    "scope": "scope1",
                    "label": "aaa:bbb:ccc:task-in-ccc"
                },
                // --- разный порядок, для проверки ---
                {
                    "scope": "scope2",
                    "label": "aaa:bbb:ccc:task-in-ccc"
                },
                {
                    "scope": "scope2",
                    "label": "aaa:bbb:ccc:ddd:task-in-ddd"
                }
            ]
        }
    },
    "asciiTree": [
        "[★[ Pinned ]]                  ",
        " ├─ [ scope1 ]                 ",
        " │  └─ aaa › bbb › ccc            ",
        " │     ├─ ▶ ddd › task-in-ddd  ", // BUG`а нет
        " │     └─ ▶ task-in-ccc        ",
        " └─ [ scope2 ]                 ",
        "    └─ aaa › bbb › ccc            ",
        "       ├─ ▶ task-in-ccc        ",
        "       └─ ▶ ddd › task-in-ddd  ", // BUG`а нет
        "                               ",
        "[F[ scope1 ]]                  ",
        " └─ aaa                        ",
        "    └─ bbb                     ",
        "       └─ ccc                  ",
        "          ├─ ▶ task-in-ccc     ",
        "          └─ ddd               ",
        "             └─ ▶ task-in-ddd  ",
        "                               ",
        "[F[ scope2 ]]                  ",
        " └─ aaa                        ",
        "    └─ bbb                     ",
        "       └─ ccc                  ",
        "          ├─ ▶ task-in-ccc     ",
        "          └─ ddd               ",
        "             └─ ▶ task-in-ddd  "
    ]
}
~~~

~~~jsonc
// Задача-группа: узел одновременно runnable и содержит дочерние задачи.
// Проверяет: корректное отображение задачи с данными, у которой есть потомки.
// "build" имеет и собственные данные (icon), и дочерние узлы.
// "test" — чистая группа (implicit intermediate node).
//
// Задействованные настройки: segmentSeparator=":" (иерархия по сегментам).
{
    "title": "Hierarchy · task as group",
    "sketch": {
        "scopes": {
            "app": "app/.vscode/tasks.json"
        },
        "tasks": {
            "app": [
                { "name": "test:test-task-1" }, // < обычная группировка
                { "name": "test:test-task-2" }, // <
                { "name": "test:test-task-3" }, // <
                { "name": "build-all:build-task-1" },
                { "name": "build-all:build-task-2" },
                { "name": "build-all:build-task-3" },
                { "name": "build-all", "icon": { "id": "package", "color": "terminal.ansiGreen" } }, // и задача, и группа
                { "name": "task" }
            ]
        },
        "treeConfig": { "segmentSeparator": ":" }
    },
    "asciiTree": [
        "[F[ app ]]            ",
        " ├─ test              ",
        " │  ├─ ▶ test-task-1  ",
        " │  ├─ ▶ test-task-2  ",
        " │  └─ ▶ test-task-3  ",
        " ├─ ▶ build-all       ", // и задача, и группа
        " │  ├─ ▶ build-task-1 ",
        " │  ├─ ▶ build-task-2 ",
        " │  └─ ▶ build-task-3 ",
        " └─ ▶ task            "
    ]
}
~~~