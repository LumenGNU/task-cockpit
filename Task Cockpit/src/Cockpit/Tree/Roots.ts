/** @file Cockpit/Tree/Roots.ts */
/** @module Roots */

import type * as TC from '../../types';
import Builder from './Builder';
import Splitter from './Splitter';
// import helpers from '../../helpers';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


/** Базовый интерфейс корневого узла (общий для folder и workspace root). */
interface RootNodeType {
    /** Отображаемое имя корня (имя папки или workspace). */
    segment: string;
    /** Файл задач, определяющему этот scope. */
    tasksFile: TC.File;
    kind: 'Workspace' | 'Folder';
    /** Дочерние узлы первого уровня. */
    children: (Builder.DataNode<TC.TaskDefinition, TC.File> | Builder.InternodeNode<TC.TaskDefinition, TC.File>)[];
    hide: boolean;
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
 * @param definitionsByFile Карта задач по файлу задач
 * @param settingsByFile Карта resource-настроек по файлу задач
 * @param windowSettings Window-настройки (общие для всего workspace)
 * @returns Результат построения {@linkcode SproutResultType} */
function sprout(
    scopes: ReadonlyArray<Readonly<TC.Scope>>,
    definitionsByFile: Readonly<TC.DefinitionsByFile>,
    settingsByFile: Readonly<TC.SettingsByFile>,
    windowSettings: Readonly<TC.WindowSettings>, // @todo тут просто excludeFolders
): ReadonlyArray<RootNodeType> {

    const roots: RootNodeType[] = [];

    for (const scope of scopes) {

        // #region DEBUG
        log(LogLevel.Debug, `Sprout root node for "${scope.name}"`);
        // #endregion DEBUG

        const file = scope.uri.fsPath;

        const scopedTasks = definitionsByFile.get(file);

        const scopedSettings = settingsByFile.get(file);

        if (!scopedTasks || !scopedSettings) {

            // #region DEBUG
            log(LogLevel.Warning, `Scope "${scope.name}" has no tasks or resource settings (outside the project scope)`);
            // #endregion DEBUG

            continue;
        }

        const rootNode = sproutRootNode(
            scope,
            scopedTasks,
            scopedSettings.branchConfig,
            windowSettings.excludeFolders
        );

        roots.push(rootNode);
    }

    // // #region DEBUG
    // if (isMultiRoot) {
    //     const totalTasks = [...detailsByFile.values()].reduce((s, d) => s + d.all, 0);
    //     const totalHidden = [...detailsByFile.values()].reduce((s, d) => s + d.hidden, 0);
    //     log(LogLevel.Debug,
    //         `Sprouted ${roots.length} root node(s)` +
    //         ` (${workspaceDetail!.all} folders, ${workspaceDetail!.excludes} excluded).` +
    //         ` Tasks total: ${totalTasks}, hidden: ${totalHidden}`
    //     );
    // }
    // else {
    //     const [detail] = detailsByFile.values();
    //     if (detail) {
    //         log(LogLevel.Debug,
    //             `Sprouted root node. Tasks total: ${detail.all}, hidden: ${detail.hidden}`
    //         );
    //     }
    // }

    // printTree(roots);
    // // #endregion DEBUG

    return roots;
};


/** Возвращает корневой узел дерева задач для заданного scope с
 * дополнительной информацией.
 *
 * @param scope информация о scope (файл задач)
 * @param scopedDefinition карта задач, относящих к scope
 * @param configs конфигурация ветки (branch config)
 * @returns объект с корневым узлом дерева и доп. информацией
 *   (количеством обнаруженных скрытых задач)  */
function sproutRootNode(
    scope: TC.Scope,
    scopedDefinition: Readonly<TC.ScopedDefinition>,
    configs: Readonly<TC.BranchConfig>,
    excludeFolders?: ReadonlyArray<string>
): RootNodeType {

    const tasksFile = scope.uri.fsPath;

    const branch = Builder.build<TC.TaskDefinition, TC.File>(
        tasksFile,
        makeBranchSpec(scopedDefinition, configs)
    );

    return {
        segment: scope.name,
        hide: excludeFolders?.includes(scope.name) ?? false,
        tasksFile,
        kind: tasksFile.endsWith('.json') ? 'Folder' : 'Workspace',
        children: branch
    };
}


/** Создает массив спецификаций ветки на основе карты задач и настроек ресурса.
 *
 * Если в настройках `showHidden === true`, то скрытые задачи попадут в спецификации,
 * `hiddenCount` — не будет увеличиваться.
 *
 * @param tasksDefinitionMap Карта задач, где ключ - имя задачи, а значение - сама задача
 * @param configs Настройки ресурса
 * @returns Массив спецификаций ветки + количество скрытых задач */
function makeBranchSpec(
    tasksDefinitionMap: ReadonlyMap<TC.Name, TC.TaskDefinition>,
    configs: Readonly<TC.BranchConfig>,
): Builder.Spec<TC.TaskDefinition>[] {

    const splitter = new Splitter(configs.segmentSeparator);
    const branchSpec: Builder.Spec<TC.TaskDefinition>[] = [];

    for (const [name, taskDefinition] of tasksDefinitionMap) {

        // Если `useGroupKind === true`, и у задачи есть группа, то
        // то первым сегментом будет название группы. Это поведение не зависит от
        // значения `segmentSeparator`.
        // Остальные сегменты получаются разбиванием `name` по `segmentSeparator`.
        // See: {@linkcode Splitter}
        const internodes =
            (configs.useGroupKind && taskDefinition.group?.kind)
                ? [taskDefinition.group.kind, ...splitter.split(name)]
                : splitter.split(name);

        branchSpec.push({
            segments: internodes,
            data: taskDefinition
        });
    }

    return branchSpec;
}


/** Переключает узел в чистый сегмент. (Отбирается возможность быть Runnable)
 * Возвращает `true`, если узел имеет потомков.
 * False — если нет.
 *
 * @affects `id` У узла удаляется свойство `id`. */
function switchToBranch(node: Builder.DataNode<TC.TaskDefinition, TC.File> | Builder.InternodeNode<TC.TaskDefinition, TC.File>): boolean {
    if (Builder.Node.isBranch(node)) {
        return false;
    } else {
        delete (node as Partial<TC.TaskDefinition>).id;
        return true;
    }
}


/** Рекурсивно вычистить ветку: удалить скрытые ноды (при `removeHidden`)
 * и промежуточные узлы, оставшиеся без потомков, и не являющиеся Runnable+не скрытыми.
 *
 * Отростки:
 * - Branch, нет детей → полное удаление.
 * - Runnable + Branch, +видимый, но все дети вырезаны → остаётся как Runnable.
 * - Runnable + Branch, +скрытый, дети выжили → становится чистой папкой.
 * - Runnable + Branch, +скрытый, дети не выжили → полное удаление.
 *
 * @affects root
 *
 * @returns { total: number; displayed: number; }
 *   - `total` — все Runnable в поддереве (включая скрытые/удалённые)
 *   - `displayed` — только выжившие после отсечения */
function pruneBranch(
    root: RootNodeType,
    showHidden: boolean
): { total: number; displayed: number; } {

    const removeHidden = !showHidden;

    let total = 0;
    let displayed = 0;

    const prune = (node: RootNodeType | Builder.DataNode<TC.TaskDefinition, TC.File> | Builder.InternodeNode<TC.TaskDefinition, TC.File>) => {
        node.children = node.children?.filter((child) => {

            if (Builder.Node.isBranch(child)) {
                // есть дети, но возможно и Runnable
                prune(child); // рекурсия по потомкам
            }
            if (Tree.Node.isRunnable(child)) {
                total++;
                if (child.hidden && removeHidden) {
                    // Если узел имеет потомков — теперь будет отображаться как
                    // чистый сегмент (true). Или будет полностью исключен (false).
                    return switchToBranch(child);
                }
                displayed++;
                return true; // видимый Runnable — всегда оставить, даже без детей
            }
            // чистый Segment — оставить только если есть потомки
            // Если рекурсия вычистила всех потомков — удаляется
            return !!child.children.length;
        });

    };

    prune(root);

    return { total, displayed };
}

// #region DEBUG

function printTree(roots: RootNodeType[]): void {

    const printBranch = (nodes: ReadonlyArray<Builder.DataNode<TC.TaskDefinition, TC.File> | Builder.InternodeNode<TC.TaskDefinition, TC.File>>, prefix: string): void => {

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
    export type RootNode = RootNodeType;
}

const Roots = {

} as const;

export default Roots;
