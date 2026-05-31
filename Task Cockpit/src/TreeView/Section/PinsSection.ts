

import * as assert from 'node:assert/strict';
import NodeType from '../NodeType';
import SubSection from './SubSection';
import type Definition from '../../ProjectSpace/Scope/Scope.Definitions.fetchDefinitions';
import type HierarchyConfig from '../../Configuration/Scoped/HierarchyConfig';
import type NodeConfig from '../../Configuration/Scoped/NodeConfig';
import type Config from '../../Configuration/Global/Config';
import type Key from '../../ProjectSpace/Scope/Key';
import ContentNode from '../Node/ContentNode';
import {
    type TreeItem,
    ThemeIcon,
    TreeItemCollapsibleState,
    MarkdownString,
    Uri
} from 'vscode';
import type StaleNode from '../Node/StaleNode';
import Pins from '../../UserState/Pins';



declare namespace PinsSection {

    /** Запись о закреплённой задаче, описание которой не было найдено. */
    interface StalePins {
        /** Отображаемое имя задачи. */
        name: string;
        /** Идентификатор рабочей области, к которой относилась задача. */
        scope: string;
    }

    interface ScopedPins {
        scopeKey: Key;
        scopeLabel: string;
        definitions: ReadonlyArray<Readonly<Definition>>;
        nodeConfig: Readonly<NodeConfig>;
        hierarchyConfig: Readonly<HierarchyConfig>;
    }

}


/** Секция закреплённых задач. Всегда идёт первой среди секций. */
interface PinsSection {

    /** Тип узла — секция закреплённых задач. */
    nodeKey: NodeType.PinsSectionKey;


    /** Закреплённые задачи, описания которых не найдены.
     * Отображаются в начале секции как недоступные. */
    stalePins: ReadonlyArray<Readonly<PinsSection.StalePins>>;

    pinsByScope: ReadonlyArray<Readonly<PinsSection.ScopedPins>>;

    pinsConfig: {
        pathCompression: 'off' | 'on' | 'on-aggressive';
    };

}


const PinsSection = {


    /** Строит секцию закреплённых задач, сгруппированных по рабочим областям.
     *
     * Возвращает `null`, если записей нет или отображение закреплённых отключено.
     *
     * @param stalePins записи о задачах, описания которых не найдены
     * @param pinsByScope актуальные закреплённые задачи, сгруппированные по рабочим областям
     * @param projectSettings настройки проекта, определяющие видимость и степень сжатия путей */
    build(
        projectSettings: Readonly<Config>,
        pinsEntries: Readonly<Pins.Entries>
    ): PinsSection | null {

        if (!projectSettings.pinned.visibility) {
            return null;
        }



    },


    getChildren(
        section: Readonly<PinsSection>
    ): Array<Readonly<SubSection | StaleNode>> {

        // Секция PinsSection, если отображается, то никогда **не пустая**.
        // Всегда есть либо пины, либо сломанные пины

        const children: Array<Readonly<SubSection | StaleNode>> = [];

        // сломанные задачи — без группы, первыми
        for (const stale of section.stalePins) {
            StaleNode.build(section, stale);
        }


        // Если суб-секций только одна (закреплены задачи только из одной scope),
        // то скипаем суб-секцию, и сразу показываем ее узлы. иначе —
        // показываем внутри суб-секций. // @fixme только делать это в treeDataProvider

        // section.subSections = pinsByScope.map((input) =>
        //     SubSection.build(section, { ...input, projectSettings })
        // );

        for (const input of section.pinsByScope) {
            SubSection.build(section, { ...input, projectSettings });
        }

        children.push(...section.subSections);


        return children;

    },


    getTreeItem(
        section: Readonly<PinsSection>
    ): TreeItem {

        return {
            // Идентификатор узла. Совпадает с типом — секция всегда одна.
            id: section.nodeKey,
            // Фиксированное имя секции.
            label: 'Pinned',
            iconPath: new ThemeIcon('pinned'), // @todo цвет?
            collapsibleState: TreeItemCollapsibleState.Expanded, // @todo
            tooltip: new MarkdownString('*Pinned*\n  \u00A0', false),
            contextValue: 'task-cockpit:Section:Pinned',
            resourceUri: Uri.from({
                scheme: 'task-cockpit',
                authority: 'Section',
                path: 'Pinned'
            }),
        };
    }

} as const;

export default PinsSection;
