

describe('NodeSpec.createSpecs - Compression Off', () => {
    const mockConfig: HierarchyConfig = {
        useGroupKind: false,
        segmentSeparator: ':',
        showHidden: false
    };

    it('should filter hidden items and calculate counts correctly', () => {
        const input: NodeDataIndex<NodeData> = {
            'section-1': {
                hierarchyConfig: mockConfig,
                nodeDataItems: [
                    { name: 'task1', hidden: false },
                    { name: 'task2', hidden: true },
                ]
            }
        };

        const result = NodeSpec.createSpecs(input, 'off');

        expect(result['section-1'].specs).toHaveLength(1);
        expect(result['section-1'].totalCount).toBe(2);
        expect(result['section-1'].hiddenCount).toBe(1);
        expect(result['section-1'].specs[0].path).toEqual(['task1']);
    });
});