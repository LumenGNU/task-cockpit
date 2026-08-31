/** @file common.ts */

export const DISPLAY_NAME = 'Task Cockpit';

export const ID = 'task-cockpit';
export const PREFIX = ID;

export const VIEW_CONTAINER_ID = `${PREFIX}_view-container`;


export const GLOBAL_TREE_VIEW = {
    ID: `${VIEW_CONTAINER_ID}_global-task-view`,
    NAME: 'Global Tasks'
} as const;


export const PROJECT_TREE_VIEW = {
    ID: `${VIEW_CONTAINER_ID}_project-task-view`,
    NAME: 'Project Tasks'
} as const;

export type SelectedNodeTag =
    | `TopNode:${'User' | 'Workspace' | 'Folder'}`
    | 'RunnableNode'
    | 'IntermediateNode'
    | 'UnknownNode';

export const WHEN_CONTEXT = {
    VIEW_CONTAINER_ACTIVE: `${VIEW_CONTAINER_ID}.active`,
    GLOBAL_TREE_VIEW_HAS_ITEMS: `${GLOBAL_TREE_VIEW.ID}.hasItems`,
    PROJECT_TREE_VIEW_HAS_ITEMS: `${PROJECT_TREE_VIEW.ID}.hasItems`,
    GLOBAL_TREE_VIEW_SELECTED_NODE_TYPE: `${GLOBAL_TREE_VIEW.ID}.selectedNodeType`,
    PROJECT_TREE_VIEW_SELECTED_NODE_TYPE: `${PROJECT_TREE_VIEW.ID}.selectedNodeType`,
} as const;


export const UI = {
    COLOR: {
        INVALID: 'list.invalidItemForeground',
        DEEMPHASIZED: 'list.deemphasizedForeground'
    },
    ICON: {
        DEEMPHASIZED     /**/: 'dash',
        ERROR            /**/: 'circle-slash',
        WARNING          /**/: 'warning',
        TASK_DEFAULT     /**/: 'tools',
        USER_ORIGIN      /**/: 'vm',
        WORKSPACE_ORIGIN /**/: 'layers',
        FOLDER_ORIGIN    /**/: 'root-folder',
        SYMBOL_FOLDER    /**/: 'symbol-folder',// 'folder' | @todo имя может отличатся для разных версий. проверь
        REFRESH          /**/: 'refresh',
        SEARCH           /**/: 'search',
        EXPAND_ALL       /**/: 'expand-all',
        COLLAPSE_ALL     /**/: 'collapse-all',
        LIST_FILTER      /**/: 'list-filter',
        // USER_TASKS_FILE: 'settings-gear',
        OPEN_TASKS_FILE: 'go-to-file',
        EDIT: 'edit',
        EXECUTE: 'play'
    },
    DISPLAY_SEGMENT_SEPARATOR: '・',
    // MD_EXPANDER: '![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQ4AAAABAgMAAABS/qhXAAAACVBMVEUAAAAAAAD///+D3c/SAAAAAXRSTlMAQObYZgAAAAxJREFUCNdjYKACAAAARQABMOPaBgAAAABJRU5ErkJggg==)'
} as const;



export const COMMAND_CATEGORY = 'Task Cockpit';

export const COMMAND_IDS = {

    // Открыть README (github) для текущей версии
    OPEN_HELP_PAGE                   /**/: `${PREFIX}.open-help-page`,

    // Перечитать все данные, будет спровоцирована перестройка
    // всех *-task-view представлений
    FORCE_FULL_REFRESH               /**/: `${PREFIX}.force-full-refresh`,

    // Перестроить дерево в представлении (на кешированных данных. малополезно)
    VIEW_REFRESH                     /**/: `${PREFIX}.view.refresh`,


    OPEN_PROFILE_TASKS_FILE   /**/: `${PREFIX}.tasks-file.open-profile-tasks-file`,
    OPEN_PROJECT_TASKS_FILE   /**/: `${PREFIX}.tasks-file.open-project-tasks-file`,

    // Открыть в редакторе файл-источник задач, и выделить определение конкретной задачи
    OPEN_TASK_DEFINITION /**/: `${PREFIX}.tasks-file.go-to-task-definition`,



    // Открыть в редакторе tasks.json-источник задач
    // TASKS_FILE_OPEN_TASKS_FILE       /**/: `${PREFIX}.tasks-file.open-tasks-file`,

    // Открыть в редакторе .code-workspace-источник задач
    // TASKS_FILE_OPEN_WORKSPACE_TASKS   /**/: `${PREFIX}.tasks-file.open-workspace-tasks`,
    /** Команда: открыть файл-источник-задач User-источника */
    // TASKS_FILE_OPEN_USER_TASKS         /**/: `${PREFIX}.tasks-file.open-user-tasks`,

    // Выполнить задачу
    TASK_EXECUTE                     /**/: `${PREFIX}.task.execute`,
    // Выполнить задачу (alias)
    TASK_EXECUTE_NEW_INSTANCE        /**/: `${PREFIX}.task.execute-new-instance`,

    TASK_ABORT_ALL_INSTANCES          /**/: `${PREFIX}.task.abort-all`,
    TASK_SHOW_TERMINAL               /**/: `${PREFIX}.task.show-terminal`, // @todo navigate-to-terminal ?

    OPEN_SETTINGS_DISPLAY            /**/: `${PREFIX}.settings.configure-display`,
    OPEN_SETTINGS_FILTERING          /**/: `${PREFIX}.settings.configure-filtering`,
    OPEN_SETTINGS_EXCLUDE_FOLDERS    /**/: `${PREFIX}.settings.configure-excludeFolders`,

    GLOBAL_TASK_VIEW_OPEN_FIND_WIDGET    /**/: `${PREFIX}.view-container.${GLOBAL_TREE_VIEW.ID}.open-find-widget`,
    PROJECT_TASK_VIEW_OPEN_FIND_WIDGET   /**/: `${PREFIX}.view-container.${PROJECT_TREE_VIEW.ID}.open-find-widget`,

    // Развернуть все узлы в global-task-view представлении
    GLOBAL_TASK_VIEW_EXPAND_ALL      /**/: `${PREFIX}.view-container.${GLOBAL_TREE_VIEW.ID}.expand-all`,
    // Развернуть все узлы в project-task-view представлении
    PROJECT_TASK_VIEW_EXPAND_ALL     /**/: `${PREFIX}.view-container.${PROJECT_TREE_VIEW.ID}.expand-all`,

    GLOBAL_TASK_VIEW_COLLAPSE_ALL      /**/: `${PREFIX}.view-container.${GLOBAL_TREE_VIEW.ID}.collapse-all`,
    PROJECT_TASK_VIEW_COLLAPSE_ALL     /**/: `${PREFIX}.view-container.${PROJECT_TREE_VIEW.ID}.collapse-all`,

    OPEN_BROKEN_TASK_DEFINITION: `${PREFIX}.aaaaaaaaaaaaaaaaaaaaaaa`,

} as const;


export const CONFIG_BASE_SECTION = 'taskCockpit';

export const SETTING_IDS = {
    BADGES: {
        AVAILABLE_SYMBOL        /**/: `${CONFIG_BASE_SECTION}.badges.availableSymbol`,
        BADGE_ORDER             /**/: `${CONFIG_BASE_SECTION}.badges.badgeOrder`,
        OVERFLOW_SYMBOL         /**/: `${CONFIG_BASE_SECTION}.badges.overflowSymbol`,
        RUNNING_SYMBOL          /**/: `${CONFIG_BASE_SECTION}.badges.runningSymbol`,
    },
    DISPLAY: {
        DEFAULT_ICON_NAME              /**/: `${CONFIG_BASE_SECTION}.display.defaultIconName`,
        GROUP_BY_TASK_GROUP            /**/: `${CONFIG_BASE_SECTION}.display.groupByTaskGroup`,
        SEGMENT_SEPARATOR              /**/: `${CONFIG_BASE_SECTION}.display.segmentSeparator`,
        TINT_LABEL                     /**/: `${CONFIG_BASE_SECTION}.display.tintLabel`,
    },
    FILTERING: {
        EXCLUDE_FOLDERS              /**/: `${CONFIG_BASE_SECTION}.filtering.excludeFolders`,
        SHOW_HIDDEN                  /**/: `${CONFIG_BASE_SECTION}.filtering.showHidden`,
        SHOW_GLOBAL_TASKS            /**/: `${CONFIG_BASE_SECTION}.showGlobalTasksView`,
    },
    PROCESS_MONITOR_POLLING_ACCEL          /**/: `${CONFIG_BASE_SECTION}.processMonitor.polling.acceleration`,
    PROCESS_MONITOR_POLLING_CAP            /**/: `${CONFIG_BASE_SECTION}.processMonitor.polling.cap`,
    PROCESS_MONITOR_POLLING_MIN            /**/: `${CONFIG_BASE_SECTION}.processMonitor.polling.min`,
    TERMINALS_TIMEOUT                      /**/: `${CONFIG_BASE_SECTION}.terminals.timeout`,
    DIAGNOSTICS_SHADOWED_TASKS             /**/: `${CONFIG_BASE_SECTION}.diagnostics.shadowedTasks`,
    DIAGNOSTICS_UNREACHABLE_DEPENDENCIES   /**/: `${CONFIG_BASE_SECTION}.diagnostics.unreachableDependencies`,
} as const;
