import * as vscode from 'vscode';
import type HierarchyModel from '../../src/HierarchyModel/HierarchyModel';


export interface Fixture {
    buildAsciiTree: (hierarchy: HierarchyModel.Hierarchy<string, any>) => string[];
    findDuplicateIds: (hierarchy: HierarchyModel.Hierarchy<string, any>) => string[];
}

export function activate(context: vscode.ExtensionContext): Fixture {
    return {
        buildAsciiTree,
        findDuplicateIds
    };
}


export function deactivate(): void { }

// --------------------------------------------------------------------


function buildAsciiTree(
    hierarchy: HierarchyModel.Hierarchy<string, any>
): string[] {
    const lines: string[] = [];
    collectLines(hierarchy.children, '', lines);
    return lines;
}

function collectLines(
    children: readonly HierarchyModel.Element<string, any>[],
    prefix: string,
    lines: string[]
): void {
    for (let i = 0; i < children.length; i++) {
        const child = children[i]!;
        const isLast = i === children.length - 1;
        const connector = isLast ? '└─ ' : '├─ ';
        const childPrefix = prefix + (isLast ? '   ' : '│  ');
        const runnablePrefix = child.data != null ? '▶ ' : '';
        lines.push(`${prefix}${connector}${runnablePrefix}${child.label}`);
        collectLines(child.children ?? [], childPrefix, lines);
    }
}


function findDuplicateIds(
    hierarchy: HierarchyModel.Hierarchy<string, any>
): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    collectIds(hierarchy.children, seen, duplicates);
    return duplicates;
}

function collectIds(
    children: readonly HierarchyModel.Element<string, any>[],
    seen: Set<string>,
    duplicates: string[]
): void {
    for (const child of children) {
        if (seen.has(child.id)) {
            duplicates.push(child.id);
        } else {
            seen.add(child.id);
        }
        collectIds(child.children ?? [], seen, duplicates);
    }
}
