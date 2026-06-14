import { Memento, extensions } from 'vscode';
import * as assert from 'node:assert/strict';
import { type ExtExports } from 'src/extension';
import Pins from 'src/UserState/Pins';
import type ScopeKey from 'src/Scope/Key';
import type TaskName from 'src/type.d/TaskName';
import type DefinitionId from 'src/EligibleTask/DefinitionId';

const scope = 'test-scope' as ScopeKey;
const task = 'build' as TaskName;
const defId = 'def-1' as DefinitionId;

// `${/*N=0*/'000'/**/}`

// Операции удаления и их инварианты: scope исчезает когда пуст, остаётся
// когда нет, чужие scope'ы не затрагиваются.
// Проверяет изоляцию между scope'ами.
suite('Pins — unpin', function () {

    let memento: Memento;

    suiteSetup(async function () {
        const ext = extensions.getExtension<ExtExports>('papio-dev.task-cockpit');
        assert.ok(ext, 'расширение "papio-dev.task-cockpit" не найдено');
        await ext.activate();
        memento = ext.exports.memento;
        await memento.update(Pins.STORAGE_KEY, undefined);
    });

    setup(async function () {
        assert.equal(memento.get(Pins.STORAGE_KEY), undefined);
    });

    teardown(async function () {
        await memento.update(Pins.STORAGE_KEY, undefined);
    });


    test(`${/*++N*/'001'/**/} unpin последней задачи удаляет scope`, async function () {
        const pins = new Pins(memento);
        await pins.pin(scope, task, defId);
        await pins.unpin(scope, task);
        assert.equal(pins.get().size, 0);
        assert.ok(!new Pins(memento).get().has(scope));
    });

    test(`${/*++N*/'002'/**/} unpin одной задачи оставляет scope если есть другие`, async function () {
        const other = 'watch' as TaskName;
        const pins = new Pins(memento);
        await pins.pin(scope, task, defId);
        await pins.pin(scope, other, defId);
        await pins.unpin(scope, task);
        const result = new Pins(memento).get();
        assert.ok(result.has(scope));
        assert.ok(!result.get(scope)?.has(task));
        assert.ok(result.get(scope)?.has(other));
    });

    test(`${/*++N*/'003'/**/} unpin несуществующего scope не меняет хранилище`, async function () {
        const pins = new Pins(memento);
        await pins.pin(scope, task, defId);
        await pins.unpin('ghost' as ScopeKey, task);
        assert.ok(new Pins(memento).get().has(scope));
    });

    test(`${/*++N*/'004'/**/} несколько scope'ов независимы`, async function () {
        const scope2 = 'test-scope-2' as ScopeKey;
        const pins = new Pins(memento);
        await pins.pin(scope, task, defId);
        await pins.pin(scope2, task, defId);
        await pins.unpin(scope, task);
        const result = new Pins(memento).get();
        assert.ok(!result.has(scope));
        assert.ok(result.has(scope2));
    });
});
