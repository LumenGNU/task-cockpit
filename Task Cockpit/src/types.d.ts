import type * as vscode from 'vscode';


// -- Символы брендирования -----------------------------------

declare const ___TasksFile: unique symbol;
declare const ___TasksFileUri: unique symbol;

declare const ___TasksGroup: unique symbol;

declare const ___ProcessId: unique symbol;
declare const ___QueryComponent: unique symbol;

declare const ___TaskName: unique symbol;

declare const ___TaskId: unique symbol;

declare const ___FolderKey: unique symbol;


declare const ___FolderName: unique symbol;
declare const ___FolderIndex: unique symbol;
declare const ___FolderUri: unique symbol;



// /** Символ-разделитель компонентов составных идентификаторов (Group Separator, U+001D). */
// type ___Group_Separator = '\x1D#\x1D';


// -- Брендированные примитивы ---------------------------------

/** Номинальный тип для имени задачи.
 *
 * Используется для type safety при работе с коллекциями. */
export type TaskName = string & { readonly [___TaskName]: never; };


// export type Unit_Separator = '\x1F;\x1F';

/** @todo */
type QueryComponent = string & { readonly [___QueryComponent]: never; };

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
export type ScopeFile = string & { readonly [___TasksFile]: never; };

/** Брендированный URI файла задач.
 *
 * Гарантирует, что `fsPath` возвращает {@linkcode ScopeFile}.
 *
 * НЕ обязан существовать физически */
export type SourceUri = vscode.Uri & {
    readonly [___TasksFileUri]: never;
    fsPath: ScopeFile;
};


/** Строковое представление {@link vscode.Uri.toString | folder URI}.
 * Служит ключом сериализации для folder-scoped задач. */
export type FolderKey = string & {
    readonly [___FolderKey]: never;
};


export type WorkspaceKey = '\x00\x00$Workspace';


/** Сериализованный ключ scope в {@linkcode PinnedStorage}.
 *
 * - Folder-scope — строковое представление {@linkcode Scope.Folder.Uri};
 *   в `.code-workspace`. (имена папок могут совпадать, URI их различает)
 * - Workspace-scope — строковое представление {@linkcode vscode.TaskScope.Workspace}. */
export type ScopeKey =
    | FolderKey
    | WorkspaceKey;


/** Номинальный тип для имени папки workspace. */
export type FolderName = string & { readonly [___FolderName]: never; };


/** Позиция папки в массиве {@linkcode vscode.workspace.workspaceFolders}.
 * Различает папки с одинаковым именем в multi-root workspace. */
export type FolderIndex = number & { readonly [___FolderIndex]: never; };


/** URI папки workspace.
 *
 * Переопределяет {@linkcode vscode.Uri.toString} — возвращает {@linkcode Key},
 * что позволяет использовать URI напрямую как ключ сериализации. */
export type FolderUri = Omit<vscode.Uri, 'toString'> & {
    readonly [___FolderUri]: never;
    toString(): FolderKey;
};


/** Строковый идентификатор задачи, уникальный в пределах
 * текущего снимка рабочей области.
 *
 * Взаимно связывает {@link _EligibleTask | объект-задачу VS Code, прошедшую фильтр }
 * с соответствующим {@link _Definition | определением задачи, полученным из файла задач}.
 *
 * Формат: `{scopePrefix}{GroupSeparator}{taskName}`, где
 * - `scopePrefix` — либо {@linkcode WorkspaceKey} для глобального workspace,
 *   либо строковое представление URI папки ({@linkcode FolderKey}) для задачи из конкретной папки;
 * - `taskName` — непустое {@link TaskName имя задачи}.
 */
export type TaskId = `${ScopeKey}${GroupSeparator}${TaskName}`;



/** Номинальный тип для группы задачи (Build | Test | Clean). */
export type Group = ('Build' | 'Test' | 'Clean') & { readonly [___TasksGroup]: never; };







/** Номинальный тип для идентификатора системного процесса. */
export type ProcessId = number & { readonly [___ProcessId]: never; };




export interface Icon {
    /** Идентификатор иконки */
    id?: string,
    /** Цвет иконки */
    color?: string;
}


export interface TasksSource {
    sourceUri: SourceUri;
    JSONPath: ReadonlyArray<string>;
}



export interface TaskGroup {
    /** Капитализированное имя группы */
    kind: Group;
    isDefault: boolean;
}



/** Снимок состояния открытых терминалов в момент времени. */
export interface TerminalsSnapshot {
    timestamp: number,
    processIds: ReadonlySet<ProcessId>;
}

/** Детализация состояния процессов задачи. */
export type RuntimeState = ReadonlyMap<ProcessId, Readonly<ProcessInfo>>;

/** @todo */
export interface ProcessInfo {
    running: boolean,
    timestamp: number;
}






/** Визуальные метаданные узла дерева, используемые при рендеринге. */
export interface VisualMetadata {
    color?: string | undefined,
    processes?: number,
    running?: number;
    special?: 'EMPTY' | 'BROKEN';
}

/** Адрес узла дерева. Определяет его тип (authority) и положение (path). */
export interface NodeURI {
    //
    readonly authority: 'Folder' | 'Workspace' | 'Favorites' | 'Runnable' | 'Marker' | 'Group';
    readonly path: string;
    readonly fragment?: string;
}

/** Перечисление типов узлов дерева. */
export declare const enum EntityKind {
    Folder = 1 << 0,
    PinnedFolder = 1 << 1,
    Workspace = 1 << 2,
    PinnedSingle = 1 << 3,
    PinnedMulti = 1 << 4,
    PinnedStaleOnly = 1 << 5,
    BrokenPinned = 1 << 6,
    Empty = 1 << 7,
    Runnable = 1 << 8,
    Group = 1 << 9,
    RunnableGroup = Runnable | Group,
}


// -- Утилитарные типы -------------------------------------

/** Рекурсивно применяет `Readonly` ко всей структуре:
 * `Map` → `ReadonlyMap`, `Set` → `ReadonlySet`, массивы → `ReadonlyArray`,
 * объекты — все поля помечаются `readonly`. Примитивы возвращаются без изменений. */
export type DeepReadonly<T> =
    T extends string ? T :
    T extends number ? T :
    T extends boolean ? T :
    T extends Map<infer K, infer V> ? ReadonlyMap<K, DeepReadonly<V>> :
    T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>> :
    T extends (infer U)[] ? ReadonlyArray<DeepReadonly<U>> :
    T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } :
    T;



export interface TaskSource {
    uri: SourceUri;
    JSONPath: readonly string[];
}


export type GroupSeparator = '\u001D#\u001D';
export type ConfigSectionName = 'taskCockpit';
export type DisplaySeparator = ' • ';
