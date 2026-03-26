/** @file Cockpit/Tree/Folders.ts */
/** @module Folders */

import type * as TC from '../../types';
import Hierarchy from './Hierarchy';
import Splitter from './Splitter';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


const Folders = {

    /** Строит дерево корневых узлов для заданных scope(s).
     *
     * Scope без записей в `tasksByFile` или `` пропускается
     * (находится вне проекта).
     *
     * @param scopes Список scope-записей
     * @param definitionsByFile Карта задач по файлу задач
     * @param 
     * @param excludeNames Список имен каталогов, которые будут помечены как скрытые ({@linkcode Entity.hidden} = `true`)
     * @returns Результат построения {@linkcode Entity} */
    buildEntities(
        scopes: ReadonlyArray<Readonly<TC.Scope>>,
        definitionsByFile: Readonly<TC.DefinitionsByFile>,
        branchConfigByFile: Readonly<TC.BranchConfigByFile>,
        excludeNames?: ReadonlyArray<string>,
    ): ReadonlyArray<Folders.Entity> {

        const roots: Folders.Entity[] = [];

        for (const scope of scopes) {

            // #region DEBUG
            log(LogLevel.Debug, `Building root node for "${scope.name}"`);
            // #endregion DEBUG

            const file = scope.uri.fsPath;

            const scopedTasks = definitionsByFile.get(file);
            const scopedBranchConfig = branchConfigByFile.get(file);
            if (!scopedTasks || !scopedBranchConfig) {

                // #region DEBUG
                log(LogLevel.Warning, `Scope "${scope.name}" has no tasks or resource settings (outside the project scope)`);
                // #endregion DEBUG

                continue;
            }

            const rootNode = buildRootNode(
                scope,
                scopedTasks,
                scopedBranchConfig,
                excludeNames
            );

            roots.push(rootNode);
        }

        return roots;
    },


    Entity: {
        Child: {

            isRunnable: Hierarchy.Node.isData<TC.TaskDefinition, TC.File> as (node: Readonly<Folders.Entity.Child>) => node is typeof node & TC.TaskDefinition,

            isGroup: Hierarchy.Node.isBranch<TC.TaskDefinition, TC.File> as (node: Readonly<Folders.Entity.Child>) => node is Hierarchy.ActuallyBranch<TC.TaskDefinition, TC.File>,

            getChildren(
                node: Hierarchy.ActuallyBranch<TC.TaskDefinition, TC.File>
            ): Array<Readonly<Folders.Entity.Child>> {
                return Hierarchy.Node.getBranchChildren(node);
            }

        } as const,
    } as const,
} as const;


declare namespace Folders {

    export interface Entity {
        readonly name: string;
        readonly tasksFile: TC.File;
        readonly kind: 'Workspace' | 'Folder';
        readonly hidden: boolean;
        readonly lookup: (...segments: ReadonlyArray<string>) => Folders.Entity.Child | undefined;
        readonly children: Array<Folders.Entity.Child>
    }

    export namespace Entity {
        export type Child = Hierarchy.Node<TC.TaskDefinition, TC.File>;
    }

}

export default Folders;


// ===


/** Возвращает корневой узел дерева задач для заданного scope.
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
): Folders.Entity {

    const dict = Hierarchy.build<TC.TaskDefinition, TC.File>(
        scope.uri.fsPath,
        makeBranchSpecs(scopedDefinitions, config)
    );

    return {
        name: scope.name,
        hidden: excludeNames?.includes(scope.name) ?? false,
        tasksFile: scope.uri.fsPath,
        kind: scope.uri.fsPath.endsWith('.json') ? 'Folder' : 'Workspace',
        lookup(...segments: ReadonlyArray<string>) {
            return Hierarchy.lookup(dict, segments);
        },
        get children() {
            return Object.values(dict);
        }
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


// #region DEBUG

export function printTree(entities: ReadonlyArray<Folders.Entity>): void {

    const printBranch = (nodes: ReadonlyArray<Folders.Entity.Child>, prefix: string): void => {

        nodes.forEach((node, i) => {
            const last = i === nodes.length - 1;
            const branch = last ? '└─ ' : '├─ ';
            const child = last ? '   ' : '│  ';

            const mark = Folders.Entity.Child.isRunnable(node) ? '{*}' : '';

            log(LogLevel.Debug, `${prefix}${branch}${Hierarchy.Node.getSegment(node)} ${mark}`);

            if (Folders.Entity.Child.isGroup(node)) {
                const children = Folders.Entity.Child.getChildren(node);
                printBranch(children, prefix + child);
            }

        });
    };

    for (const entity of entities) {
        log(LogLevel.Debug, `◉ ${entity.name}`);
        printBranch(entity.children, '');
    }
}


// #endregion DEBUG



