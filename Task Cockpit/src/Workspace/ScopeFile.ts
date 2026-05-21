/** @file Workspace/ScopeFile.ts */
/** @module ScopeFile */

declare const ___ScopeFile: unique symbol;

/** Номинальный тип для fsPath файла задач.
 *
 * Используется как ключ в `Map` для привязки настроек к конкретному файлу.
 * Обязательная часть "пути к задаче".
 *
 * Является строковым URI к файлу задач в области действия
 * задачи.
 *
 * Позволяет установить связь "задача в этой области действия" и "конфигурация
 * для этой области действия".
 *
 * Это просто идентификатор, позволяющий однозначно определить путь к задаче.
 * Физической связи scopeTasksFile->файл_в_наличии нет.
 *
 * Используется для type safety при работе с коллекциями.
 *  */
type ScopeFile = string & { readonly [___ScopeFile]: never; };

const ScopeFile = {

    getJSONPath(scopeFile: ScopeFile): ReadonlyArray<string> {
        if (scopeFile.endsWith('.code-workspace')) {
            return ['tasks', 'tasks'];
        }

        return ['tasks'];
    }

} as const;

export default ScopeFile;
