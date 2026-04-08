import * as assert from 'assert/strict';
import Hierarchy from '../Cockpit/TreeModel/Hierarchy';


const SCOPE = '<SCOPE-ID>';

suite('@module Cockpit/Tree/Hierarchy', function () {

    suite('build', () => {


        suite('Node.isScope', () => {

            // Scope-узел → true.
            test('true for scope node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope, 'precondition');
                assert.ok(Hierarchy.Node.isScope(scope), 'must be true for scope node');
            });

            // Data-узел → false.
            test('false for data node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'precondition');
                const leaf = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(leaf, 'precondition');
                assert.ok(!Hierarchy.Node.isScope(leaf), 'must be false for data node');
            });

            // Чистый branch → false.
            test('false for pure branch node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'precondition');
                const branch = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(branch, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(branch), 'precondition: must be branch');
                assert.ok(!Hierarchy.Node.isScope(branch), 'must be false for branch node');
            });
        });

        suite('Node.isData', () => {

            // Чистый лист — isData === true, данные доступны на узле.
            test('true for pure leaf', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['leaf'], data: { tag: 'x' } }
                ]);

                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope);
                const leaf = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(leaf);
                assert.ok(Hierarchy.Node.isData(leaf), 'isData must be true');
                assert.strictEqual(leaf.tag, 'x', 'data must be present');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isData === false.
            test('false for intermediate node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['parent', 'child'], data: { tag: 'x' } }
                ]);

                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope);
                const parent = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(parent);
                assert.ok(!Hierarchy.Node.isData(parent), 'isData must be false');
            });


            // DataNode с детьми — ['parent'] + ['parent', 'child'] →
            // узел parent — и data, и branch одновременно.
            test('true for data node with children', function () {
                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['parent', 'child'], data: { tag: 'child' } },
                    { scope: SCOPE, path: ['parent'], data: { tag: 'parent data' } }
                ]);
                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope);
                const parent = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(parent);
                assert.ok(Hierarchy.Node.isBranch(parent));
                assert.ok(Hierarchy.Node.isData(parent));
                assert.strictEqual(parent.tag, 'parent data', 'data must be present');
            });

        });


        suite('Node.isBranch', () => {

            // Чистый лист — isBranch === false.
            test('false for pure leaf', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['leaf'], data: { tag: 'x' } }
                ]);

                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope);
                const leaf = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(leaf);
                assert.ok(!Hierarchy.Node.isBranch(leaf), 'isBranch must be false');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isBranch === true.
            test('true for intermediate node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['parent', 'child'], data: { tag: 'x' } }
                ]);

                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope);
                const parent = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(parent);
                assert.ok(Hierarchy.Node.isBranch(parent), 'isBranch must be true');
            });

        });


        suite('Node.getParent', () => {

            // Корневой узел → parent — это Scope-узел.
            test('returns Scope for root node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope);

                const rootNode = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(rootNode);

                const parent = Hierarchy.Node.getParent(rootNode);
                assert.ok(Hierarchy.Node.isScope(parent), 'parent of root node must be the scope');
                assert.strictEqual(parent, scope);
            });

            // Лист возвращает своего непосредственного родителя.
            test('returns immediate parent for leaf', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b'], data: { tag: 'leaf' } },
                ]);

                const parent = Hierarchy.Scope.getChildren(
                    Hierarchy.getScopes(hierarchy)[0]
                )[0];

                assert.ok(parent, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(parent));
                const leaf = Hierarchy.Node.getBranchChildren(parent).at(0);
                assert.ok(leaf, 'precondition');
                assert.ok(Hierarchy.Node.isData(leaf));
                assert.strictEqual(Hierarchy.Node.getParent(leaf), parent);
            });

            // Промежуточный узел возвращает своего родителя.
            test('returns parent for intermediate node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b', 'c'], data: { tag: 'deep' } },
                ]);

                const nodeA = Hierarchy.Scope.getChildren(
                    Hierarchy.getScopes(hierarchy)[0]
                )[0];

                assert.ok(nodeA, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(nodeA));
                const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                assert.ok(nodeB, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(nodeB));
                assert.strictEqual(Hierarchy.Node.getParent(nodeB), nodeA);
            });

        });


        suite('Scope.getScopeId', () => {

            // Возвращает идентификатор, с которым scope был создан.
            test('returns the scope identifier', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope, 'precondition');
                assert.strictEqual(Hierarchy.Scope.getScopeId(scope), SCOPE);
            });

            // Работает с пустым scopeId.
            test('returns empty string for empty scopeId', function () {

                const hierarchy = Hierarchy.build([
                    { scope: '', path: ['a'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScopes(hierarchy).at(0);
                assert.ok(scope, 'precondition');
                assert.strictEqual(Hierarchy.Scope.getScopeId(scope), '');
            });

            // Идентифицирует scope в multi-scope иерархии.
            test('identifies correct scope in multi-scope hierarchy', function () {

                const hierarchy = Hierarchy.build([
                    { scope: 'alpha', path: ['a'], data: { tag: '1' } },
                    { scope: 'beta', path: ['b'], data: { tag: '2' } },
                ]);

                const scopes = Hierarchy.getScopes(hierarchy);
                assert.strictEqual(scopes.length, 2, 'precondition');

                const ids = scopes.map(s => Hierarchy.Scope.getScopeId(s));
                assert.ok(ids.includes('alpha'), 'must contain alpha');
                assert.ok(ids.includes('beta'), 'must contain beta');
            });
        });


        suite('resolvePath', () => {

            // Проверка resolvePath на промежуточном и листовом узлах.
            test('resolvePath encodes scope and segments correctly', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['parent', 'child'], data: { tag: 'x' } },
                ]);

                const parent = Hierarchy.Scope.getChildren(
                    Hierarchy.getScopes(hierarchy)[0]
                )[0];

                assert.ok(parent, 'must exist');

                const parentPath = Hierarchy.Node.resolvePath(parent);
                assert.strictEqual(parentPath.scope, SCOPE);
                assert.deepStrictEqual(parentPath.path, ['parent']);

                assert.ok(Hierarchy.Node.isBranch(parent));
                const child = Hierarchy.Node.getBranchChildren(parent)?.at(0);
                assert.ok(child, 'must exist');

                const childPath = Hierarchy.Node.resolvePath(child);
                assert.strictEqual(childPath.scope, SCOPE);
                assert.deepStrictEqual(childPath.path, ['parent', 'child']);
            });

            // Структурный инвариант: resolvePath(child).path = parent.path + segment.
            // path уникален в пределах дерева.
            test('child path extends parent path; resolved paths are unique', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b', 'c'], data: { tag: '1' } },
                    { scope: SCOPE, path: ['a', 'b', 'd'], data: { tag: '2' } },
                    { scope: SCOPE, path: ['a'], data: { tag: '3' } },
                    { scope: SCOPE, path: ['x', 'y'], data: { tag: '4' } },
                ]);

                const seen = new Set<string>();

                function walk(
                    parent: Readonly<Hierarchy.Data<{ tag: string; }, string> | Hierarchy.Branch<{ tag: string; }, string>> | null,
                    node: Hierarchy.Data<{ tag: string; }, string> | Hierarchy.Branch<{ tag: string; }, string>,
                ): void {

                    const np = Hierarchy.Node.resolvePath(node);
                    const nodePath = [np.scope, ...np.path].join('\0');

                    // uniqueness
                    assert.ok(!seen.has(nodePath), `duplicate nodePath: "${nodePath}"`);
                    seen.add(nodePath);

                    // structural: child.path = [...parent.path, segment]
                    if (parent) {
                        const parentParsed = Hierarchy.Node.resolvePath(parent);
                        assert.strictEqual(np.scope, parentParsed.scope);
                        assert.deepStrictEqual(
                            np.path.slice(0, -1),
                            parentParsed.path,
                            'child path must extend parent path',
                        );
                        assert.strictEqual(
                            Hierarchy.Node.getSegment(node),
                            np.path.at(-1),
                        );
                    }

                    if (Hierarchy.Node.isBranch(node)) {
                        for (const child of Hierarchy.Node.getBranchChildren(node)) {
                            walk(node, child);
                        }
                    }
                }

                const scopes = Hierarchy.getScopes(hierarchy);
                assert.ok(scopes.length > 0, 'precondition: tree is not empty');
                for (const scope of scopes) {
                    for (const child of Hierarchy.Scope.getChildren(scope)) {
                        walk(null, child);
                    }
                }

                // sanity: мы действительно обошли всё дерево
                assert.strictEqual(seen.size, 6, 'must visit all 6 nodes (a, b, c, d, x, y)');
            });

        });


        suite('Data Properties', () => {

            // Произвольные поля данных доступны на DataNode как собственные свойства.
            test('data fields accessible on DataNode', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['leaf'], data: { label: 'hello', priority: 1, hole: null, empty: undefined, dtt: new Date() } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope);
                const leaf = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(leaf, 'must exist');
                assert.ok(Hierarchy.Node.isData(leaf));
                assert.strictEqual(leaf.label, 'hello');
                assert.strictEqual(leaf.priority, 1);
                assert.strictEqual(leaf.hole, null);
                assert.strictEqual(leaf.empty, undefined);
                assert.ok(leaf.dtt instanceof Date);
            });


            suite('Edges', () => {

                test('data node exposes only payload keys as own enumerable properties', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['solo'], data: {} },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, SCOPE);
                    assert.ok(scope);
                    const children = Hierarchy.Scope.getChildren(scope);
                    const solo = children.at(0);
                    assert.ok(solo, 'node must exist');
                    assert.ok(Hierarchy.Node.isData(solo));

                    assert.deepStrictEqual(
                        Object.keys(solo),
                        [],
                        `Empty payload must produce zero own enumerable keys, got: ${JSON.stringify(Object.keys(solo))}`,
                    );
                });


                // Перезапись полностью замещает старый payload: лишние ключи предыдущего spec удаляются.
                test('duplicate path removes stale keys from previous data', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['target'], data: { tag: 'old', extra: 42 } },
                        { scope: SCOPE, path: ['target'], data: { tag: 'new' } },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, SCOPE);
                    assert.ok(scope);
                    const children = Hierarchy.Scope.getChildren(scope);
                    assert.strictEqual(children.length, 1);

                    const node = children.at(0);
                    assert.ok(node, 'precondition');
                    assert.ok(Hierarchy.Node.isData(node));
                    assert.strictEqual(node.tag, 'new', 'new tag must win');
                    assert.ok(
                        !('extra' in node),
                        `stale key "extra" must be removed, got: ${JSON.stringify(node)}`,
                    );
                });

            });

        });

        suite('Node.getData', () => {

            // Возвращает чистый payload без структурных полей иерархии.
            test('returns clean payload without structural fields', function () {

                const payload = { tag: 'hello', priority: 1 };

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['leaf'], data: payload },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'precondition');
                const leaf = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(leaf, 'precondition');
                assert.ok(Hierarchy.Node.isData(leaf), 'precondition');

                const data = Hierarchy.Node.getData(leaf);
                assert.strictEqual(data.tag, 'hello');
                assert.strictEqual(data.priority, 1);
                assert.deepStrictEqual(Object.keys(data).sort(), ['priority', 'tag']);
            });

            // getData на data+branch узле — возвращает payload, не структурные поля.
            test('returns payload for data+branch node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['parent', 'child'], data: { tag: 'child' } },
                    { scope: SCOPE, path: ['parent'], data: { tag: 'parent-data' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'precondition');
                const parent = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(parent, 'precondition');
                assert.ok(Hierarchy.Node.isData(parent), 'precondition: must be data');
                assert.ok(Hierarchy.Node.isBranch(parent), 'precondition: must be branch');

                const data = Hierarchy.Node.getData(parent);
                assert.strictEqual(data.tag, 'parent-data');
                assert.deepStrictEqual(Object.keys(data).sort(), ['tag']);
            });

            // Пустой payload → пустой объект.
            test('returns object with no own keys for empty payload', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['leaf'], data: {} },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'precondition');
                const leaf = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(leaf, 'precondition');
                assert.ok(Hierarchy.Node.isData(leaf), 'precondition');

                const data = Hierarchy.Node.getData(leaf);
                assert.deepStrictEqual(Object.keys(data), []);
            });

        });

        // структура дерева
        // ядро модуля
        suite('Tree Structure (core)', () => {

            // Минимальное дерево: один spec → один корневой DataNode с данными и корректным path.
            test('single segment produces one root DataNode', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['leaf'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope);
                const children = Hierarchy.Scope.getChildren(scope);
                assert.strictEqual(children.length, 1);

                const leaf = children.at(0);
                assert.ok(leaf, 'node must exist');
                assert.ok(Hierarchy.Node.isData(leaf), 'leaf must be DataNode');
                assert.ok(!Hierarchy.Node.isBranch(leaf), 'pure leaf must not be branch');
                assert.strictEqual(leaf.tag, 'x');

                const resolved = Hierarchy.Node.resolvePath(leaf);
                assert.strictEqual(resolved.scope, SCOPE);
                assert.deepStrictEqual(resolved.path, ['leaf']);
            });


            // Глубокая цепочка (3 уровня): промежуточные — чистые branch'и, данные только на листе.
            test('chained segments produce nested nodes with data on leaf', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b', 'c'], data: { tag: 'deep' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope);
                const roots = Hierarchy.Scope.getChildren(scope);
                assert.strictEqual(roots.length, 1);

                const nodeA = roots.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(!Hierarchy.Node.isData(nodeA), 'nodeA must not have data');
                const pathA = Hierarchy.Node.resolvePath(nodeA);
                assert.strictEqual(pathA.scope, SCOPE);
                assert.deepStrictEqual(pathA.path, ['a']);

                const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(!Hierarchy.Node.isData(nodeB), 'nodeB must not have data');
                const pathB = Hierarchy.Node.resolvePath(nodeB);
                assert.strictEqual(pathB.scope, SCOPE);
                assert.deepStrictEqual(pathB.path, ['a', 'b']);

                const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                assert.ok(nodeC, 'nodeC must exist');
                assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                assert.strictEqual(nodeC.tag, 'deep');
                const pathC = Hierarchy.Node.resolvePath(nodeC);
                assert.strictEqual(pathC.scope, SCOPE);
                assert.deepStrictEqual(pathC.path, ['a', 'b', 'c']);
            });


            // Порядок children внутри ветки соответствует порядку поступления spec'ов.
            test('children order within a branch follows spec insertion order', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['trunk', 'alpha'], data: { tag: 'a' } },
                    { scope: SCOPE, path: ['trunk', 'gamma'], data: { tag: 'g' } },
                    { scope: SCOPE, path: ['trunk', 'beta'], data: { tag: 'b' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope);
                const trunk = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(trunk, 'trunk must exist');
                assert.ok(Hierarchy.Node.isBranch(trunk));

                const children = Hierarchy.Node.getBranchChildren(trunk);
                assert.strictEqual(children.length, 3, 'trunk must have 3 children');

                assert.strictEqual(Hierarchy.Node.getSegment(children[0]), 'alpha');
                assert.strictEqual(Hierarchy.Node.getSegment(children[1]), 'gamma');
                assert.strictEqual(Hierarchy.Node.getSegment(children[2]), 'beta');

                // Обратная проверка: другой порядок spec'ов → другой порядок children.
                const hierarchy2 = Hierarchy.build([
                    { scope: SCOPE, path: ['trunk', 'beta'], data: { tag: 'b' } },
                    { scope: SCOPE, path: ['trunk', 'alpha'], data: { tag: 'a' } },
                    { scope: SCOPE, path: ['trunk', 'gamma'], data: { tag: 'g' } },
                ]);

                const scope2 = Hierarchy.getScope(hierarchy2, SCOPE);
                assert.ok(scope2);
                const trunk2 = Hierarchy.Scope.getChildren(scope2).at(0);
                assert.ok(trunk2, 'trunk2 must exist');
                assert.ok(Hierarchy.Node.isBranch(trunk2));

                const children2 = Hierarchy.Node.getBranchChildren(trunk2);
                assert.strictEqual(children2.length, 3, 'trunk2 must have 3 children');

                assert.strictEqual(Hierarchy.Node.getSegment(children2[0]), 'beta');
                assert.strictEqual(Hierarchy.Node.getSegment(children2[1]), 'alpha');
                assert.strictEqual(Hierarchy.Node.getSegment(children2[2]), 'gamma');
            });


            // Переиспользование узлов: два spec'а с общим префиксом → один промежуточный trunk.
            test('shared prefix reuses intermediate node', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['trunk', 'left'], data: { tag: 'L' } },
                    { scope: SCOPE, path: ['trunk', 'right'], data: { tag: 'R' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope);
                const roots = Hierarchy.Scope.getChildren(scope);
                assert.strictEqual(roots.length, 1, 'shared trunk = one root');

                const trunk = roots.at(0);
                assert.ok(trunk, 'trunk must exist');
                assert.ok(!Hierarchy.Node.isData(trunk), 'trunk is pure intermediate');
                assert.ok(Hierarchy.Node.isBranch(trunk));

                const children = Hierarchy.Node.getBranchChildren(trunk);
                assert.strictEqual(children.length, 2, 'trunk has two children');

                const left = children.at(0);
                assert.ok(left, 'left must exist');
                assert.strictEqual(Hierarchy.Node.getSegment(left), 'left');
                assert.ok(Hierarchy.Node.isData(left));
                assert.strictEqual(left.tag, 'L');

                const right = children.at(1);
                assert.ok(right, 'right must exist');
                assert.strictEqual(Hierarchy.Node.getSegment(right), 'right');
                assert.ok(Hierarchy.Node.isData(right));
                assert.strictEqual(right.tag, 'R');
            });

            // Двойная роль: узел одновременно несёт данные и имеет детей.
            test('node can be both data and branch', function () {

                // Узлы a и b несут данные, и имеют ребенка.
                // Узел c конечный — не имеет детей, только данные.
                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b', 'c'], data: { tag: 'c-data' } },
                    { scope: SCOPE, path: ['a', 'b'], data: { tag: 'b-data' } },
                    { scope: SCOPE, path: ['a'], data: { tag: 'a-data' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope);
                const roots = Hierarchy.Scope.getChildren(scope);
                assert.strictEqual(roots.length, 1);

                const nodeA = roots.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(Hierarchy.Node.isData(nodeA), 'nodeA must have data');
                assert.strictEqual(nodeA.tag, 'a-data');
                const pathA = Hierarchy.Node.resolvePath(nodeA);
                assert.deepStrictEqual(pathA.path, ['a']);

                const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(Hierarchy.Node.isData(nodeB), 'nodeB must have data');
                assert.strictEqual(nodeB.tag, 'b-data');
                const pathB = Hierarchy.Node.resolvePath(nodeB);
                assert.deepStrictEqual(pathB.path, ['a', 'b']);

                const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                assert.ok(nodeC, 'nodeC must exist');
                assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                assert.strictEqual(nodeC.tag, 'c-data');
                const pathC = Hierarchy.Node.resolvePath(nodeC);
                assert.deepStrictEqual(pathC.path, ['a', 'b', 'c']);
            });


            // Контракт позиционирования: ветка встаёт на позицию в порядке поступления спецификации.
            test('branch position follows first occurrence', function () {

                const specs = [
                    { scope: SCOPE, path: ['x'], data: { tag: 'x' } },
                    { scope: SCOPE, path: ['y'], data: { tag: 'y' } },
                    { scope: SCOPE, path: ['z'], data: { tag: 'z' } },
                ];

                const names = ['x', 'y', 'z'] as const;

                // все шесть перестановок
                for (const [i, j, k] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {

                    const hierarchy = Hierarchy.build([
                        specs[i],
                        specs[j],
                        specs[k]
                    ]);
                    const label = `permutation ${names[i]}, ${names[j]}, ${names[k]}`;

                    const scope = Hierarchy.getScope(hierarchy, SCOPE);
                    assert.ok(scope, `${label}: scope must exist`);
                    const children = Hierarchy.Scope.getChildren(scope);
                    assert.strictEqual(children.length, 3, `${label}: must have 3 roots`);

                    assert.strictEqual(Hierarchy.Node.getSegment(children[0]), names[i], `${label}: [0]`);
                    assert.strictEqual(Hierarchy.Node.getSegment(children[1]), names[j], `${label}: [1]`);
                    assert.strictEqual(Hierarchy.Node.getSegment(children[2]), names[k], `${label}: [2]`);
                }
            });


            // Структурный инвариант:
            // Дерево определяется только набором путей, а не тем в каком порядке поступают спецификации.
            // Например, ['a', 'b', 'c'] может прийти раньше ['a'] — и алгоритм должен корректно доклеить 
            // data к уже существующему чистому branch.
            test('tree shape and data are independent of spec order', function () {

                const specs = [
                    { scope: SCOPE, path: ['a'], data: { tag: '1' } },
                    { scope: SCOPE, path: ['a', 'b', 'c'], data: { tag: '3' } },
                    { scope: SCOPE, path: ['a', 'b'], data: { tag: '2' } },
                ];

                const expected = Hierarchy.build([specs[0], specs[1], specs[2]]);

                // Проверка образца
                const scope = Hierarchy.getScope(expected, SCOPE);
                assert.ok(scope);
                const roots = Hierarchy.Scope.getChildren(scope);
                assert.strictEqual(roots.length, 1);

                const a = roots.at(0);
                assert.ok(a);
                assert.ok(Hierarchy.Node.isData(a));
                assert.strictEqual(a.tag, '1');

                assert.ok(Hierarchy.Node.isBranch(a));
                const b = Hierarchy.Node.getBranchChildren(a).at(0);
                assert.ok(b);
                assert.ok(Hierarchy.Node.isData(b));
                assert.strictEqual(b.tag, '2');

                assert.ok(Hierarchy.Node.isBranch(b));
                const c = Hierarchy.Node.getBranchChildren(b).at(0);
                assert.ok(c);
                assert.ok(Hierarchy.Node.isData(c));
                assert.strictEqual(c.tag, '3');

                // Все оставшиеся перестановки дают ту же структуру
                for (const [i, j, k] of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
                    const result = Hierarchy.build([
                        specs[i],
                        specs[j],
                        specs[k]
                    ]);
                    // Каждая перестановка порождает структуру сходную с образцом
                    assert.deepStrictEqual(result, expected, `must match in permutation [${i},${j},${k}]`);
                }
            });


            suite('Edges', () => {

                // Тест на пустой ввод.
                test('empty specs produce no root nodes', function () {

                    const hierarchy = Hierarchy.build([]);

                    assert.strictEqual(Hierarchy.getScopes(hierarchy).length, 0);
                });


                // Семантика перезаписи: последний spec выигрывает.
                test('duplicate path overwrites data', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['target'], data: { tag: 'original' } },
                        { scope: SCOPE, path: ['target'], data: { tag: 'replacement' } },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, SCOPE);
                    assert.ok(scope);
                    const children = Hierarchy.Scope.getChildren(scope);

                    assert.strictEqual(children.length, 1, 'only one');

                    const node = children[0];
                    assert.ok(node, 'must exist');
                    assert.ok(Hierarchy.Node.isData(node), 'must remain DataNode');
                    assert.strictEqual(node.tag, 'replacement', 'later spec wins');
                });


                // Граничный случай: scopeId === segment на всех уровнях.
                test('scopeId identical to all segments does not collapse the tree', function () {

                    const V = 'same';

                    const hierarchy = Hierarchy.build([
                        { scope: V, path: [V, V, V], data: { tag: 'leaf' } },
                        { scope: V, path: [V], data: { tag: 'root-data' } },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, V);
                    assert.ok(scope);
                    const roots = Hierarchy.Scope.getChildren(scope);
                    assert.strictEqual(roots.length, 1, 'single root branch');

                    const root = roots.at(0);
                    assert.ok(root, 'root must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(root), V);
                    assert.ok(Hierarchy.Node.isData(root), 'root must carry data');
                    assert.ok(Hierarchy.Node.isBranch(root), 'root must be branch');
                    assert.strictEqual(root.tag, 'root-data');
                    const rootPath = Hierarchy.Node.resolvePath(root);
                    assert.strictEqual(rootPath.scope, V);
                    assert.deepStrictEqual(rootPath.path, [V]);

                    const midChildren = Hierarchy.Node.getBranchChildren(root);
                    assert.strictEqual(midChildren.length, 1);
                    const mid = midChildren.at(0);
                    assert.ok(mid, 'mid must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(mid), V);
                    assert.ok(!Hierarchy.Node.isData(mid), 'intermediate must not have data');
                    assert.ok(Hierarchy.Node.isBranch(mid), 'intermediate must be branch');
                    const midPath = Hierarchy.Node.resolvePath(mid);
                    assert.strictEqual(midPath.scope, V);
                    assert.deepStrictEqual(midPath.path, [V, V]);

                    const leafChildren = Hierarchy.Node.getBranchChildren(mid);
                    assert.strictEqual(leafChildren.length, 1);
                    const leaf = leafChildren.at(0);
                    assert.ok(leaf, 'leaf must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(leaf), V);
                    assert.ok(Hierarchy.Node.isData(leaf), 'leaf must have data');
                    assert.strictEqual(leaf.tag, 'leaf');
                    assert.ok(!Hierarchy.Node.isBranch(leaf), 'leaf must not be branch');
                    const leafPath = Hierarchy.Node.resolvePath(leaf);
                    assert.strictEqual(leafPath.scope, V);
                    assert.deepStrictEqual(leafPath.path, [V, V, V]);
                });


                // Спецификация с пустым массивом сегментов — молча игнорируется.
                test('spec with empty segments is silently skipped', function () {

                    const empty = { scope: SCOPE, path: [] as string[], data: { tag: 'ghost' } };
                    const x = { scope: SCOPE, path: ['X'], data: { tag: 'X' } };
                    const z = { scope: SCOPE, path: ['Z'], data: { tag: 'Z' } };

                    for (const [a, b, c] of [[empty, x, z], [x, empty, z], [x, z, empty]]) {

                        const hierarchy = Hierarchy.build([a, b, c]);

                        const scope = Hierarchy.getScope(hierarchy, SCOPE);
                        assert.ok(scope);
                        const children = Hierarchy.Scope.getChildren(scope);
                        assert.strictEqual(children.length, 2, 'empty-path spec must not produce a node');

                        // Оба валидных узла выжили
                        const tags = children.map(c => {
                            assert.ok(Hierarchy.Node.isData(c));
                            return c.tag;
                        });
                        assert.ok(tags.includes('X'), 'X must survive');
                        assert.ok(tags.includes('Z'), 'Z must survive');
                    }
                });


                // Защита от регрессии: алгоритм работает с пустым scopeId
                test('resolvePath correctly recovers empty scopeId', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: '', path: ['a', 'b', 'c'], data: { tag: 'leaf' } },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, '');
                    assert.ok(scope);
                    const roots = Hierarchy.Scope.getChildren(scope);
                    assert.strictEqual(roots.length, 1);

                    const nodeA = roots.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA));
                    assert.ok(!Hierarchy.Node.isData(nodeA));
                    const pathA = Hierarchy.Node.resolvePath(nodeA);
                    assert.strictEqual(pathA.scope, '');
                    assert.deepStrictEqual(pathA.path, ['a']);

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB));
                    assert.ok(!Hierarchy.Node.isData(nodeB));
                    const pathB = Hierarchy.Node.resolvePath(nodeB);
                    assert.strictEqual(pathB.scope, '');
                    assert.deepStrictEqual(pathB.path, ['a', 'b']);

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC));
                    assert.ok(Hierarchy.Node.isData(nodeC));
                    assert.strictEqual(nodeC.tag, 'leaf');
                    const pathC = Hierarchy.Node.resolvePath(nodeC);
                    assert.strictEqual(pathC.scope, '');
                    assert.deepStrictEqual(pathC.path, ['a', 'b', 'c']);
                });


                // Защита от регрессии: пустые строки в сегментах не ломают построение и resolvePath.
                test('resolvePath correctly recovers empty segments', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a', '', 'c'], data: { tag: 'leaf' } },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, SCOPE);
                    assert.ok(scope);
                    const roots = Hierarchy.Scope.getChildren(scope);
                    assert.strictEqual(roots.length, 1);

                    const nodeA = roots.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA));
                    assert.ok(!Hierarchy.Node.isData(nodeA));
                    const pathA = Hierarchy.Node.resolvePath(nodeA);
                    assert.deepStrictEqual(pathA.path, ['a']);

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB));
                    assert.ok(!Hierarchy.Node.isData(nodeB));
                    assert.strictEqual(Hierarchy.Node.getSegment(nodeB), '');
                    const pathB = Hierarchy.Node.resolvePath(nodeB);
                    assert.deepStrictEqual(pathB.path, ['a', '']);

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC));
                    assert.ok(Hierarchy.Node.isData(nodeC));
                    assert.strictEqual(nodeC.tag, 'leaf');
                    const pathC = Hierarchy.Node.resolvePath(nodeC);
                    assert.deepStrictEqual(pathC.path, ['a', '', 'c']);
                });


                // Защита от регрессии: пустой scopeId + все сегменты пустые — worst-case для resolvePath.
                test('resolvePath correctly recovers all-empty segments', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: '', path: ['', '', ''], data: { tag: 'leaf' } },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, '');
                    assert.ok(scope);
                    const roots = Hierarchy.Scope.getChildren(scope);
                    assert.strictEqual(roots.length, 1);

                    const nodeA = roots.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA));
                    assert.ok(!Hierarchy.Node.isData(nodeA));
                    const pathA = Hierarchy.Node.resolvePath(nodeA);
                    assert.strictEqual(pathA.scope, '');
                    assert.deepStrictEqual(pathA.path, ['']);

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB));
                    assert.ok(!Hierarchy.Node.isData(nodeB));
                    const pathB = Hierarchy.Node.resolvePath(nodeB);
                    assert.strictEqual(pathB.scope, '');
                    assert.deepStrictEqual(pathB.path, ['', '']);

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC));
                    assert.ok(Hierarchy.Node.isData(nodeC));
                    assert.strictEqual(nodeC.tag, 'leaf');
                    const pathC = Hierarchy.Node.resolvePath(nodeC);
                    assert.strictEqual(pathC.scope, '');
                    assert.deepStrictEqual(pathC.path, ['', '', '']);
                });


                // Спецсимволы в сегментах не ломают построение дерева и roundtrip.
                // Защита от регрессии: спецсимволы в сегментах не ломают построение дерева и roundtrip.
                test('resolvePath correctly recovers segments with special characters', function () {

                    const specialSegments = [
                        'hello world',
                        'path/to\\file',
                        'it\'s "fine"',
                        '!@#$%^&*()',
                        'a\tb\nc',
                        'Привіт Світ',
                        '日本語🚀',
                        '   ',
                        '..',
                        '~!@#$%^&*()_+-={}[],.<|>?!№;%:',
                        '\0\x01\x1f\x7f',
                        'a'.repeat(500),
                    ];

                    for (const seg of specialSegments) {

                        const label = `"${seg.slice(0, 20)}…"`;

                        const hierarchy = Hierarchy.build([
                            { scope: SCOPE, path: ['normal', seg, 'tail'], data: { tag: 'ok' } },
                        ]);

                        const scope = Hierarchy.getScope(hierarchy, SCOPE);
                        assert.ok(scope, `${label}: scope must exist`);
                        const roots = Hierarchy.Scope.getChildren(scope);
                        assert.strictEqual(roots.length, 1, `${label}: single root`);

                        const nodeA = roots.at(0);
                        assert.ok(nodeA, `${label}: nodeA must exist`);
                        assert.ok(Hierarchy.Node.isBranch(nodeA));
                        assert.strictEqual(Hierarchy.Node.getSegment(nodeA), 'normal');
                        const pathA = Hierarchy.Node.resolvePath(nodeA);
                        assert.deepStrictEqual(pathA.path, ['normal']);

                        const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                        assert.ok(nodeB, `${label}: nodeB must exist`);
                        assert.ok(Hierarchy.Node.isBranch(nodeB));
                        assert.strictEqual(Hierarchy.Node.getSegment(nodeB), seg, `${label}: getSegment must recover segment`);
                        const pathB = Hierarchy.Node.resolvePath(nodeB);
                        assert.deepStrictEqual(pathB.path, ['normal', seg]);

                        const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                        assert.ok(nodeC, `${label}: nodeC must exist`);
                        assert.ok(Hierarchy.Node.isData(nodeC));
                        assert.strictEqual(nodeC.tag, 'ok');
                        const pathC = Hierarchy.Node.resolvePath(nodeC);
                        assert.deepStrictEqual(pathC.path, ['normal', seg, 'tail']);
                    }
                });


                // Два scope → узлы разнесены по своим scope-контейнерам, не смешиваются.
                test('multi-scope build separates nodes by scope', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: 'A', path: ['shared-name'], data: { tag: 'from-A' } },
                        { scope: 'B', path: ['shared-name'], data: { tag: 'from-B' } },
                    ]);

                    const scopes = Hierarchy.getScopes(hierarchy);
                    assert.strictEqual(scopes.length, 2, 'must produce two scopes');

                    const scopeA = Hierarchy.getScope(hierarchy, 'A');
                    assert.ok(scopeA, 'scope A must exist');
                    const childrenA = Hierarchy.Scope.getChildren(scopeA);
                    assert.strictEqual(childrenA.length, 1, 'scope A must have one child');
                    assert.ok(Hierarchy.Node.isData(childrenA[0]));
                    assert.strictEqual(childrenA[0].tag, 'from-A');

                    const scopeB = Hierarchy.getScope(hierarchy, 'B');
                    assert.ok(scopeB, 'scope B must exist');
                    const childrenB = Hierarchy.Scope.getChildren(scopeB);
                    assert.strictEqual(childrenB.length, 1, 'scope B must have one child');
                    assert.ok(Hierarchy.Node.isData(childrenB[0]));
                    assert.strictEqual(childrenB[0].tag, 'from-B');
                });


                // getBranchChildren возвращает detached-копию — мутация не портит дерево.
                test('getBranchChildren returns a detached copy — mutation does not corrupt tree', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } },
                    ]);

                    const scope = Hierarchy.getScope(hierarchy, SCOPE);
                    assert.ok(scope);
                    const nodeA = Hierarchy.Scope.getChildren(scope).at(0);
                    assert.ok(nodeA, 'precondition');
                    assert.ok(Hierarchy.Node.isBranch(nodeA), 'precondition');

                    const children = Hierarchy.Node.getBranchChildren(nodeA);
                    children.length = 0;

                    assert.strictEqual(Hierarchy.Node.getBranchChildren(nodeA).length, 1);
                });

                // Иерархия заморожена — не мутабельна.
                test('mutation-resistant', function () {
                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } }
                    ]);

                    // проверка runtime-заморозки
                    // ts - предупреждает
                    // runtime - падает
                    assert.throws(() => {
                        // @ts-expect-error
                        hierarchy[SCOPE] = null;
                    }, /read only property/);

                    assert.throws(() => {
                        // @ts-expect-error
                        delete hierarchy[SCOPE];
                    }, /Cannot delete property/);

                    assert.throws(() => {
                        // @ts-expect-error
                        hierarchy['xxx'] = null;
                    }, /object is not extensible/);
                });

            });

        });


        suite('Lookup', () => {

            // Находит листовой DataNode по полному пути.
            test('finds leaf node by full path', function () {
                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b', 'c'], data: { tag: 'leaf' } },
                ]);
                const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'b', 'c']);
                assert.ok(found, 'must find the node');
                assert.ok(Hierarchy.Node.isData(found));
                assert.strictEqual(found.tag, 'leaf');
            });

            // Находит промежуточный (чистый branch) узел.
            test('finds intermediate branch node', function () {
                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b', 'c'], data: { tag: 'deep' } },
                ]);
                const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'b']);
                assert.ok(found, 'must find intermediate node');
                assert.ok(Hierarchy.Node.isBranch(found), 'must be branch');
                assert.ok(!Hierarchy.Node.isData(found), 'must not have data');
                assert.strictEqual(Hierarchy.Node.getSegment(found), 'b');
            });

            // Находит узел с двойной ролью (data + branch).
            test('finds data+branch node', function () {
                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['A', 'a', 'b'], data: { tag: 'child' } },
                    { scope: SCOPE, path: ['A', 'a'], data: { tag: 'parent' } },
                ]);
                const found = Hierarchy.lookup(hierarchy, SCOPE, ['A', 'a']);
                assert.ok(found, 'must find the node');
                assert.ok(Hierarchy.Node.isData(found), 'must have data');
                assert.ok(Hierarchy.Node.isBranch(found), 'must have children');
                assert.strictEqual(found.tag, 'parent');
            });

            suite('Edges', () => {

                // Пустой массив path → undefined.
                test('empty path returns undefined', function () {
                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } }
                    ]);
                    assert.strictEqual(Hierarchy.lookup(hierarchy, SCOPE, []), undefined);
                });

                // Пустая иерархия → undefined.
                test('empty hierarchy returns undefined', function () {
                    const hierarchy = Hierarchy.build([]);
                    assert.strictEqual(Hierarchy.lookup(hierarchy, SCOPE, ['anything']), undefined);
                });

                // Первый сегмент существует, второй — нет → undefined.
                test('partial match returns undefined', function () {
                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } }
                    ]);
                    const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'nope']);
                    assert.strictEqual(found, undefined);
                });

                // Полностью несуществующий путь → undefined.
                test('non-existent path returns undefined', function () {
                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } }
                    ]);
                    const found = Hierarchy.lookup(hierarchy, SCOPE, ['zzz']);
                    assert.strictEqual(found, undefined);
                });

                // Путь длиннее дерева (проходит сквозь лист) → undefined.
                test('path beyond leaf depth returns undefined', function () {
                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a'], data: { tag: 'x' } }
                    ]);
                    const nodeA = Hierarchy.lookup(hierarchy, SCOPE, ['a']);
                    assert.ok(nodeA);
                    assert.ok(!Hierarchy.Node.isBranch(nodeA), 'precondition: leaf has no children');
                    const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'ghost']);
                    assert.strictEqual(found, undefined);
                });

                // Непустая иерархия, но запрашивается несуществующий scope → undefined.
                test('non-existent scope returns undefined', function () {

                    const hierarchy = Hierarchy.build([
                        { scope: SCOPE, path: ['a', 'b'], data: { tag: 'x' } },
                    ]);

                    // @ts-expect-error: ts будет мешать:  Property '"no-such-scope"' is missing in type 'Hierarchy<{ tag: string; }, "<SCOPE-ID>">' but required in type 'Hierarchy<{ tag: string; }, "<SCOPE-ID>" | "no-such-scope">'.
                    const found = Hierarchy.lookup(hierarchy, 'no-such-scope', ['a', 'b']);
                    assert.strictEqual(found, undefined);
                });
            });

        });


        suite('Hierarchy.walk', () => {

            // Обходит все узлы всех scope'ов, каждый ровно один раз.
            test('visits every node exactly once across all scopes', function () {

                const hierarchy = Hierarchy.build([
                    { scope: 'A', path: ['a', 'b'], data: { tag: 'A-b' } },
                    { scope: 'A', path: ['a'], data: { tag: 'A-a' } },
                    { scope: 'B', path: ['x'], data: { tag: 'B-x' } },
                ]);

                const visited: string[] = [];

                Hierarchy.walk(hierarchy, (node) => {
                    visited.push(Hierarchy.Node.getSegment(node));
                });

                // a (branch+data), b (data), x (data) — 3 узла
                assert.strictEqual(visited.length, 3,
                    `must visit 3 nodes, got: [${visited}]`);
                assert.ok(visited.includes('a'));
                assert.ok(visited.includes('b'));
                assert.ok(visited.includes('x'));
            });

            // Пустая иерархия → visitor не вызывается.
            test('does not call visitor on empty hierarchy', function () {

                const hierarchy = Hierarchy.build([]);
                let called = false;

                Hierarchy.walk(hierarchy, () => { called = true; });

                assert.ok(!called, 'visitor must not be called');
            });
        });


        suite('Scope.walk', () => {

            // Обходит все узлы в scope (depth-first), включая промежуточные branch'и.
            test('visits all nodes in scope depth-first', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['a', 'b'], data: { tag: 'leaf-b' } },
                    { scope: SCOPE, path: ['a', 'c'], data: { tag: 'leaf-c' } },
                    { scope: SCOPE, path: ['x'], data: { tag: 'leaf-x' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'precondition');

                const segments: string[] = [];

                Hierarchy.Scope.walk(scope, (node) => {
                    segments.push(Hierarchy.Node.getSegment(node));
                });

                // a (branch), b (data), c (data), x (data) — 4 узла
                assert.strictEqual(segments.length, 4,
                    `must visit 4 nodes, got: [${segments}]`);
                // depth-first: a перед b и c
                assert.ok(segments.indexOf('a') < segments.indexOf('b'));
                assert.ok(segments.indexOf('a') < segments.indexOf('c'));
            });

            // Scope без узлов (все spec'ы с пустыми path) → visitor не вызывается.
            test('does not call visitor on scope with no nodes', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: [] as string[], data: { tag: 'ghost' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                // scope может не существовать — пустой path скипается
                if (!scope) return;

                let called = false;
                Hierarchy.Scope.walk(scope, () => { called = true; });
                assert.ok(!called, 'visitor must not be called');
            });
        });


        suite('Node.walk', () => {

            // Обходит поддерево branch-узла (pre-order), включая сам узел.
            test('visits subtree in pre-order including the node itself', function () {

                const hierarchy = Hierarchy.build([
                    { scope: SCOPE, path: ['root', 'a', 'deep'], data: { tag: '1' } },
                    { scope: SCOPE, path: ['root', 'b'], data: { tag: '2' } },
                    { scope: SCOPE, path: ['root'], data: { tag: '0' } },
                    { scope: SCOPE, path: ['outside'], data: { tag: 'x' } },
                ]);

                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'precondition');

                const rootNode = Hierarchy.Scope.getChildren(scope).at(0);
                assert.ok(rootNode, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(rootNode), 'precondition');
                assert.strictEqual(Hierarchy.Node.getSegment(rootNode), 'root', 'precondition');

                const segments: string[] = [];

                Hierarchy.Node.walk(rootNode, (node) => {
                    segments.push(Hierarchy.Node.getSegment(node));
                });

                // root, a, deep, b — 4 узла; outside не входит
                assert.strictEqual(segments.length, 4,
                    `must visit 4 nodes, got: [${segments}]`);
                assert.ok(!segments.includes('outside'), 'must not visit outside subtree');
                assert.strictEqual(segments[0], 'root', 'must start with the node itself');
                // pre-order: a перед deep
                assert.ok(segments.indexOf('a') < segments.indexOf('deep'));
            });
        });

        suite('Edges', () => {

            // @todo
            test('all public methods work when destructured (no this-dependency)', function () {

                const {
                    build,
                    lookup,
                    getScope,
                    getScopes,
                    walk: hierarchyWalk,
                    Node,
                    Scope: ScopeNS
                } = Hierarchy;

                const {
                    getChildren,
                    getScopeId,
                    walk: scopeWalk
                } = ScopeNS;

                const {
                    getBranchChildren,
                    getParent,
                    getSegment,
                    isBranch,
                    isData,
                    resolvePath,
                    getData,
                    isScope,
                    walk: nodeWalk
                } = Node;


                assert.doesNotThrow(() => {
                    const hierarchy = build<{}, typeof SCOPE>([
                        { scope: SCOPE, path: ['a', 'b', 'c'], data: {} }
                    ]);

                    const scope = getScope(hierarchy, SCOPE);
                    assert.ok(scope);
                    const topChildren = getChildren(scope);
                    const node = topChildren[0];

                    if (isBranch(node)) {
                        getBranchChildren(node);
                        isData(node);
                        getParent(node);
                        getSegment(node);
                        const { scope: s, path: p } = resolvePath(node);
                        lookup(hierarchy, s as typeof SCOPE, p);
                    }
                    else {
                        throw Error;
                    }
                });

            });

        });

    });

});