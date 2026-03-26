/** @file Cockpit/Tree/FolderRoots.ts */
/** @module FolderRoots */

import type * as TC from '../../types';
import Hierarchy from './Hierarchy';
import Splitter from './Splitter';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


const FolderRoots = {

    /** Строит дерево корневых узлов для заданных scope(s).
     *
     * Scope без записей в `tasksByFile` или `settingsByFile` пропускается
     * (находится вне проекта).
     *
     * @param scopes Список scope-записей
     * @param definitionsByFile Карта задач по файлу задач
     * @param settingsByFile Карта resource-настроек по файлу задач
     * @param excludeNames Список имен каталогов, которые будут помечены как скрытые ({@linkcode FolderRoots.RootNode.hidden} = `true`)
     * @returns Результат построения {@linkcode FolderRoots.RootNode} */
    build: function (
        scopes: ReadonlyArray<Readonly<TC.Scope>>,
        definitionsByFile: Readonly<TC.DefinitionsByFile>,
        settingsByFile: Readonly<TC.SettingsByFile>,
        excludeNames?: ReadonlyArray<string>,
    ): ReadonlyArray<FolderRoots.RootNode> {

        const roots: FolderRoots.RootNode[] = [];

        for (const scope of scopes) {

            // #region DEBUG
            log(LogLevel.Debug, `Building root node for "${scope.name}"`);
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

            const rootNode = buildRootNode(
                scope,
                scopedTasks,
                scopedSettings.branchConfig,
                excludeNames
            );

            roots.push(rootNode);
        }

        return roots;
    },


    // #region DEBUG

    printTree: function (roots: FolderRoots.RootNode[]): void {

        const printBranch = (nodes: ReadonlyArray<Hierarchy.Node<TC.TaskDefinition, TC.File>>, prefix: string): void => {

            nodes.forEach((node, i) => {
                const last = i === nodes.length - 1;
                const branch = last ? '└─ ' : '├─ ';
                const child = last ? '   ' : '│  ';

                const mark = Hierarchy.Node.isData(node) ? '{*}' : '';

                log(LogLevel.Debug, `${prefix}${branch}${Hierarchy.Node.getSegment(node)} ${mark}`);

                const children = Hierarchy.Node.getChildren(node);
                if (children.length) {
                    printBranch(children, prefix + child);
                }

            });
        };

        for (const root of roots) {
            log(LogLevel.Debug, `◉ ${root.name}`);
            printBranch(root.children, '');
        }
    },

    // #endregion DEBUG

} as const;

/** Возвращает корневой узел дерева задач для заданного scope с
 * дополнительной информацией.
 *
 * @param scope информация о scope (файл задач)
 * @param scopedDefinitions карта задач, определенных в этом scope
 * @param config конфигурация ветки (branch config)
 * @returns объект с корневым узлом дерева этой scope  */
function buildRootNode(
    scope: TC.Scope,
    scopedDefinitions: Readonly<TC.ScopedDefinitions>,
    config: Readonly<TC.BranchConfig>,
    excludeNames?: ReadonlyArray<string>
): FolderRoots.RootNode {

    const tasksFile = scope.uri.fsPath;

    return {
        name: scope.name,
        hidden: excludeNames?.includes(scope.name) ?? false,
        tasksFile,
        kind: tasksFile.endsWith('.json') ? 'Folder' : 'Workspace',
        children: Hierarchy.build<TC.TaskDefinition, TC.File>(
            tasksFile,
            makeBranchSpecs(scopedDefinitions, config)
        )
    };
}


/** Создает массив спецификаций веток на основе карты задач и настроек ресурса.
 *
 * @param definitionMap Карта задач, где ключ - имя задачи, а значение - сама задача
 * @param config Настройки ресурса
 * @returns Массив спецификаций ветки */
function makeBranchSpecs(
    definitionMap: ReadonlyMap<TC.Name, TC.TaskDefinition>,
    config: Readonly<TC.BranchConfig>,
): ReadonlyArray<Hierarchy.Spec<TC.TaskDefinition>> {

    const splitter = new Splitter(config.segmentSeparator);

    const branchSpecs: Hierarchy.Spec<TC.TaskDefinition>[] = [];

    for (const [name, taskDefinition] of definitionMap) {

        branchSpecs.push({
            // Если `useGroupKind === true`, и у задачи есть группа, то
            // то первым сегментом будет название группы. Это поведение не зависит от
            // значения `segmentSeparator`.
            // Остальные сегменты получаются разбиванием `name` по `segmentSeparator`.
            // See: {@linkcode Splitter}
            segments: (config.useGroupKind && taskDefinition.group?.kind)
                ? [taskDefinition.group.kind, ...splitter.split(name)]
                : splitter.split(name),
            data: taskDefinition
        });
    }

    return branchSpecs;
}


declare namespace FolderRoots {
    export interface RootNode {
        /** Отображаемое имя корня (имя папки или workspace). */
        name: string;
        /** Файл задач (строковый идентификатор), определяющий этот scope. */
        tasksFile: TC.File;
        kind: 'Workspace' | 'Folder';
        /** Дочерние узлы первого уровня. */
        children: Readonly<Hierarchy.TopNodeArray<TC.TaskDefinition, TC.File>>;
        /** Признак скрытия. `true` — если имя директории в списке исключений в настройках. */
        hidden: boolean;
    }
}

export default FolderRoots;
