

describe('NodeSpec.createSpecs - Compression Logic', () => {
    const smartConfig: HierarchyConfig = {
        useGroupKind: false,
        segmentSeparator: ':',
        showHidden: true // В компрессии скрытые обычно участвуют для структуры
    };

    it('should compress linear segments in "on" mode', () => {
        const input: NodeDataIndex<NodeData> = {
            'key': {
                hierarchyConfig: smartConfig,
                nodeDataItems: [
                    { name: 'A:B:C:task1' }
                ]
            }
        };

        const result = NodeSpec.createSpecs(input, 'on');
        // Ожидаем, что A:B превратится в один сегмент, а task1 останется отдельным (normal mode)
        // Результат зависит от того, как Hierarchy.build строит узлы
        expect(result['key'].specs[0].path).toEqual(['A › B', 'C', 'task1']);
    });

    // @fixme go-to
    it('should handle aggressive compression for runnable groups', () => {
        const input: NodeDataIndex<NodeData> = {
            'key': {
                hierarchyConfig: smartConfig,
                nodeDataItems: [
                    { name: 'A:B:task1' },
                    { name: 'A:B:task1:subtask' } // task1 становится "данными с ребенком"
                ]
            }
        };

        const result = NodeSpec.createSpecs(input, 'on-aggressive');
        // Здесь проверяем, что task1 не "проглочен", а стал точкой разреза
        const paths = result['key'].specs.map(s => s.path.join(' / '));
        expect(paths).toContain('A › B / task1');
    });
});