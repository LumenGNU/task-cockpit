/** @file common.ts */

export const DISPLAY_NAME = 'Task Cockpit';

export const ID = 'task-cockpit';
export const ID_PREFIX = ID;

export const VIEW_CONTAINER_ID = `${ID_PREFIX}_view-container`;


export const GLOBAL_TREE_VIEW = {
    ID: `${VIEW_CONTAINER_ID}_global-task-view`,
    NAME: 'Global Tasks'
} as const;


export const PROJECT_TREE_VIEW = {
    ID: `${VIEW_CONTAINER_ID}_project-task-view`,
    NAME: 'Project Tasks'
} as const;


export const PANEL_CONTEXT_TAG = {
    PANEL_ACTIVE: `${VIEW_CONTAINER_ID}.active`,
    GLOBAL_TREE_VIEW_HAS_ITEMS: `${GLOBAL_TREE_VIEW.ID}.hasItems`,
    PROJECT_TREE_VIEW_HAS_ITEMS: `${PROJECT_TREE_VIEW.ID}.hasItems`
} as const;


export const UI = {
    COLOR: {
        INVALID: 'list.invalidItemForeground',
        DEEMPHASIZED: 'list.deemphasizedForeground'
    },
    ICON: {
        DEEMPHASIZED: 'dash',
        ERROR: 'circle-slash',
        WARNING: 'warning',
        TASK_DEFAULT: 'tools',
        USER_ORIGIN: 'vm',
        WORKSPACE_ORIGIN: 'layers',
        FOLDER_ORIGIN: 'root-folder',
        SYMBOL_FOLDER: 'symbol-folder'// 'folder' | @todo имя может отличатся для разных версий. проверь
    }
    // MD_EXPANDER: '![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQ4AAAABAgMAAABS/qhXAAAACVBMVEUAAAAAAAD///+D3c/SAAAAAXRSTlMAQObYZgAAAAxJREFUCNdjYKACAAAARQABMOPaBgAAAABJRU5ErkJggg==)'
} as const;



export const COMMAND_CATEGORY = 'Task Cockpit';

export const COMMAND_IDS = {

    // Открыть README (github) для текущей версии
    OPEN_HELP_PAGE                   /**/: `${ID_PREFIX}.open-help-page`,

    // Перечитать все данные, будет спровоцирована перестройка
    // всех *-task-view представлений
    FORCE_FULL_REFRESH               /**/: `${ID_PREFIX}.force-full-refresh`,

    // Перестроить дерево в представлении (на кешированных данных. малополезно)
    VIEW_REFRESH                     /**/: `${ID_PREFIX}.view.refresh`,

    // Развернуть все узлы в global-task-view представлении
    GLOBAL_TASK_VIEW_EXPAND_ALL      /**/: `${ID_PREFIX}.view-container.${GLOBAL_TREE_VIEW.ID}.expand-all`,
    // Развернуть все узлы в project-task-view представлении
    PROJECT_TASK_VIEW_EXPAND_ALL   /**/: `${ID_PREFIX}.view-container.${PROJECT_TREE_VIEW.ID}.expand-all`,

    // Открыть в редакторе файл-источник задач, и выделить определение
    // конкретной задачи
    TASKS_FILE_OPEN_TASK             /**/: `${ID_PREFIX}.tasks-file.open-task`,
    // Открыть в редакторе tasks.json-источник задач
    TASKS_FILE_OPEN_TASKS_FILE       /**/: `${ID_PREFIX}.tasks-file.open-tasks-file`,
    // Открыть в редакторе .code-workspace-источник задач
    TASKS_FILE_OPEN_WORKSPACE_FILE   /**/: `${ID_PREFIX}.tasks-file.open-workspace-file`,

    // Выполнить задачу
    TASK_EXECUTE                     /**/: `${ID_PREFIX}.task.execute`,
    // Выполнить задачу (alias)
    TASK_EXECUTE_NEW_INSTANCE        /**/: `${ID_PREFIX}.task.execute-new-instance`,

    TASK_ABORT_ALL_INSTANCE          /**/: `${ID_PREFIX}.task.abort-all`,
    TASK_SHOW_TERMINAL               /**/: `${ID_PREFIX}.task.show-terminal`,

    OPEN_SETTINGS_DISPLAY            /**/: `${ID_PREFIX}.settings.configure-display`,
    OPEN_SETTINGS_FILTERING          /**/: `${ID_PREFIX}.settings.configure-filtering`
} as const;


export const CONFIG_BASE_SECTION = 'taskCockpit';

export const SETTING_IDS = {
    DISPLAY_BADGES_AVAILABLE_SYMBOL  /**/: `${CONFIG_BASE_SECTION}.display.badges.availableSymbol`,
    DISPLAY_BADGES_BADGE_ORDER       /**/: `${CONFIG_BASE_SECTION}.display.badges.badgeOrder`,
    DISPLAY_BADGES_OVERFLOW_SYMBOL   /**/: `${CONFIG_BASE_SECTION}.display.badges.overflowSymbol`,
    DISPLAY_BADGES_RUNNING_SYMBOL    /**/: `${CONFIG_BASE_SECTION}.display.badges.runningSymbol`,
    DISPLAY_DEFAULT_ICON_NAME        /**/: `${CONFIG_BASE_SECTION}.display.defaultIconName`,
    DISPLAY_GROUP_BY_TASK_GROUP      /**/: `${CONFIG_BASE_SECTION}.display.groupByTaskGroup`, // @fixme переименовано useGroupKind -> groupByTaskGroup
    DISPLAY_SEGMENT_SEPARATOR        /**/: `${CONFIG_BASE_SECTION}.display.segmentSeparator`,
    DISPLAY_TINT_LABEL               /**/: `${CONFIG_BASE_SECTION}.display.tintLabel`,
    DISPLAY_USE_FOLDER_ICON          /**/: `${CONFIG_BASE_SECTION}.display.useFolderIcon`,
    FILTERING_EXCLUDE_FOLDERS        /**/: `${CONFIG_BASE_SECTION}.filtering.excludeFolders`,
    FILTERING_SHOW_HIDDEN            /**/: `${CONFIG_BASE_SECTION}.filtering.showHidden`,
    PROCESS_MONITOR_POLLING_ACCEL    /**/: `${CONFIG_BASE_SECTION}.processMonitor.polling.acceleration`,
    PROCESS_MONITOR_POLLING_CAP      /**/: `${CONFIG_BASE_SECTION}.processMonitor.polling.cap`,
    PROCESS_MONITOR_POLLING_MIN      /**/: `${CONFIG_BASE_SECTION}.processMonitor.polling.min`,
    SHOW_GLOBAL_TASKS_VIEW           /**/: `${CONFIG_BASE_SECTION}.showGlobalTasksView`,
    TERMINALS_TIMEOUT                /**/: `${CONFIG_BASE_SECTION}.terminals.timeout`,
    VALIDATION_SHADOWED_TASKS        /**/: `${CONFIG_BASE_SECTION}.validation.duplicateLabels`, // @fixme "не дубликаты", а "затененные"
    VALIDATION_MISSING_DEPENDENCIES  /**/: `${CONFIG_BASE_SECTION}.validation.missingDependencies`, // @fixme переименовано dependencies -> missingDependencies
} as const;
