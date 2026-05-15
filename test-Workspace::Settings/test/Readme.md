Тесты TaskIndex.fetch:

- Отмена до вызова(isCancellationRequested === true на входе) → CancellationError, fetchTasks не дёргается

- Отмена между await fetchTasks() и циклом индексации → CancellationError(через свой CancellationTokenSource, отмена в микротаске после резолва)

- Workspace без tasks.json и без провайдерских задач → пустой индекс;

- Single - folder с валидными задачами → индекс правильного размера, ID построены на базе<folder> /.vscode / tasks.json;

- Multi - root.code - workspace с folder - level и workspace - level задачами → в индексе оба типа ID сосуществуют

- Untrusted workspace → пустой индекс без исключений(на основе tasks() в abstractTaskService: нет trust → return [])

- Синтаксически битый tasks.json → не падает, возвращает частичный результат(contributed tasks, по catch в _getGroupedTasks)

- Коллизия ID: две задачи, дающие одинаковый resolveId → побеждает последняя(зафиксировать текущую молчаливую перезапись);