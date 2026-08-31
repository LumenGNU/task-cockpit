#!/usr/bin/env -S npx tsx

import cps from 'node:child_process';
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import semVer from 'semver';
import * as assert from 'node:assert/strict';
import {
    COMMAND_CATEGORY,
    COMMAND_IDS,
    DISPLAY_NAME,
    ID,
    SETTING_IDS,
    VIEW_CONTAINER_ID,
    PROJECT_TREE_VIEW,
    GLOBAL_TREE_VIEW,
    WHEN_CONTEXT,
    UI,
} from './src/common.js';



const MAIN_JS = process.env.MAIN_JS;
const ICONS_PATH = process.env.ICONS_PATH;
const MANIFEST_FILE = process.env.MANIFEST_FILE;
const enableCommandsRaw = process.env.ENABLE_COMMANDS;


if (!MAIN_JS) {
    // MAIN_JS обязателен — путь к основному скрипту расширения
    throw new Error('Environment variable MAIN_JS is required');
}

if (ICONS_PATH == null) {
    // ICONS_PATH обязателен, даже если пустая строка — используем явную проверку на null/undefined
    throw new Error('Environment variable ICONS_PATH is required');
}

if (MANIFEST_FILE == null) {
    throw new Error('Environment variable MANIFEST_FILE is required');
}

// Защита от перезаписи существующего манифеста
if (fs.existsSync(MANIFEST_FILE)) {
    throw new Error(
        `Manifest file already exists at "${MANIFEST_FILE}". First, delete it.`
    );
}


// #region

// ------------------------------------------------------------------------------------

const ENABLE_COMMANDS =
    enableCommandsRaw
        ? new Set(
            enableCommandsRaw.split(' ')
                .map(s => s.trim())
                .map(s => {
                    const id = COMMAND_IDS[s as keyof typeof COMMAND_IDS];
                    if (!id) throw new Error(`Unknown command key: "${s}"`);
                    return id;
                })
                .filter(s => Boolean(s))
        )
        : 'ALL';

// ------------------------------------------------------------------------------------


function getLatestVersion(): string {
    // только теги, которые являются предками HEAD
    // в смысле «того, что сейчас актуально на этой ветке»
    const versions = cps.execSync("git tag --sort=-committerdate --merged HEAD 'v[0-9]*'", { encoding: 'utf8' })
        .trim()
        .split('\n')
        .map(tag => tag.replace(/^v/, ''))
        .map(ver => semVer.valid(ver) ? semVer.parse(ver) : null)
        .filter(
            (ver: semVer.SemVer | null): ver is semVer.SemVer => Boolean(ver)
        );
    const semVersion = versions.at(0);
    if (!semVersion) {
        throw new Error('No valid semver tags found');
    }

    const branch = cps.execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

    // На main/master версия должна быть «чистой» — без билд-метаданных,
    // релизная сборка не должна отличаться от тега.
    // На остальных ветках билд-метаданные = имя ветки, чтобы различать сборки.
    let normalizedBranch = '';
    if (branch !== 'main' && branch !== 'master') {
        normalizedBranch = branch
            .toLowerCase()
            .replace(/[^0-9A-Za-z-]+/g, '-')   // всё, что не разрешено → один дефис
            .replace(/-+/g, '-')               // схлопываем множественные дефисы
            .replace(/^-|-$/g, '')             // убрать дефисы в начале и конце
            .substring(0, 28);                 // ограничиваем длину, чтобы не было слишком длинного идентификатора
        // если после чистки ничего не осталось (имя ветки было сплошь спецсимволами) — fallback
        if (!normalizedBranch) {
            normalizedBranch = 'dev';
        }
    }

    const versionString = normalizedBranch
        ? `${semVersion.version}+${normalizedBranch}`
        : semVersion.version;

    const version = semVer.parse(versionString)?.raw;

    if (!version) {
        throw new Error(`Failed to parse version as valid semver: "${versionString}"`);
    }

    return version;
}


// ------------------------------------------------------------------------------------

const order = (function () {
    const map: Map<string, number> = new Map();
    return {
        nextIn(section: string) {
            let c = map.get(section);
            if (c === undefined) {
                c = 0;
                map.set(section, c);
            }
            const next = ++c;
            map.set(section, next);
            return next;
        }
    };
})();

// ------------------------------------------------------------------------------------


function getCodiconsList(): string[] {
    const packageJsonUrl = import.meta.resolve('@vscode/codicons/package.json');
    const codiconsRoot = path.dirname(url.fileURLToPath(packageJsonUrl));
    const mappingJson = path.join(codiconsRoot, 'src/template/mapping.json');
    const mapping = JSON.parse(fs.readFileSync(mappingJson, 'utf8'));
    const icons = [...new Set(Object.values(mapping).flat() as string[])]
        .filter(name => name !== 'folder' && name !== 'dash')
        .sort();

    return icons;
}

// ------------------------------------------------------------------------------------

function readDependencies() {
    const mappingJson = path.resolve('.', 'package.json');
    const mapping = JSON.parse(fs.readFileSync(mappingJson, 'utf8'));

    return mapping['dependencies'];
}

// ------------------------------------------------------------------------------------

function iconPath(icon: string): string {
    assert.ok(ICONS_PATH != null);
    return ICONS_PATH ? `${ICONS_PATH}/${icon}` : icon;
}

// ------------------------------------------------------------------------------------

interface CommandDefinitionIn {
    command: typeof COMMAND_IDS[keyof typeof COMMAND_IDS];
    icon: string;
    category: string;
    title: string;
    shortTitle?: string;
    enablement?: string | string[];
}

interface CommandDefinitionOut {
    command: typeof COMMAND_IDS[keyof typeof COMMAND_IDS];
    icon: string;
    category: string;
    title: string;
    shortTitle?: string;
    enablement?: string;
}

function defineCommands(...commandDefs: CommandDefinitionIn[]): CommandDefinitionOut[] {
    return commandDefs.reduce((out, def) => {
        if (ENABLE_COMMANDS === 'ALL' || ENABLE_COMMANDS.has(def.command)) {
            out.push({
                ...def,
                enablement: Array.isArray(def.enablement)
                    ? def.enablement.join(' ')
                    : def.enablement,
            });
        }
        return out;
    }, [] as CommandDefinitionOut[]);
}

// ------------------------------------------------------------------------------------

interface MenuItemDef {
    command: typeof COMMAND_IDS[keyof typeof COMMAND_IDS];
    when: string;
    group: string;
}

function defineMenu(...menuItems: MenuItemDef[][]) {

    const items = menuItems.flat();

    if (ENABLE_COMMANDS === 'ALL') {
        return items;
    }

    return items.filter(i => ENABLE_COMMANDS.has(i.command));
}


const mapGroup: Map<string, number> = new Map();

interface MenuItemIn {
    command: typeof COMMAND_IDS[keyof typeof COMMAND_IDS];
    when: string | string[];
}

interface MenuItemOut {
    when: string;
    group: string;
    command: (typeof COMMAND_IDS)[keyof typeof COMMAND_IDS];
}

function defineMenuItems(group: string, ...menuItems: MenuItemIn[]): MenuItemOut[] {
    return menuItems.map((i) => {
        let c = mapGroup.get(group);
        if (c === undefined) {
            c = 0;
            mapGroup.set(group, c);
        }
        const next = ++c;
        mapGroup.set(group, next);
        return {
            ...i,
            when: Array.isArray(i.when) ? i.when.join(' ') : i.when,
            group: `${group}@${next}`
        };
    });
}


function MD(md: string | string[]) {
    return Array.isArray(md) ? md.join(' ') : md;
}


// ------------------------------------------------------------------------------------

// #endregion

const MANIFEST = {
    name: ID,
    publisher: 'papio-dev',
    icon: iconPath('icon.png'), // svg тут не разрешен
    galleryBanner: {
        color: '#F7F8EA',
        theme: 'light'
    },
    sponsor: {
        url: 'https://ko-fi.com/papio_dev'
    },
    displayName: DISPLAY_NAME,
    description: 'Tree view panel for browsing and running tasks. Displays tasks from workspace and task files in an organized, customizable tree structure.',
    version: getLatestVersion(),
    license: 'MIT',
    keywords: [
        'tasks',
        'tasks.json',
        'task runner',
        'task tree',
        'task panel',
        'task explorer'
    ],
    markdown: 'github',
    repository: {
        type: 'git',
        url: 'https://github.com/papio-dev/task-cockpit.git'
    },
    homepage: 'https://github.com/papio-dev/task-cockpit',
    bugs: {
        url: 'https://github.com/papio-dev/task-cockpit/issues'
    },
    engines: {
        vscode: '^1.86.0'
    },
    categories: [
        'Other'
    ],
    extensionKind: [
        'workspace'
    ],
    main: MAIN_JS,
    activationEvents: [
        "onStartupFinished"
    ],
    contributes: {
        viewsContainers: {
            activitybar: [
                {
                    id: VIEW_CONTAINER_ID,
                    title: DISPLAY_NAME,
                    icon: iconPath('panel-icon.svg')
                }
            ]
        },
        views: {
            [VIEW_CONTAINER_ID]: [
                {
                    id: GLOBAL_TREE_VIEW.ID,
                    name: GLOBAL_TREE_VIEW.NAME,
                    icon: iconPath('panel-icon.svg'),
                    type: 'tree',
                    initialSize: 55,
                    visibility: 'visible',
                    when: `config.${SETTING_IDS.FILTERING.SHOW_GLOBAL_TASKS}`
                },
                {
                    id: PROJECT_TREE_VIEW.ID,
                    name: PROJECT_TREE_VIEW.NAME,
                    icon: iconPath('panel-icon.svg'),
                    type: 'tree',
                    initialSize: 89,
                    visibility: 'visible'
                }
            ]
        },
        viewsWelcome: [

            // @todo context: tasksAvailable=false ?

            // global-task-view (не умеет быть по настоящему пустым)
            // -------------------------------------------------------------------
            {
                view: GLOBAL_TREE_VIEW.ID,
                contents: 'Scanning...',
                when: 'workbenchState != empty',
                // enablement: 'workbenchState != empty'
            },
            // workspace-task-view
            // -------------------------------------------------------------------
            {
                view: PROJECT_TREE_VIEW.ID,
                contents: 'Scanning...',
                when: `workbenchState != empty && !${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                // enablement: `workbenchState != empty && !${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`
            },
            {
                view: PROJECT_TREE_VIEW.ID,
                contents: 'Open a folder or workspace to get started.',
                when: 'workbenchState == empty',
                // enablement: 'workbenchState == empty'
            },
            {
                view: PROJECT_TREE_VIEW.ID,
                contents: `All folders are excluded by the [filter settings](command:${COMMAND_IDS.OPEN_SETTINGS_EXCLUDE_FOLDERS})`,
                when: `workbenchState != empty && ${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                // enablement: `workbenchState != empty && ${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`
            }
        ],
        commands: defineCommands(
            {
                command: COMMAND_IDS.FORCE_FULL_REFRESH,
                icon: `$(${UI.ICON.REFRESH})`,
                category: COMMAND_CATEGORY,
                title: 'Force Full Refresh',
                shortTitle: 'Full Refresh',
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`
                ]
            },
            {
                command: COMMAND_IDS.GLOBAL_TASK_VIEW_OPEN_FIND_WIDGET,
                icon: `$(${UI.ICON.SEARCH})`,
                category: COMMAND_CATEGORY,
                title: 'Find Task In List',
                shortTitle: 'Find Task',
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                    `&& ${WHEN_CONTEXT.GLOBAL_TREE_VIEW_HAS_ITEMS}`
                ]
            },
            {
                command: COMMAND_IDS.PROJECT_TASK_VIEW_OPEN_FIND_WIDGET,
                icon: `$(${UI.ICON.SEARCH})`,
                category: COMMAND_CATEGORY,
                title: 'Find Task In List',
                shortTitle: 'Find Task',
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                    `&& ${WHEN_CONTEXT.PROJECT_TREE_VIEW_HAS_ITEMS}`
                ]
            },
            {
                command: COMMAND_IDS.TASK_EXECUTE,
                category: COMMAND_CATEGORY,
                title: 'Run Task',
                icon: `$(${UI.ICON.EXECUTE})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`, // если не занят
                    `&& !(viewItem =~ /:Broken/)` // не сломан
                ]
            },
            // {
            //     command: COMMAND_IDS.TASK_EXECUTE_NEW_INSTANCE,
            //     category: COMMAND_CATEGORY,
            //     title: 'Start New Instance', // @todo или Run или execute?
            //     icon: `$(${UI.ICON.EXECUTE})`,
            //     enablement: [
            //         !!`view =~ /^${VIEW_CONTAINER_ID}/`, // любое дерево
            //         `&& ${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`, // если не занят
            //         `&& viewItem =~ /:Runnable/`, // если запускаемый
            //         `&& !(viewItem =~ /:Broken/)` // не сломан
            //     ]
            // },
            // {
            //     command: COMMAND_IDS.TASK_ABORT_ALL_INSTANCES,
            //     category: COMMAND_CATEGORY,
            //     title: 'Abort All Running Instances',
            //     icon: '$(stop)',
            //     enablement: [
            //         !!`view =~ /^${VIEW_CONTAINER_ID}/`, // любое дерево
            //         `&& viewItem =~ /:Runnable/`, // если запускаемый
            //         `&& viewItem =~ /:Running/`, // если работает
            //     ]
            // },


            {
                // открыть файл-источник задач из профиля
                command: COMMAND_IDS.OPEN_PROFILE_TASKS_FILE,
                category: COMMAND_CATEGORY,
                title: 'Open Profile Tasks File',
                icon: `$(${UI.ICON.OPEN_TASKS_FILE})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                ]
            },

            {
                // открыть файл-источник задач текущего проекта
                command: COMMAND_IDS.OPEN_PROJECT_TASKS_FILE,
                category: COMMAND_CATEGORY,
                title: 'Open Tasks File',
                icon: `$(${UI.ICON.OPEN_TASKS_FILE})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`
                ]
            },
            {
                command: COMMAND_IDS.OPEN_TASK_DEFINITION,
                category: COMMAND_CATEGORY,
                title: 'Go To Task Definition', // @fixme
                icon: `$(${UI.ICON.EDIT})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`
                ]
            },


            {
                command: COMMAND_IDS.OPEN_BROKEN_TASK_DEFINITION,
                category: COMMAND_CATEGORY,
                title: 'No task matches this definition', // @fixme
                icon: `$(${UI.ICON.WARNING})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`
                ]
            },

            // {
            //     command: COMMAND_IDS.TASK_SHOW_TERMINAL,
            //     category: COMMAND_CATEGORY,
            //     title: 'Show Task Terminal',
            //     icon: '$(terminal)',
            //     enablement: [
            //         !!`view =~ /^${VIEW_CONTAINER_ID}/`,
            //         `&& viewItem =~ /:Runnable/`, // если запускаемый
            //         `&& viewItem =~ /:Terminals/`
            //     ]
            // },

            // -------------------------------------------------------------------------
            {
                command: COMMAND_IDS.OPEN_HELP_PAGE,
                category: COMMAND_CATEGORY,
                title: 'Open Documentation',
                icon: '$(question)'
            },
            {
                command: COMMAND_IDS.OPEN_SETTINGS_DISPLAY,
                category: COMMAND_CATEGORY,
                title: 'Display Settings',
                icon: '$(list-tree)'
            },
            {
                command: COMMAND_IDS.OPEN_SETTINGS_FILTERING,
                category: COMMAND_CATEGORY,
                title: 'Filtering Settings',
                icon: `$(${UI.ICON.LIST_FILTER})`
            },

            // ---------------------------------------------------------
            {
                command: COMMAND_IDS.GLOBAL_TASK_VIEW_EXPAND_ALL,
                category: COMMAND_CATEGORY,
                title: 'Expand All',
                icon: `$(${UI.ICON.EXPAND_ALL})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                    `&& ${WHEN_CONTEXT.GLOBAL_TREE_VIEW_HAS_ITEMS}`
                ]
            },
            {
                command: COMMAND_IDS.GLOBAL_TASK_VIEW_COLLAPSE_ALL,
                category: COMMAND_CATEGORY,
                title: 'Collapse All',
                icon: `$(${UI.ICON.COLLAPSE_ALL})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                    `&& ${WHEN_CONTEXT.GLOBAL_TREE_VIEW_HAS_ITEMS}`
                ]
            },
            {
                command: COMMAND_IDS.PROJECT_TASK_VIEW_EXPAND_ALL,
                category: COMMAND_CATEGORY,
                title: 'Expand All',
                icon: `$(${UI.ICON.EXPAND_ALL})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                    `&& ${WHEN_CONTEXT.PROJECT_TREE_VIEW_HAS_ITEMS}`
                ]
            },
            {
                command: COMMAND_IDS.PROJECT_TASK_VIEW_COLLAPSE_ALL,
                category: COMMAND_CATEGORY,
                title: 'Collapse All',
                icon: `$(${UI.ICON.COLLAPSE_ALL})`,
                enablement: [
                    `${WHEN_CONTEXT.VIEW_CONTAINER_ACTIVE}`,
                    `&& ${WHEN_CONTEXT.PROJECT_TREE_VIEW_HAS_ITEMS}`
                ]
            },

        ),
        menus: {
            commandPalette: [ // @todo
                {
                    command: COMMAND_IDS.OPEN_PROFILE_TASKS_FILE,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.OPEN_PROJECT_TASKS_FILE,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.OPEN_TASK_DEFINITION,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.FORCE_FULL_REFRESH
                },
                {
                    command: COMMAND_IDS.GLOBAL_TASK_VIEW_OPEN_FIND_WIDGET,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.PROJECT_TASK_VIEW_OPEN_FIND_WIDGET,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.GLOBAL_TASK_VIEW_EXPAND_ALL,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.GLOBAL_TASK_VIEW_COLLAPSE_ALL,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.PROJECT_TASK_VIEW_EXPAND_ALL,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.PROJECT_TASK_VIEW_COLLAPSE_ALL,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.TASK_EXECUTE,
                    when: 'false'
                },
                {
                    command: COMMAND_IDS.OPEN_BROKEN_TASK_DEFINITION,
                    when: 'false'
                }
            ],
            'view/title': defineMenu(
                defineMenuItems('navigation',
                    { // искать в списке глобальных
                        command: COMMAND_IDS.GLOBAL_TASK_VIEW_OPEN_FIND_WIDGET,
                        when: `view == ${GLOBAL_TREE_VIEW.ID}`,
                    },
                    { // искать в списке проекта
                        command: COMMAND_IDS.PROJECT_TASK_VIEW_OPEN_FIND_WIDGET,
                        when: `view == ${PROJECT_TREE_VIEW.ID}`,
                    },
                    { // обновить все.
                        command: COMMAND_IDS.FORCE_FULL_REFRESH,
                        when: `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`
                    },
                    {
                        command: COMMAND_IDS.GLOBAL_TASK_VIEW_EXPAND_ALL,
                        when: `view == ${GLOBAL_TREE_VIEW.ID}`
                    },
                    {
                        command: COMMAND_IDS.GLOBAL_TASK_VIEW_COLLAPSE_ALL,
                        when: `view == ${GLOBAL_TREE_VIEW.ID}`
                    },
                    {
                        command: COMMAND_IDS.PROJECT_TASK_VIEW_EXPAND_ALL,
                        when: `view == ${PROJECT_TREE_VIEW.ID}`
                    },
                    {
                        command: COMMAND_IDS.PROJECT_TASK_VIEW_COLLAPSE_ALL,
                        when: `view == ${PROJECT_TREE_VIEW.ID}`
                    },
                ),
                defineMenuItems('b2_open_settings',
                    {
                        command: COMMAND_IDS.OPEN_SETTINGS_DISPLAY,
                        when: `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`,
                    },
                    {
                        command: COMMAND_IDS.OPEN_SETTINGS_FILTERING,
                        when: `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`,
                    },
                ),
                defineMenuItems('c3_help',
                    {
                        command: COMMAND_IDS.OPEN_HELP_PAGE,
                        when: `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`,
                    }
                ),
            ),
            'view/item/context': defineMenu(
                defineMenuItems('inline',
                    {
                        command: COMMAND_IDS.TASK_EXECUTE,
                        when: [
                            `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`,
                            `&& viewItem =~ /:Runnable/`, // запускаемый, но
                            `&& !(viewItem =~ /:Running/)`, // не выполняется сейчас
                            `&& !(viewItem =~ /:Broken/)` // и не сломан
                        ],
                    },
                    {
                        command: COMMAND_IDS.OPEN_BROKEN_TASK_DEFINITION,
                        when: [
                            `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`,
                            `&& viewItem =~ /:Runnable/`, // запускаемый, и
                            `&& viewItem =~ /:Broken/` // сломан
                        ],
                    },
                    {
                        command: COMMAND_IDS.OPEN_PROFILE_TASKS_FILE,
                        when: `view == ${GLOBAL_TREE_VIEW.ID} && viewItem =~ /:Section/`
                    },
                    {
                        command: COMMAND_IDS.OPEN_PROJECT_TASKS_FILE,
                        when: `view == ${PROJECT_TREE_VIEW.ID} && viewItem =~ /:Section/`,
                    },

                ),
                // defineMenuItems('a1_execute',
                //     {
                //         command: COMMAND_IDS.TASK_EXECUTE_NEW_INSTANCE,
                //         when: [
                //            `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`,
                //             `&& viewItem =~ /:Runnable/`
                //         ],
                //     },
                //     {
                //         command: COMMAND_IDS.TASK_ABORT_ALL_INSTANCES,
                //         when: [
                //           `( view == ${GLOBAL_TREE_VIEW.ID} || view == ${PROJECT_TREE_VIEW.ID} )`,
                //             `&& viewItem =~ /:Runnable/`
                //         ],
                //     },
                // ),
                defineMenuItems('b2_open',
                    // {
                    //     // открыть задачи из User/profile/.../
                    //     // Для User- вместо "перейти к задаче" - "открыть файл"
                    //     command: COMMAND_IDS.TASKS_FILE_OPEN_USER_TASKS,
                    //     when: `view == ${GLOBAL_TREE_VIEW.ID} && viewItem`
                    // },
                    // {
                    //     // открыть задачи из .code-workspace
                    //     command: COMMAND_IDS.TASKS_FILE_OPEN_WORKSPACE_TASKS,
                    //     when: `view == ${PROJECT_TREE_VIEW.ID} && viewItem == :Section:Workspace:Group`,
                    // },

                    {
                        // перейти к определению задачи в файле для Runnable
                        command: COMMAND_IDS.OPEN_TASK_DEFINITION,
                        when: [
                            `view == ${PROJECT_TREE_VIEW.ID}`, // только project-tree
                            `&& viewItem =~ /:Runnable/` // и только Runnable
                        ],
                    },
                    {
                        command: COMMAND_IDS.OPEN_PROFILE_TASKS_FILE,
                        when: `view == ${GLOBAL_TREE_VIEW.ID}`
                    },
                    {
                        command: COMMAND_IDS.OPEN_PROJECT_TASKS_FILE,
                        when: [
                            `view == ${PROJECT_TREE_VIEW.ID}`,// в project-tree на всех элементах, кроме...
                            '&& !(viewItem =~ /:Runnable/)', // Runnable
                        ]
                    }
                ),
                // defineMenuItems('c3_terminals',
                //     {
                //         command: COMMAND_IDS.TASK_SHOW_TERMINAL,
                //         when: [
                //            !! `view =~ /^${VIEW_CONTAINER_ID}/`,
                //             `&& viewItem =~ /:Runnable/`
                //         ],
                //     },
                // )
            )
        },
        submenus: [],
        "keybindings": [ // @fixme
            {
                command: COMMAND_IDS.OPEN_PROFILE_TASKS_FILE,
                key: 'f7',
                when: [
                    `focusedView == ${GLOBAL_TREE_VIEW.ID}`
                ].join(' ')
            },
            {
                command: COMMAND_IDS.OPEN_PROJECT_TASKS_FILE,
                key: 'f7',
                when: [
                    `focusedView == ${PROJECT_TREE_VIEW.ID}`,
                    `&& ${WHEN_CONTEXT.PROJECT_TREE_VIEW_SELECTED_NODE_TYPE} != RunnableNode`
                ].join(' ')
            },
            {
                command: COMMAND_IDS.OPEN_TASK_DEFINITION,
                key: 'f7',
                when: [
                    `focusedView == ${PROJECT_TREE_VIEW.ID}`,
                    `&& ${WHEN_CONTEXT.PROJECT_TREE_VIEW_SELECTED_NODE_TYPE} == RunnableNode`
                ].join(' ')
            },
            {
                command: COMMAND_IDS.FORCE_FULL_REFRESH,
                key: 'f12',
                when: `focusedView =~ /^${VIEW_CONTAINER_ID}/`
            }
        ],
        configuration: [
            {
                title: DISPLAY_NAME,
                type: 'object',
                properties: {
                    [SETTING_IDS.FILTERING.SHOW_GLOBAL_TASKS]: {
                        type: 'boolean',
                        scope: 'window',
                        default: true,
                        markdownDescription: 'Show the "Global Tasks" view in the panel',
                        order: order.nextIn('configuration'),
                    },
                }
            },
            {
                title: 'Display',
                description: 'Visual appearance, hierarchy structure, and icon settings for tasks in the explorer.',
                order: order.nextIn('configuration'),
                type: 'object',
                properties: {
                    [SETTING_IDS.DISPLAY.SEGMENT_SEPARATOR]: {
                        type: 'string',
                        scope: 'resource',
                        default: '',
                        pattern: '^$|^[^\\p{L}\\p{N}\\s]$', //'^$|^[^\\p{L}\\p{N}\\s]$|.{2,}',
                        patternErrorMessage: 'Must be a single non-alphanumeric, non-whitespace character (or empty to disable)',
                        maxLength: 1,
                        markdownDescription: MD([
                            'Character for splitting task labels into hierarchical segments.',
                            'For example, `:` organizes `build:dev:watch` into a tree: `build` → `dev` → `watch`.',
                            'The separator is ignored at the start/end of labels, in consecutive occurrences, or',
                            'when adjacent to whitespace (e.g., `:build::dev : watch:` remains unsplit). Leave empty',
                            'to disable hierarchy. ',
                            '\nMust be a single non-alphanumeric, non-whitespace character or empty. ',
                            `\nSee also \`#${SETTING_IDS.DISPLAY.GROUP_BY_TASK_GROUP}#\`.`
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING_IDS.DISPLAY.GROUP_BY_TASK_GROUP]: {
                        type: 'boolean',
                        scope: 'resource',
                        default: false,
                        markdownDescription: MD([
                            'Groups tasks by their `group` property. For example, tasks with `"group": "build"` or',
                            '`"group": { kind: "build" }` will be placed under a `Build` folder (the group name will',
                            `be capitalized). Works independently or combined with \`#${SETTING_IDS.DISPLAY.SEGMENT_SEPARATOR}#\`. `,
                            '\n**Note:** When combined, both grouping and splitting apply: a task named `Build:dev:watch` with',
                            '`"group": "build"` and separator `:` creates `Build` → `Build` → `dev` → `watch`.'
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING_IDS.DISPLAY.USE_FOLDER_ICON]: {
                        type: 'boolean',
                        scope: 'resource',
                        default: false,
                        description: MD([
                            'Display folder icon for intermediate segments in the task hierarchy.',
                            'Otherwise, no icon is applied.'
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING_IDS.DISPLAY.DEFAULT_ICON_NAME]: {
                        type: 'string',
                        scope: 'resource',
                        default: 'tools',
                        enum: [...getCodiconsList()],
                        markdownEnumDescriptions: [...getCodiconsList().map(i => `$(${i})`)],
                        markdownDescription: MD([
                            'Icon name for tasks without a custom icon in their definition. Defaults to `tools`. ',
                            '\nTip: use `blank` for an empty icon. ',
                            '\n[Available icons list](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing).'
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING_IDS.DISPLAY.TINT_LABEL]: {
                        type: "boolean",
                        scope: "resource",
                        default: false,
                        markdownDescription: "Apply the task icon color to the task label as well.",
                        order: order.nextIn('configuration.display'),
                    }
                }
            },
            {
                title: 'Filtering',
                description: 'Control which tasks and workspace folders are visible in the explorer.',
                order: order.nextIn('configuration'),
                type: 'object',
                properties: {
                    [SETTING_IDS.FILTERING.SHOW_HIDDEN]: {
                        type: 'boolean',
                        scope: 'resource',
                        default: false,
                        markdownDescription: 'Show tasks marked with `"hide": true` in the task tree.',
                        order: order.nextIn('configuration.filtering'),
                    },
                    [SETTING_IDS.FILTERING.EXCLUDE_FOLDERS]: {
                        type: 'array',
                        items: {
                            type: 'string',
                            uniqueItems: true
                        },
                        uniqueItems: true,
                        scope: 'window',
                        default: [],
                        markdownDescription: MD([
                            'Workspace folders to hide from the task explorer.',
                            'Each entry should match the folder’s display name as shown by VS Code —',
                            'not the directory name on disk. ',
                            '\nAlso accepts the workspace scope name (e.g. `"my-project (Workspace)"`).'
                        ]),
                        order: order.nextIn('configuration.filtering')
                    }
                }
            },
            {
                title: 'Task Definition Issues',
                markdownDescription: 'Enable diagnostics to surface potential issues with task definitions.',
                order: order.nextIn('configuration'),
                type: 'object',
                properties: {
                    [SETTING_IDS.DIAGNOSTICS_SHADOWED_TASKS]: {
                        type: 'boolean',
                        scope: 'window',
                        default: true,
                        markdownDescription: MD([
                            'When enabled, flags task definitions that share the same label but cannot',
                            'all be reached — either because a higher-priority origin shadows them,',
                            'or because multiple definitions within a same origin conflict with each other.'
                        ]),
                        order: order.nextIn('configuration.definition-issues')
                    },
                    [SETTING_IDS.DIAGNOSTICS_UNREACHABLE_DEPENDENCIES]: {
                        type: 'boolean',
                        scope: 'window',
                        default: true,
                        markdownDescription: MD([
                            'When enabled, flags tasks whose `dependsOn` references cannot be resolved —',
                            'either because the target task does not exist, or because it is not reachable',
                            'from the current resolution scope.'
                        ]),
                        order: order.nextIn('configuration.definition-issues')
                    }
                }
            }
        ]
    },
    dependencies: {
        ...readDependencies()
    },
    scripts: undefined
};

// Запись в MANIFEST_FILE
try {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(MANIFEST, null, 4) + '\n', 'utf-8');
} catch (err) {
    console.error(`Failed to write manifest to ${MANIFEST_FILE}: ${(err as Error).message}`);
    process.exit(1);
}
