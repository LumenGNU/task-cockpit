import * as assert from 'assert/strict';
import type * as TC from '../types';
import helpers from '../helpers';
import Folders from '../Cockpit/TreeModel/Folders';


// Scope

/** Создаёт TC.Scope с минимально валидным URI. */
function makeScope(name: string, file: TC.File): TC.Scope {
    return { name, uri: helpers.resolveUri(file) };
}


// TaskDefinition

/** Минимальный TaskDefinition. Переопределяемые поля передаются явно. */
function makeDefinition(
    file: TC.File,
    name: TC.Name,
    overrides?: Partial<Pick<TC.TaskDefinition, 'hidden' | 'group'>>
): TC.TaskDefinition {
    return {
        id: helpers.buildId(file, name),
        hidden: undefined,
        icon: {},
        ...overrides,
    };
}



// BranchConfig

/** Создаёт BranchConfig с дефолтами: иерархия выключена, группировка выключена. */
function makeBranchConfig(
    overrides?: Partial<TC.BranchConfig>
): TC.BranchConfig {
    return {
        segmentSeparator: false,
        useGroupKind: false,
        ...overrides,
    };
}


// Карты

/** Собирает DefinitionsByFile из пар [file, entries]. */
function makeDefinitionsByFile(
    entries: Array<[TC.File, Array<[TC.Name, TC.TaskDefinition]>]>
): TC.DefinitionsByFile {
    return new Map(
        entries.map(([file, tasks]) => [file, new Map(tasks)])
    );
}


/** Собирает BranchConfigByFile из пар [file, config]. */
function makeBranchConfigByFile(
    entries: Array<[TC.File, TC.BranchConfig]>
): TC.BranchConfigByFile {
    return new Map(entries);
}


function createName(name: string): TC.Name {
    if (helpers.isName(name)) {
        return name;
    }
    throw `createName: This cannot be used as a name: "${name}"`;
}



suite('@module Cockpit/Tree/FolderRoots', function () {

    suite('build', () => {

        // Минимальный валидный результат. Покрывает дефолтное поведение всех свойств. 
        test('single scope with single task', function () {

            const file = '/workspace/app/.vscode/tasks.json' as TC.File;
            const name = createName('build');
            const def = makeDefinition(file, name);

            const folders = Folders.buildEntities(
                [makeScope('app', file)],
                makeDefinitionsByFile([[file, [[name, def]]]]),
                makeBranchConfigByFile([[file, makeBranchConfig()]]),
            );

            assert.strictEqual(folders.length, 1);

            const folder = folders[0];
            assert.strictEqual(folder.name, 'app');
            assert.strictEqual(folder.tasksFile, file);
            assert.strictEqual(folder.kind, 'Folder');
            assert.strictEqual(folder.hidden, false);

            const children = folder.children;

            assert.strictEqual(children.length, 1);

            const child = children.at(0);
            assert.ok(child);
            assert.ok(Folders.Entity.Child.isRunnable(child));
            assert.deepStrictEqual(
                JSON.stringify(child),
                JSON.stringify(def)
            );

        });

        suite('scope filtering', () => {

            // Scope без записи в definitionsByFile — пропускается.
            test('skips scope missing from definitionsByFile', function () {
                const file = '/workspace/app/.vscode/tasks.json' as TC.File;

                const result = Folders.buildEntities(
                    [makeScope('app', file)],
                    makeDefinitionsByFile([]), // пусто — scope не найдётся
                    makeBranchConfigByFile([
                        [file, makeBranchConfig()]
                    ]),
                );

                assert.deepStrictEqual(result, []);
            });

        });

        // Путь не заканчивается на .json → kind = "Workspace".
        test('kind is Workspace for non-.json path', function () {
            const file = '/workspace/project.code-workspace' as TC.File;
            const name = createName('build');
            const def = makeDefinition(file, name);

            const result = Folders.buildEntities(
                [makeScope('project', file)],
                makeDefinitionsByFile([[file, [[name, def]]]]),
                makeBranchConfigByFile([[file, makeBranchConfig()]]),
            );

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].kind, 'Workspace');
        });


        // scope.name есть в excludeNames → hidden = true.
        test('hidden is true when scope.name is in excludeNames', function () {

            const file = '/workspace/app/.vscode/tasks.json' as TC.File;

            const name = createName('build');
            const def = makeDefinition(file, name);

            const result = Folders.buildEntities(
                [makeScope('app', file)],
                makeDefinitionsByFile([[file, [[name, def]]]]),
                makeBranchConfigByFile([[file, makeBranchConfig()]]),
                ['app'], // исключаем
            );

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result.at(0)?.hidden, true);
        });


        suite('branch specs: useGroupKind × segmentSeparator', () => {

            // useGroupKind = false, сепаратор задан — сегменты из Splitter, group игнорируется.
            test('splits by separator, ignores group', function () {

                const file = '/workspace/app/.vscode/tasks.json' as TC.File;
                const name = createName('build:dev');
                const def = makeDefinition(file, name, { group: { kind: 'build', isDefault: false } });

                const folders = Folders.buildEntities(
                    [makeScope('app', file)],
                    makeDefinitionsByFile([[file, [[name, def]]]]),
                    makeBranchConfigByFile([[file, makeBranchConfig({ segmentSeparator: ':' })]]),
                );

                const folder = folders[0];
                const children = folder.children;
                assert.strictEqual(children.length, 1, 'one top-level branch "build"');

                const buildNode = children.at(0)!;
                assert.ok(!Folders.Entity.Child.isRunnable(buildNode), '"build" is an intermediate node');
                assert.ok(Folders.Entity.Child.isGroup(buildNode));
                const devNode = Folders.Entity.Child.getChildren(buildNode).at(0);
                assert.ok(devNode);
                assert.ok(Folders.Entity.Child.isRunnable(devNode), '"dev" is the task node');

                assert.deepStrictEqual(
                    JSON.stringify(devNode),
                    JSON.stringify(def)
                );
            });

            // useGroupKind = true, group.kind есть, сепаратор пуст — [kind, name].
            test('prepends group.kind without splitting', function () { });

            // useGroupKind = true, group.kind есть, сепаратор задан — [kind, ...split(name)].
            test('prepends group.kind and splits name', function () { });

            // useGroupKind = true, group.kind отсутствует — без prepend.
            test('no prepend when group.kind is undefined', function () { });
        });


        suite('Edges', function () {

            test('result order matches scopes order', function () {

                const fileA = '/prj/project.code-workspace' as TC.File;
                const fileB = '/workspace/beta/.vscode/tasks.json' as TC.File;
                const fileC = '/workspace/gamma/.vscode/tasks.json' as TC.File;

                const nameA = createName('taskA');
                const nameB = createName('taskB');
                const nameC = createName('taskC');

                const definitions = makeDefinitionsByFile([
                    [fileA, [[nameA, makeDefinition(fileA, nameA)]]],
                    [fileB, [[nameB, makeDefinition(fileB, nameB)]]],
                    [fileC, [[nameC, makeDefinition(fileC, nameC)]]],
                ]);

                const configs = makeBranchConfigByFile([
                    [fileA, makeBranchConfig()],
                    [fileB, makeBranchConfig()],
                    [fileC, makeBranchConfig()],
                ]);

                const scopesOrder1 = [
                    makeScope('gamma', fileC),
                    makeScope('beta', fileB),
                    makeScope('alpha', fileA),
                ];

                const scopesOrder2 = [
                    makeScope('alpha', fileA),
                    makeScope('gamma', fileC),
                    makeScope('beta', fileB),
                ];

                const result1 = Folders.buildEntities(scopesOrder1, definitions, configs);
                const result2 = Folders.buildEntities(scopesOrder2, definitions, configs);

                assert.deepStrictEqual(result1.map(r => r.name), ['gamma', 'beta', 'alpha']);
                assert.deepStrictEqual(result2.map(r => r.name), ['alpha', 'gamma', 'beta']);
            });

        });


    });
});