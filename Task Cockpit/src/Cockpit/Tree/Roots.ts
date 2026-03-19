/** @file Cockpit/Tree/Roots.ts */
/** @module Roots */

import type * as TC from '../../types';
import Builder from './Builder';
import Splitter from './Splitter';
import helpers from '../../helpers';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


/** Визуальный маркер — нефункциональный узел для отображения состояний */
interface MarkerNodeType {
    /** Тип маркера. */
    markerType: TC.MarkerType;
    /** Файл задач, к которому относится маркер. */
    tasksFile: TC.File;
}


/** Базовый интерфейс корневого узла (общий для folder и workspace root). */
interface RootNodeType {
    /** Отображаемое имя корня (имя папки или workspace). */
    segment: string;
    // /** Файл задач, определяющему этот scope. */
    // tasksFile: TC.File;
    kind: 'Workspace' | 'Folder';
    /** Дочерние узлы первого уровня. */
    children: (Builder.DataNode<TC.___, TC.File> | Builder.InternodeNode<TC.___, TC.File> | MarkerNodeType)[];
}


/** Результат построения дерева корневых узлов. */
interface SproutResultType {
    /** Детализация по файлам задач: общее количество задач и количество скрытых. */
    detailsByFile: Readonly<TC.DetailsByFile>;
    /** Статистика workspace: количество папок и исключённых.
     * Присутствует только в multi-root workspace. */
    workspaceDetail?: Readonly<TC.WorkspaceDetail>;
    /** Корневые узлы дерева. */
    roots: ReadonlyArray<RootNodeType>;
}


/** Строит дерево корневых узлов для заданных scope(s).
 *
 * Для **single-folder workspace** должен передаваться **один** {@linkcode TC.Scope} —
 * `workspaceDetail` в результате будет `undefined`. Настройка из
 * {@linkcode TC.WindowSettings.excludeFolders} игнорируется.
 *
 * Для **multi-root workspace** должен передаваться **массив** {@linkcode TC.Scope} —
 * `workspaceDetail` будет присутствовать и содержать статистику папок.
 *
 * Scope без записей в `tasksByFile` или `settingsByFile` пропускается
 * (находится вне проекта).
 *
 * @param scopes Один scope (single-folder) или массив (multi-root)
 * @param tasksByFile Карта задач по файлу задач
 * @param settingsByFile Карта resource-настроек по файлу задач
 * @param windowSettings Window-настройки (общие для всего workspace)
 * @returns Результат построения {@linkcode SproutResultType} */
function sprout(
    scopes: Readonly<TC.Scope> | ReadonlyArray<Readonly<TC.Scope>>,
    tasksByFile: Readonly<TC.TasksByFile>,
    settingsByFile: Readonly<TC.SettingsByFile>,
    windowSettings: Readonly<TC.WindowSettings>,
): Readonly<SproutResultType> {

    const isMultiRoot = Array.isArray(scopes);
    const scopesArray = isMultiRoot ? scopes : [scopes];

    const roots: RootNodeType[] = [];
    const detailsByFile: TC.DetailsByFile = new Map();
    const workspaceDetail: TC.WorkspaceDetail | undefined = isMultiRoot ? { all: scopesArray.length, excludes: 0 } : undefined;


    for (const scope of scopesArray) {

        // #region DEBUG
        log(LogLevel.Debug, `Sprout root node for "${scope.name}"`);
        // #endregion DEBUG

        if (isMultiRoot && windowSettings.excludeFolders.includes(scope.name)) {
            // исключаемые каталоги имеют смысл только в multi-root workspace`е

            // #region DEBUG
            log(LogLevel.Debug, `Scope "${scope.name}" is excluded by user settings`);
            // #endregion DEBUG

            workspaceDetail!.excludes += 1;

            continue;
        }

        const file = scope.uri.fsPath;

        const scopedTasks = tasksByFile.get(file);

        const scopedSettings = settingsByFile.get(file);

        if (!scopedTasks || !scopedSettings) {

            // #region DEBUG
            log(LogLevel.Warning, `Scope "${scope.name}" has no tasks or resource settings (outside the project scope)`);
            // #endregion DEBUG

            continue;
        }

        const { rootNode, hiddenCount } = sproutRootNode(scope, scopedTasks, scopedSettings.branchConfig);

        detailsByFile.set(file, { all: scopedTasks.size, hidden: hiddenCount });
        roots.push(rootNode);
    }

    // #region DEBUG
    if (isMultiRoot) {
        const totalTasks = [...detailsByFile.values()].reduce((s, d) => s + d.all, 0);
        const totalHidden = [...detailsByFile.values()].reduce((s, d) => s + d.hidden, 0);
        log(LogLevel.Debug,
            `Sprouted ${roots.length} root node(s)` +
            ` (${workspaceDetail!.all} folders, ${workspaceDetail!.excludes} excluded).` +
            ` Tasks total: ${totalTasks}, hidden: ${totalHidden}`
        );
    }
    else {
        const [detail] = detailsByFile.values();
        if (detail) {
            log(LogLevel.Debug,
                `Sprouted root node. Tasks total: ${detail.all}, hidden: ${detail.hidden}`
            );
        }
    }

    printTree(roots);
    // #endregion DEBUG

    return {
        detailsByFile,
        workspaceDetail,
        roots
    };
};


/** Возвращает корневой узел дерева задач для заданного scope с
 * дополнительной информацией.
 *
 * @param scope информация о scope (файл задач)
 * @param tasksMap карта задач, относящих к scope
 * @param configs конфигурация ветки (branch config)
 * @returns объект с корневым узлом дерева и доп. информацией
 *   (количеством обнаруженных скрытых задач)  */
function sproutRootNode(
    scope: TC.Scope,
    tasksMap: ReadonlyMap<TC.Name, Readonly<TC.Task>>,
    configs: Readonly<TC.BranchConfig>,
): {
    hiddenCount: number;
    rootNode: RootNodeType;
} {

    const tasksFile = scope.uri.fsPath;

    const { branchSpec, hiddenCount } = makeBranchSpec(tasksFile, tasksMap, configs);

    const branch = Builder.build<TC.___, TC.File>(tasksFile, branchSpec);

    return {
        hiddenCount,
        rootNode: {
            segment: scope.name,
            kind: tasksFile.endsWith('.json') ? 'Folder' : 'Workspace',
            children: branch.length > 0 ? branch : [mkMarkerEmpty(tasksFile)],
        }
    };
}


/** Создает массив спецификаций ветки на основе карты задач и настроек ресурса.
 *
 * Если в настройках `showHidden === true`, то скрытые задачи попадут в спецификации,
 * `hiddenCount` — не будет увеличиваться.
 *
 * @param tasksMap Карта задач, где ключ - имя задачи, а значение - сама задача
 * @param configs Настройки ресурса
 * @returns Массив спецификаций ветки + количество скрытых задач */
function makeBranchSpec(
    tasksFile: TC.File,
    tasksMap: ReadonlyMap<TC.Name, Readonly<TC.Task>>,
    configs: Readonly<TC.BranchConfig>,
): { branchSpec: Builder.Spec<TC.___>[], hiddenCount: number; } {

    let hiddenCount = 0;

    const splitter = new Splitter(configs.segmentSeparator);
    const branchSpec: Builder.Spec<TC.___>[] = [];

    for (const [name, task] of tasksMap) {

        if (task.hide) {// && !configs.showHidden) {
            hiddenCount++;
            // continue; // @fixme скрывать на уровне вювера
        }

        const internodes =
            // Если `useGroupKind === true`, и у задачи есть группа, то
            // то первым сегментом будет название группы. Это поведение не зависит от
            // значения `segmentSeparator`.
            // Остальные сегменты получаются разбиванием `name` по `segmentSeparator`.
            // See: {@linkcode Splitter}
            (configs.useGroupKind &&
                // @ts-expect-error // поле `label` доступно как минимум с ^1.86.2
                task.vscTask.group?.label)
                ? [
                    // @ts-expect-error // поле `label` доступно  как минимум с ^1.86.2
                    task.vscTask.group.label,
                    ...splitter.split(name)
                ]
                : splitter.split(name);

        branchSpec.push({
            segments: internodes,
            data: { hide: task.hide, icon: task.icon, id: helpers.buildId(tasksFile, name) }
        });
    }

    return {
        hiddenCount,
        branchSpec
    };
}


/** Создаёт "визуальный" маркер (placeholder) для указанного файла задач.
 *
 * @param tasksFile файл задач, для которого создается маркер
 * @returns узел-маркер (placeholder) */
function mkMarkerEmpty(tasksFile: TC.File): MarkerNodeType {
    return {
        tasksFile,
        markerType: 'EMPTY'
    };
}


// #region DEBUG

function printTree(roots: RootNodeType[]): void {

    const printBranch = (nodes: ReadonlyArray<Builder.DataNode<TC.___, TC.File> | Builder.InternodeNode<TC.___, TC.File> | MarkerNodeType>, prefix: string): void => {

        nodes.forEach((node, i) => {
            const last = i === nodes.length - 1;
            const branch = last ? '└─ ' : '├─ ';
            const child = last ? '   ' : '│  ';

            if ('markerType' in node) {
                log(LogLevel.Debug, `${prefix}${branch}[- Marker (${node.markerType}) -]`);
                return;
            }

            // @fixme const mark = node.id ? '{*}' : '';

            // @fixme log(LogLevel.Debug, `${prefix}${branch}${node.segment} ${mark}`);

            if (node.children?.length) {
                printBranch(node.children, prefix + child);
            }

        });
    };

    for (const root of roots) {
        log(LogLevel.Debug, `◉ ${root.segment}`);
        printBranch(root.children, '');
    }
}

// #endregion DEBUG


namespace Roots {
    export type MarkerNode = MarkerNodeType;
    export type RootNode = RootNodeType;
    export type SproutResult = SproutResultType;
}

const Roots = {
    sprout
} as const;

export default Roots;
