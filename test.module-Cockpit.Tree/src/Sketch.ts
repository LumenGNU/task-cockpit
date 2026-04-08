import * as vscode from 'vscode';
import * as TC from './types';
import helpers from './helpers';

// @fixme валидация

// /** Пользовательская иконка для задачи. */
// export interface IconDefinition {
//     /** Идентификатор иконки */
//     id?: string,
//     /** Цвет иконки */
//     color?: string;
// }
// /** Описание задачи.
//  *
//  * Описывает пользовательские поля задачи, которые не
//  * предоставляются через API vscode.Task. */
// export interface TaskDefinition {
//     /** Флаг скрытия задачи из палитры задач */
//     hidden: boolean | undefined;
//     /** Пользовательская иконка для задачи */
//     icon: IconDefinition;
//     id: TaskID;
//     rejectFlag?: boolean;
//     isBackground?: boolean;
//     group?: {
//         /** Капитализированное имя группы */
//         kind: Group;
//         isDefault: boolean;
//     };
// }
// /** Параметры, определяющие структуру ветки дерева для scope. */
// export interface TreeConfig {
//     /** Символ-разделитель для разбиения label на сегменты иерархии.
//      * `false` — иерархия отключена. */
//     readonly segmentSeparator: string | false;
//     /** Группировать ли задачи по свойству `group`. */
//     readonly useGroupKind: boolean;
//     /** Показывать ли задачи с `hide: true`. */
//     readonly showHidden: boolean;
// }
// /** Параметры, определяющие визуальное отображение элементов дерева. */
// export interface NodeConfig {
//     /** Показывать ли иконку папки для промежуточных (intermediate) узлов. */
//     readonly useFolderIcon: boolean;
//     /** Имя иконки по умолчанию для задач без кастомной иконки. */
//     readonly defaultIconName: string;
//     /** Окрашивать ли label задачи в цвет её иконки. */
//     readonly tintLabel: boolean;
// }

// @fixme ?? для скетча не использовать TC типы как входные ??
interface Sketch {
    scopes: Record<string, string>;
    definitions: Record<TC.File, Record<TC.Name, TC.TaskDefinition>>;
    treeConfig?: TC.TreeConfig; // @todo значения по умолчанию
    nodeConfig?: TC.NodeConfig; // @todo значения по умолчанию
    favorites?: {
        visibility: 'AUTO' | 'HIDE';
        compressionBehavior: 'NORMAL' | 'SMART';
        refs?: { folder: string; label: string; }[];
        stales?: { folder: string; label: string; }[];
    };
    excludeFolders?: string[];
    asciiTree?: string[]; // @todo // @todo нужен трим в конце
}


function buildDefinition(file: TC.File, name: TC.Name, def?: Partial<TC.TaskDefinition>): TC.TaskDefinition {
    return {
        id: helpers.buildId(file, name),
        icon: def?.icon ?? {},
        group: def?.group,
        hidden: def?.hidden,
        isBackground: def?.isBackground,
        rejectFlag: def?.rejectFlag
    };
}


function buildDefinitions(file: TC.File, tasks: ReadonlyArray<Readonly<{ name: string, def?: Partial<TC.TaskDefinition>; }>>): Record<TC.File, Record<TC.Name, TC.TaskDefinition>> {
    const j: Record<TC.Name, TC.TaskDefinition> = {};
    for (const { name: _name, def } of tasks) {
        const name = _name as TC.Name;
        j[name] = buildDefinition(file, name, def);
    }
    return {
        [file]: j
    };
}

// --- Парсер сценария → аргументы Entity.buildEntities ---

export function parseSketch(json: {
    scopes: Record<string, string>;
    tasks: Record<string, { name: string;[k: string]: unknown; }[]>;
    treeConfig: TC.TreeConfig;
    nodeConfig: TC.NodeConfig;
    favorites?: Sketch['favorites'];
    excludeFolders?: string[];
}) {

    const s = fromJSON(json);

    const folderScopes = new Map<string, TC.Scope>();
    for (const [name, fsPath] of Object.entries(s.scopes)) {
        const uri = vscode.Uri.file(fsPath) as TC.Uri;
        folderScopes.set(name, { name: name as TC.FolderName, uri });
    }

    const scopes: ReadonlyArray<TC.Scope> = [...folderScopes.values()];

    const definitionMap: TC.DefinitionsByFile = new Map();
    for (const [_file, defs] of Object.entries(s.definitions)) {
        const file = _file as TC.File;
        const scopedDefs: TC.ScopedDefinitions = new Map();
        for (const [name, definition] of Object.entries(defs)) {
            scopedDefs.set(name as TC.Name, definition);
        }
        definitionMap.set(file, scopedDefs);
    }

    const treeConfigMap: TC.TreeConfigByFile = new Map(
        Object.keys(s.definitions).map(file => [file as TC.File, s.treeConfig]),
    );

    const nodeConfigMap: TC.NodeConfigByFile = new Map(
        Object.keys(s.definitions).map(file => [file as TC.File, s.nodeConfig]),
    );

    const toRef = (f: { folder: string; label: string; }): TC.FavoriteRef => ({
        scope: folderScopes.get(f.folder)!,
        label: f.label as TC.Name,
    });

    const favoritesConfig: TC.FavoritesConfig = {
        visibility: s.favorites?.visibility ? (s.favorites.visibility === 'HIDE' ? TC.FavoritesVisibility.HIDE : TC.FavoritesVisibility.AUTO) : TC.FavoritesVisibility.AUTO,
        compressionBehavior: s.favorites?.compressionBehavior ? (s.favorites.compressionBehavior === 'SMART' ? TC.CompressionBehavior.SMART : TC.CompressionBehavior.NORMAL) : TC.CompressionBehavior.NORMAL,
        favoriteRecords: s.favorites?.refs?.map(toRef) ?? [],
        staleRecords: s.favorites?.stales?.map(f => ({ label: f.label, scopeName: f.folder })) ?? [],
    };

    const excludeFolders = new Set(
        (s.excludeFolders ?? []).map(n => n as TC.FolderName),
    );

    return { scopes, favoritesConfig, definitionMap, treeConfigMap, nodeConfigMap, excludeFolders };
}


function fromJSON(json: {
    scopes: Record<string, string>;
    tasks: Record<string, { name: string;[k: string]: unknown; }[]>;
    treeConfig: TC.TreeConfig;
    nodeConfig: TC.NodeConfig;
    favorites?: Sketch['favorites'];
    excludeFolders?: string[];
}): Sketch {
    const definitions: Record<TC.File, Record<TC.Name, TC.TaskDefinition>> = {};

    for (const [file, taskList] of Object.entries(json.tasks)) {
        Object.assign(definitions, buildDefinitions(
            file as TC.File,
            taskList.map(t => ({ name: t.name, def: t as Partial<TC.TaskDefinition> })),
        ));
    }

    return {
        scopes: json.scopes,
        definitions,
        treeConfig: json.treeConfig,
        nodeConfig: json.nodeConfig,
        favorites: json.favorites,
        excludeFolders: json.excludeFolders,
    };
}