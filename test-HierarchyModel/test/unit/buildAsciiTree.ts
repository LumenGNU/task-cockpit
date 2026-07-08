import type HierarchyModel from 'src/HierarchyModel/HierarchyModel';



function buildAsciiTree(
    hierarchy: HierarchyModel.Hierarchy<string, any>
): string[] {
    const entries = [...hierarchy.entries()];
    const lines: string[] = [];

    for (let i = 0; i < entries.length; i++) {
        const [key, branch] = entries[i]!;
        lines.push(`─ [[${key}]]`);
        lines.push(...buildAsciiBranch(branch.children, '    '));
    }

    return lines;
}



function buildAsciiBranch(
    children: ReadonlyArray<Readonly<HierarchyModel.Element<string, any>>>,
    prefix: string,
): string[] {
    const lines: string[] = [];

    for (let i = 0; i < children.length; i++) {

        const child = children[i]!;
        const isLast = i === children.length - 1;

        const label = child.label;

        const connector = isLast ? '└─ ' : '├─ ';
        const childPrefix = prefix + (isLast ? '   ' : '│  ');

        const isRunnable = child.data != null;

        lines.push(`${prefix}${connector}${isRunnable ? `▶ ${label}` : label}`);

        const subChildren = child.children;

        if (subChildren) {
            const subBranch = buildAsciiBranch(
                subChildren,
                childPrefix
            );
            lines.push(...subBranch);
        }

    }

    return lines;
}


export default buildAsciiTree;
