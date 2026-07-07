import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import type CompressionBehavior from 'src/HierarchyModel/CompressionBehavior';

type TD = { name: string; };
const d = (name: string): TD => ({ name });

/** Обход в глубину — собирает все id из иерархии. */
function collectIds(h: HierarchyModel.Hierarchy<TD>): string[] {
    const ids: string[] = [];
    (function walk(nodes: ReadonlyArray<HierarchyModel.Element<TD>>): void {
        for (const node of nodes) {
            ids.push(node.id);
            if (node.children != null) walk(node.children);
        }
    })(h.children);
    return ids;
}

function assertUniqueIds(h: HierarchyModel.Hierarchy<TD>): void {
    const ids = collectIds(h);
    const seen = new Set<string>();
    for (const id of ids) {
        assert.ok(!seen.has(id), `Duplicate id: ${JSON.stringify(id)}`);
        seen.add(id);
    }
}

const BPX = 'prefix';
const BKY = 'key';

function build(
    specs: HierarchyModel.Specs<TD>,
    mode: CompressionBehavior
): HierarchyModel.Hierarchy<TD> {
    return HierarchyModel.buildHierarchy({ branchPrefix: BPX, branchKey: BKY, specs }, mode);
}

suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Уникальность id', function () {

            suite('Один сегмент', function () {

                const specs = [
                    { segments: ['segment'], data: d('t') }
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });

            });


            suite('Линейный путь', function () {

                const specs = [
                    { segments: ['segment1', 'segment2', 'segment3'], data: d('t') }
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });

            });


            suite('Линейный путь с повторами', function () {

                const specs = [
                    { segments: ['segment', 'segment', 'segment'], data: d('t') }
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });

            });


            suite('Дерево с разветвлениями', function () {

                const specs = [
                    { segments: ['src', 'index.ts'], data: d('index') },
                    { segments: ['src', 'lib', 'a.ts'], data: d('a') },
                    { segments: ['src', 'lib', 'b.ts'], data: d('b') },
                    { segments: ['test', 'unit', 'a.test.ts'], data: d('at') },
                    { segments: ['test', 'unit', 'b.test.ts'], data: d('bt') },
                    { segments: ['test', 'integration', 'suite.ts'], data: d('s') },
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });

            });

            suite('Промежуточный узел с данными', function () {

                const specs = [
                    { segments: ['src', 'build.sh'], data: d('build') },
                    { segments: ['src'], data: d('src') },
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });

            });

            suite('сегменты, содержащие символ-разделитель составных меток (›)', function () {
                // LABEL_SEP = '\u2009›\u2009' — допустим в именах Unix-файлов.
                // Без NUL в SEP пути ['a ›  b', 'c'] и ['a', ' › b › c'] могли бы дать
                // одинаковый id при конкатенации; NUL в SEP это исключает.

                const specs = [
                    { segments: ['\u2009›\u2009pkg', 'index.ts'], data: d('i1') },
                    { segments: ['pkg', '\u2009›\u2009index.ts'], data: d('i2') },
                    { segments: ['\u2009›\u2009pkg', '\u2009›\u2009sub', 'file.ts'], data: d('i3') },
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });

            });

            suite('Несколько параллельных цепочек', function () {

                const specs = [
                    { segments: ['src', 'a', 'b', 'f1.ts'], data: d('f1') },
                    { segments: ['src', 'a', 'b', 'f2.ts'], data: d('f2') },
                    { segments: ['src', 'c', 'f3.ts'], data: d('f3') },
                    { segments: ['lib', 'x', 'y', 'z', 'index.ts'], data: d('idx') },
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });

            });


            suite('смешанное дерево: цепочки и развилки', function () {
                const specs = [
                    { segments: ['a', 'b', 'leaf1.ts'], data: d('l1') },
                    { segments: ['a', 'c', 'leaf2.ts'], data: d('l2') },
                    { segments: ['d', 'e', 'leaf3.ts'], data: d('l3') },
                    { segments: ['d', 'e', 'leaf4.ts'], data: d('l4') },
                ];

                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });
            });



            suite('смешанное дерево', function () {

                const specs = [
                    { segments: ['packages', 'core', 'src', 'index.ts'], data: d('index') },
                    { segments: ['packages', 'core', 'src', 'utils.ts'], data: d('utils') },
                    { segments: ['packages', 'core', 'tests', 'index.test.ts'], data: d('test') },
                    { segments: ['packages', 'ui', 'src', 'Button.tsx'], data: d('btn') },
                    { segments: ['packages', 'ui', 'src', 'Input.tsx'], data: d('inp') },
                    { segments: ['packages', 'ui'], data: d('ui') },
                    { segments: ['scripts', 'build.sh'], data: d('build') },
                    { segments: ['scripts', 'lint.sh'], data: d('lint') },
                ];


                test('компрессия off', function () {
                    assertUniqueIds(build(specs, 'off'));
                });

                test('компрессия on', function () {
                    assertUniqueIds(build(specs, 'on'));
                });

                test('компрессия on-aggressive', function () {
                    assertUniqueIds(build(specs, 'on-aggressive'));
                });
            });

            suite('стресс', function () {

                test('200 спецификаций — широкое дерево (mode: off)', function () {
                    const specs: HierarchyModel.Specs<TD> = Array.from({ length: 200 }, (_, i) => ({
                        segments: [`dir${i % 20}`, `sub${i % 7}`, `file${i}.ts`],
                        data: d(`f${i}`)
                    }));
                    assertUniqueIds(build(specs, 'off'));
                });

                test('20 уровней вложенности → один сжатый узел (mode: on-aggressive)', function () {
                    const segments = [
                        ...Array.from({ length: 20 }, (_, i) => `level${i}`),
                        'task.ts'
                    ];
                    const h = build([{ segments, data: d('t') }], 'on-aggressive');
                    assertUniqueIds(h);
                    assert.equal(h.children.length, 1);
                    assert.equal(h.children[0]!.children, null);
                });

            });
        });
    });
});
