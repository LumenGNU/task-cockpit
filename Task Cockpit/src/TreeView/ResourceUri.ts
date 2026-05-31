import {
    Uri
} from 'vscode';
import type ScopeSection from './Section/ScopeSection';
import type PinsSection from './Section/PinsSection';
import type SubSection from './Section/SubSection';
import type ContentNode from './Node/ContentNode';
import type EmptyNode from './Node/EmptyNode';
import type StaleNode from './Node/StaleNode';
import NodeType from './NodeType';

declare const ___QueryComponent: unique symbol;
declare const ___ResourceUri: unique symbol;

type Query = string & { readonly [___QueryComponent]: never; };

type Special = 'Empty' | 'Broken' | 'Stale';

const taskCockpitScheme = 'task-cockpit';

/** Визуальные метаданные узла дерева, используемые при рендеринге. */
export interface VisualMetadata {
    color?: string | undefined,
    processes?: number,
    running?: number;
    special?: Special;
}


function encodeQuery(queryMetadata: VisualMetadata): Query {
    return encodeURIComponent(JSON.stringify(queryMetadata)) as Query;
}


function decodeQueryComponent(queryComponent: Query): VisualMetadata | undefined {

    const queryMetadata: unknown = JSON.parse(decodeURIComponent(queryComponent));
    if (!queryMetadata || typeof queryMetadata !== 'object') {
        return undefined;
    }
    return queryMetadata;
}


type Authority = 'task' | 'marker';

function resolveMetadata(uri: Uri, ...authorities: Authority[]) {

    if (uri.scheme !== "task-cockpit") {
        return undefined;
    }

    if (authorities.includes(uri.authority as Authority)) {
        return decodeQueryComponent(uri.query as Query);
    }

}


type ResourceUri = Uri & { readonly [___ResourceUri]: never; };

type Element =
    | PinsSection
    | ScopeSection
    | SubSection
    | ContentNode
    | EmptyNode
    | StaleNode
    ;

const ResourceUri = {

    fromEmptyNode(element: EmptyNode): Uri {

        Uri.from({
            scheme: taskCockpitScheme,
            authority: 'special',
            path: `${element.parent.id}/${element.nodeKey}`,
            query: encodeQuery({
                type: 'Empty'
            })
        });
        JSON.stringify;
    }

} as const;
