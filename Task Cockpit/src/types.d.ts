import type * as vscode from 'vscode';

declare const __TasksFile: unique symbol;
declare const __TasksFileUri: unique symbol;
declare const __TaskLabel: unique symbol;
declare const __Identity: unique symbol;
declare const __ProcessId: unique symbol;
declare const __QueryComponent: unique symbol;


export type Separator = '\x1F';

type QueryComponent = string & { readonly [__QueryComponent]: never; };

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
export type File = string & { readonly [__TasksFile]: never; };


/** Брендированный URI файла задач.
 *
 * Гарантирует, что `fsPath` возвращает {@linkcode File}. */
export type Uri = vscode.Uri & {
    readonly [__TasksFileUri]: never;
    fsPath: File;
};


/** Номинальный тип для имени задачи.
 *
 * Используется для type safety при работе с коллекциями. */
export type Name = string & { readonly [__TaskLabel]: never; };


/** Строковой идентификатор задачи, в терминах расширения {@linkcode File} + {@linkcode Name}.
 *
 * Номинальный тип для идентификатора задачи.
 *
 * Используется для type safety при работе с коллекциями;
 * для однозначного определения задачи; */
export type TaskID = `${File}${Separator}${Name}` & { readonly [__Identity]: never; };


/** Полный набор настроек расширения, разделённый по уровню действия. */
export interface Settings {
    /** Настройки уровня ресурса (per-folder в multi-root). */
    readonly resource: ScopedSettings;
    /** Настройки уровня окна (общие для всего workspace). */
    readonly window: WindowSettings;
}


/** Настройки уровня ресурса — читаются отдельно для каждого scope.
 *
 * В multi-root workspace каждая папка может иметь свои значения. */
export interface ScopedSettings {
    /** Параметры построения ветки дерева (иерархия, группировка, фильтрация). */
    readonly branchConfig: BranchConfig;
    /** Параметры отображения элементов дерева (иконки, цвета). */
    readonly nodeConfig: NodeConfig;
}


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
export interface BranchConfig {
    /** Символ-разделитель для разбиения label на сегменты иерархии.
     * `false` — иерархия отключена. */
    readonly segmentSeparator: string | false;
    /** Группировать ли задачи по свойству `group`. */
    readonly useGroupKind: boolean;
    /** Показывать ли задачи с `hide: true`. */
    readonly showHidden: boolean;
}


/** Параметры, определяющие визуальное отображение элементов дерева. */
export interface NodeConfig {
    /** Показывать ли иконку папки для промежуточных (intermediate) узлов. */
    readonly useFolderIcon: boolean;
    /** Имя иконки по умолчанию для задач без кастомной иконки. */
    readonly defaultIconName: string;
    /** Окрашивать ли label задачи в цвет её иконки. */
    readonly tintLabel: boolean;
}


/** Настройки диагностики задач. */
export interface ValidationSettings {
    /** Обнаруживать задачи с дублирующимися label. */
    readonly duplicateLabels: boolean;
    /** Обнаруживать отсутствующие ссылки в `dependsOn`. */
    readonly dependencies: boolean;
}


export interface RuntimeSettings {
    pollingCap: number,
    terminalTimeout: number;
}

/** Область действия задач, с именем и URI файла, в котором они определены (источником задач).
 *
 * Resource settings читаются для scope, а не наоборот:
 * scope — первичная сущность, настройки вторичны. */
export interface Scope {
    readonly name: string;
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
        kind: string;
        isDefault: boolean;
    };
}


// export type RunnableData = {
//     id: TaskID;
// } & TaskDefinition;


// /** Задача, в терминах расширения. */
// export interface Task extends TaskDefinition {
//     /** Путь к источнику задач. */
//     source: File;
//     /** vscode.Task, созданная средой. */
//     vscTask: Readonly<vscode.Task>;
// }


export type ScopedTasks = Map<Name, vscode.Task>;

export type TasksByFile = Map<File, ScopedTasks>;

export type ScopedDefinition = Map<Name, TaskDefinition>;

export type DefinitionsByFile = Map<File, ScopedDefinition>;

export type SettingsByFile = Map<File, ScopedSettings>;

// export type RejectReport = Map<File, number>;

export interface FetchResult {
    readonly tasksByFile: Readonly<TasksByFile>,
    readonly definitionsByFile: Readonly<DefinitionsByFile>,
    // readonly rejectReport: Readonly<RejectReport>;
}


export type ProcessId = number & { readonly [__ProcessId]: never; };


export interface TerminalsSnapshot {
    timestamp: number,
    processIds: ReadonlySet<ProcessId>;
}


// /** Детализация количества задач в scope. */
// export interface ScopedDetail {
//     /** Общее количество задач. */
//     all: number;
//     // skipped: number; // @todo или да?
//     /** Количество скрытых задач (`hide: true`). */
//     hidden: number;
// }


// export type DetailsByFile = Map<File, ScopedDetail>;


/** Детализация количества workspace-scope. */
export interface WorkspaceDetail {
    /** Общее количество workspace-scopes. */
    total: number;
    /** Количество отображаемых workspace-scopes. */
    displayed: number;
}


declare const MarkerType: {
    readonly EMPTY: 'EMPTY';
};
export type MarkerType = typeof MarkerType[keyof typeof MarkerType];


/** Детализация состояния процессов задачи. */
export type RuntimeState = ReadonlyMap<ProcessId, Readonly<ProcessInfo>>;

export interface ProcessInfo {
    running: boolean,
    timestamp: number;
}


export interface VisualMetadata {
    color?: string | undefined,
    processes?: number,
    running?: number;
    special?: 'EMPTY' | 'BROKEN';
}



