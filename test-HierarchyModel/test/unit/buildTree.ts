import type HierarchyModel from 'src/HierarchyModel/HierarchyModel';

function buildTree(
    children: Array<HierarchyModel.Element>,
    prefix: string,
    isRoot = false
): string[] {
    const lines: string[] = [];

    for (let i = 0; i < children.length; i++) {

        const child = children[i]!;
        const isLast = i === children.length - 1;

        const label = child.label;

        const connector = isRoot ? '─ ' : (isLast ? '└─ ' : '├─ ');
        const childPrefix = isRoot ? '  ' : prefix + (isLast ? '   ' : '│  ');

        const isrunnable = child.data != null;

        lines.push(`${prefix}${connector}${isrunnable ? `▶ ${label}` : label}`);

        const subChildren = child.children;

        if (subChildren) {
            const subTree = buildTree(
                [...subChildren.values()],
                childPrefix
            );
            lines.push(...subTree);
        }

    }

    return lines;
}


export default buildTree;
