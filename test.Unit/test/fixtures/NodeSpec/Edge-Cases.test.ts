describe('NodeSpec Edge Cases', () => {
    it('should handle different separators in different sections', () => {
        const input: NodeDataIndex<NodeData> = {
            'dots': {
                hierarchyConfig: { useGroupKind: false, segmentSeparator: '.', showHidden: true },
                nodeDataItems: [{ name: 'a.b.c' }]
            },
            'colons': {
                hierarchyConfig: { useGroupKind: false, segmentSeparator: ':', showHidden: true },
                nodeDataItems: [{ name: 'x:y:z' }]
            }
        };

        const result = NodeSpec.createSpecs(input, 'off');
        expect(result['dots'].specs[0].path).toEqual(['a', 'b', 'c']);
        expect(result['colons'].specs[0].path).toEqual(['x', 'y', 'z']);
    });

    it('should not produce phantom empty segments', () => {
        // Тест на фикс @resolved комментария в коде
        const input: NodeDataIndex<NodeData> = {
            'key': {
                hierarchyConfig: { useGroupKind: false, segmentSeparator: ':', showHidden: true },
                nodeDataItems: [{ name: 'task' }] // Узел сразу у корня
            }
        };
        const result = NodeSpec.createSpecs(input, 'on');
        expect(result['key'].specs[0].path).not.toContain('');
    });
});