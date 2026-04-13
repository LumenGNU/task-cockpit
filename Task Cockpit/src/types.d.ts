import type * as vscode from 'vscode';


// -- Символы брендирования -----------------------------------

declare const ___TasksFile: unique symbol;
declare const ___TasksFileUri: unique symbol;
declare const ___TaskLabel: unique symbol;
declare const ___TasksGroup: unique symbol;
declare const ___Identity: unique symbol;
declare const ___ProcessId: unique symbol;
declare const ___QueryComponent: unique symbol;
declare const ___FolderName: unique symbol;


// -- Брендированные примитивы ---------------------------------

/** Символ-разделитель компонентов составных идентификаторов (Group Separator, U+001D). */
export type CG_Separator = '\x1D';

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
export type File = string & { readonly [___TasksFile]: never; };

/** Брендированный URI файла задач.
 *
 * Гарантирует, что `fsPath` возвращает {@linkcode File}. */
export type Uri = vscode.Uri & {
    readonly [___TasksFileUri]: never;
    fsPath: File;
};

/** Номинальный тип для имени задачи.
 *
 * Используется для type safety при работе с коллекциями. */
export type Name = string & { readonly [___TaskLabel]: never; };

/** Номинальный тип для группы задачи (Build | Test | Clean). */
export type Group = ('Build' | 'Test' | 'Clean') & { readonly [___TasksGroup]: never; };

/** Строковой идентификатор задачи, в терминах расширения {@linkcode File} + {@linkcode Name}.
 *
 * Номинальный тип для идентификатора задачи.
 *
 * Используется для type safety при работе с коллекциями;
 * для однозначного определения задачи; */
export type TaskID = `${File}${CG_Separator}${Name}` & { readonly [___Identity]: never; };

/** Номинальный тип для имени папки workspace. */
export type FolderName = string & { readonly [___FolderName]: never; };

/** Номинальный тип для идентификатора системного процесса. */
export type ProcessId = number & { readonly [___ProcessId]: never; };


// -- Настройки -------------------------------------------

/** Настройки уровня окна — общие для всего workspace, не зависят от scope. */
export interface WindowSettings { // @todo имя не подходит
    /** Имена папок workspace, исключённых из отображения. */
    readonly excludeFolders: string[];
    // /** Скрывать ли задачи, определённые на уровне workspace (`.code-workspace`). */
    // readonly excludeWorkspaceTasks: boolean;
    // /** Настройки валидации задач. */
    // readonly validationSettings: ValidationSettings; // @todo не должно быть тут
}

/** Параметры, определяющие структуру ветки дерева для scope. */
export interface TreeConfig {
    /** Символ-разделитель для разбиения label на сегменты иерархии.
     * `false` — иерархия отключена. */
    readonly segmentSeparator: string | false;
    /** Группировать ли задачи по свойству `group`. */
    readonly useGroupKind: boolean;
    /** Показывать ли задачи с `hide: true`. */
    readonly showHidden: boolean;
}

/** @todo */
export type TreeConfigByFile = Map<File, TreeConfig>;

/** Параметры, определяющие визуальное отображение элементов дерева. */
export interface NodeConfig {
    /** Показывать ли иконку папки для промежуточных (intermediate) узлов. */
    readonly useFolderIcon: boolean;
    /** Имя иконки по умолчанию для задач без кастомной иконки. */
    readonly defaultIconName: string;
    /** Окрашивать ли label задачи в цвет её иконки. */
    readonly tintLabel: boolean;
}

/** @todo */
export type NodeConfigByFile = Map<File, NodeConfig>;

/** Настройки диагностики задач. */
export interface ValidationSettings {
    /** Обнаруживать задачи с дублирующимися label. */
    readonly duplicateLabels: boolean;
    /** Обнаруживать отсутствующие ссылки в `dependsOn`. */
    readonly dependencies: boolean;
}

/** @todo */
export interface RuntimeSettings {
    pollingCap: number,
    terminalTimeout: number;
}


// -- Задачи ---------------------------------------------

/** Область действия задач, с именем и URI файла, в котором они определены (источником задач).
 *
 * Resource settings читаются для scope, а не наоборот:
 * scope — первичная сущность, настройки вторичны. */
export interface Scope {
    readonly name: FolderName;
    readonly uri: Readonly<Uri>;
}

/** Пользовательская иконка для задачи. */
export interface IconDefinition {
    /** Идентификатор иконки */
    id?: string,
    /** Цвет иконки */
    color?: string;
}

/** Описание задачи.
 *
 * Описывает пользовательские поля задачи, которые не
 * предоставляются через API vscode.Task. */
export interface TaskDefinition {
    /** Флаг скрытия задачи из палитры задач */
    hidden: boolean | undefined;
    /** Пользовательская иконка для задачи */
    icon: IconDefinition;

    id: TaskID;

    rejectFlag?: boolean;

    isBackground?: boolean;

    group?: {
        /** Капитализированное имя группы */
        kind: Group;
        isDefault: boolean;
    };
}

/** Задачи в рамках одного scope, индексированные по имени. */
export type ScopedTasks = Map<Name, vscode.Task>;

/** Задачи всех scopes, индексированные по файлу. */
export type TasksByFile = Map<File, ScopedTasks>;

/** Определения задач в рамках одного scope, индексированные по имени. */
export type ScopedDefinitions = Map<Name, TaskDefinition>;

/** Определения задач всех scopes, индексированные по файлу. */
export type DefinitionsByFile = Map<File, ScopedDefinitions>;

// export type SettingsByFile = Map<File, ScopedSettings>;

// export type RejectReport = Map<File, number>;

/** Результат загрузки задач из всех scopes. */
export interface FetchResult {
    readonly tasksByFile: Readonly<TasksByFile>,
    readonly definitionsByFile: Readonly<DefinitionsByFile>,
    // readonly rejectReport: Readonly<RejectReport>;
}


// -- Runtime / процессы -------------------------------------

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


// -- Узлы дерева -----------------------------------------

/** Детализация количества workspace-scope. */
export interface WorkspaceDetail {
    /** Общее количество workspace-scopes. */
    total: number;
    /** Количество отображаемых workspace-scopes. */
    displayed: number;
}

/** @todo */
declare const MarkerType: {
    readonly EMPTY: 'EMPTY';
};
export type MarkerType = typeof MarkerType[keyof typeof MarkerType];

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


// -- Избранное (Pinned) -------------------------------------

/** Ссылка на закреплённую задачу: scope + имя задачи. */
export interface FavoriteRef {
    scope: Scope;
    label: Name;
}

/** Устаревшая запись закреплённой задачи, scope которой больше не существует. */
export interface PinnedStale {
    scopeName: string;
    label: string;
}

/** Режим видимости раздела закреплённых задач. */
export declare const enum PinnedVisibility {
    AUTO = 1,
    HIDE = 0
}

/** Поведение сжатия (компрессии) узлов в разделе закреплённых задач. */
export declare const enum CompressionBehavior {
    NORMAL = 0,
    SMART = 1
}



/** Данные одного scope для построения дерева:
 * определения задач, конфигурация отображения и набор закреплённых имён. */
export interface ScopeRecord {
    /** {@linkcode FolderName} — Отображаемое имя папки workspace. */
    folderName: FolderName;
    /** Определения задач scope, индексированные по имени. */
    definitionMap: ScopedDefinitions;
    /** {@linkcode TreeConfig} — Конфигурация структуры ветки дерева для этого scope. */
    treeConfig: TreeConfig;
    /** {@linkcode NodeConfig} — Конфигурация визуального отображения узлов для этого scope. */
    nodeConfig: NodeConfig;
    /** Имена закреплённых задач этого scope. */
    pinned: Set<Name>;
}

/** Конфигурация раздела закреплённых задач. */
export interface PinnedConfig {
    /** {@linkcode PinnedVisibility} — Режим видимости раздела. */
    visibility: PinnedVisibility;
    /** {@linkcode CompressionBehavior} — Поведение сжатия узлов в разделе. */
    compressionBehavior: CompressionBehavior;
    /** {@linkcode PinnedStale}`[]` — Записи, scope которых больше не существует в workspace. */
    staleRecords: Array<PinnedStale>;
}


/** Входные данные для построения дерева задач. 
 * 
 * Ограничения на данные:
 * 
 * **Замечания:**:
 * - Порядок scopeIndex семантически значим — он определяет 
 *   порядок File-секций в выводе, и порядок PinnedFolder-обёрток внутри PinnedMulti.
 * 
 * **Предусловия**:
 * - Все `ScopeRecord.folderName` уникальны среди всех ScopeRecord.
 * - Каждое имя из `ScopeRecord.pinned` присутствует как ключ
 *   в том же `ScopeRecord.definitionMap`.
 * */
export interface TreeInput {
    /** `Map<`{@linkcode File}`, `{@linkcode ScopeRecord}`>` — 
     * Данные всех scope, индексированные по файлу задач. */
    scopeIndex: Map<File, ScopeRecord>;
    /** {@linkcode PinnedConfig} — Конфигурация раздела закреплённых задач. */
    pinnedConfig: PinnedConfig;
    /** `Set<`{@linkcode FolderName}`>` — Имена папок workspace, исключённых из отображения. */
    excludedFolders: Set<FolderName>;
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