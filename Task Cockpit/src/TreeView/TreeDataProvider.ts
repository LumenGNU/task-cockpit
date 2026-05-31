import * as vscode from 'vscode';
import type PinsSection from './Section/PinsSection';
import type SubSection from './Section/SubSection';
import ScopeSection from './Section/ScopeSection';
import * as assert from 'node:assert/strict';
import NodeType from './NodeType';
import ContentNode from './Node/ContentNode';
import Snapshot from '../ProjectSpace/Snapshot';
import EmptyNode from './Node/EmptyNode';
import EligibleTask from '../EligibleTask';


type Sections =
    // | PinsSection
    | ScopeSection
    ;

type Child =
    | EmptyNode
    // | SubSection
    | ContentNode
    ;

type Nodes =
    | Sections
    | Child
    ;


export default class TreeDataProvider implements vscode.TreeDataProvider<Readonly<Nodes>> {


    readonly #onDidChangeTreeData = new vscode.EventEmitter<Nodes | void>();
    readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;


    #PinsSection: Readonly<PinsSection> | null = null;


    #workspaceSnapshot?: Snapshot;

    #eligibleCache?: Readonly<EligibleTask.Cache>;

    constructor() { }


    dispose() {
        // @fixme
    }



    public updatePinsSection(PinsSection: Readonly<PinsSection>) {
        this.#PinsSection = PinsSection;
        this.#onDidChangeTreeData.fire(); // @todo
    }


    public updateScopeSections(scopeSections: ReadonlyArray<Readonly<ScopeSection>>) {
        this.#scopeSections = scopeSections;
        this.#onDidChangeTreeData.fire(); // @todo
    }


    async getChildren(element?: Readonly<Nodes>): Promise<Array<Readonly<Nodes>> | null> {


        if (!element) {

            const sections: Array<Readonly<Sections>> = [];

            // первой идет секция с закрепленными задачами
            // если отображение разрешено и **не пуста**
            if (this.#PinsSection) {
                sections.push(this.#PinsSection);
            }

            // потом секции по scope
            // @note "workspace первым" — структурный инвариант входных данных.
            if (this.#workspaceSnapshot) {

                for (const [scopeKey, scopeInput] of this.#workspaceSnapshot) {
                    sections.push(ScopeSection.create({ scopeKey, scopeInput }));
                }
            }

            // Если в итоге пусто, то ничего не показываем, все очищаем
            return sections.length > 0 ? sections : null;
        }



        switch (element.typeKey) {

            // // PinsSection
            // case NodeKey.PinsSectionKey: {



            // }

            // SubSection ("Корни" внутри секции "запинованые")
            // Section ("Верхние корни")
            // case NodeKey.SubSectionKey:
            case NodeType.ScopeSection: {

                if (element.hierarchy.length < 1) {
                    return [EmptyNode.create(element)];
                }

                const children: Readonly<ContentNode>[] = [];

                for (const hierarchy of element.hierarchy) {
                    children.push(ContentNode.create(element, {
                        hierarchy,
                        eligibleIndex: await this.#eligibleCache?.get()
                    }));
                }

            }

            default: {
                const _: never = element;
                assert.fail('never give you up...');
            }

        }

    }


    resolveTreeItem(item: vscode.TreeItem, element: Sections, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
        return item;
    }


    getTreeItem(element: Sections): vscode.TreeItem {

    }


    getParent(element: Sections): Sections | null {
        return getParent(element);
    }

}
