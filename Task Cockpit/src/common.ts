


export const DISPLAY_NAME = 'Task Cockpit';

export const ID = 'task-cockpit';
export const ID_PREFIX = ID;

export const VIEW_CONTAINER_ID = `${ID_PREFIX}_view-container`;
export const GLOBAL_TREE_VIEW_ID = `${VIEW_CONTAINER_ID}_global-task-view`;
export const WORKSPACE_TREE_VIEW_ID = `${VIEW_CONTAINER_ID}_workspace-task-view`;

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
    GLOBAL_TASK_VIEW_EXPAND_ALL      /**/: `${ID_PREFIX}.view-container.global-task-view.expand-all`,
    // Развернуть все узлы в workspace-task-view представлении
    WORKSPACE_TASK_VIEW_EXPAND_ALL   /**/: `${ID_PREFIX}.view-container.workspace-task-view.expand-all`,

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
    VALIDATION_DUPLICATE_LABELS      /**/: `${CONFIG_BASE_SECTION}.validation.duplicateLabels`,
    VALIDATION_MISSING_DEPENDENCIES  /**/: `${CONFIG_BASE_SECTION}.validation.missingDependencies`, // @fixme переименовано dependencies -> missingDependencies
} as const;
