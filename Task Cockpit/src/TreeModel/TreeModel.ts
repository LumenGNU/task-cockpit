


import {
    EventEmitter,
    Event,
    Disposable
} from 'vscode';
import type NodeId from '../TreeView/NodeId';
import type ProjectMap from '../ProjectSpace/ProjectMap';
import type PinMap from '../UserState/PinMap';



interface NodeEntry<T> {
    data: T;
    parentId: NodeId | null;
}


class TreeModel<T extends { readonly id: NodeId; }> implements Disposable {


    private readonly _entries = new Map<NodeId, NodeEntry<T>>();
    readonly #childIndex = new Map<NodeId | null, NodeId[]>();


    readonly #onDidChange: EventEmitter<T | undefined>;
    readonly onDidChange: Event<T | undefined>;


    constructor() {

        this.#onDidChange = new EventEmitter<T | undefined>();
        this.onDidChange = this.#onDidChange.event;
    }


    dispose(): void {
        this.#onDidChange.dispose();
    }


    // #region Навигация


    getChildren(parentId?: NodeId | undefined): T[] {
        return (this.#childIndex.get(parentId) ?? [])
            .map(id => this._entries.get(id)!.data);
    }


    getParent(id: NodeId): T | undefined {
        const parentId = this._entries.get(id)?.parentId;
        if (parentId == null) return undefined;
        return this._entries.get(parentId)?.data;
    }

    get(id: NodeId): T | undefined {
        return this._entries.get(id)?.data;
    }

    has(id: NodeId): boolean {
        return this._entries.has(id);
    }

    // #endregion Навигация

    // Мутации -------------------------------

    // insert(data: T, parentId: NodeId | null = null): void {
    //     this._entries.set(data.id, { data, parentId });
    //     const bucket = this._childIndex.get(parentId) ?? [];
    //     bucket.push(data.id);
    //     this._childIndex.set(parentId, bucket);
    // }

    // update(data: T): void {
    //     const entry = this._entries.get(data.id);
    //     if (entry) entry.data = data;
    // }

    // delete(id: NodeId): void {
    //     this._deleteSubtree(id);
    // }

    // clear(): void {
    //     this._entries.clear();
    //     this._childIndex.clear();
    // }


    update({
        projectMap,
        pinsMap
    }: {
        projectMap: ProjectMap,
        pinsMap: PinMap;
    }) {

    }


    // Оповещение -----------------------------─

    /** Без аргумента — полный рефреш дерева. */
    invalidate(node?: T): void {
        this.#onDidChange.fire(node);
    }

    // Служебное ------------------------------

    // private _deleteSubtree(id: NodeId): void {
    //     for (const childId of this.#childIndex.get(id) ?? []) {
    //         this._deleteSubtree(childId);
    //     }

    //     const entry = this._entries.get(id);
    //     if (entry) {
    //         const siblings = this.#childIndex.get(entry.parentId) ?? [];
    //         this.#childIndex.set(entry.parentId, siblings.filter(s => s !== id));
    //     }

    //     this._entries.delete(id);
    //     this.#childIndex.delete(id);
    // }

}
