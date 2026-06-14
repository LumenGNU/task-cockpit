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

// Имена задач и scope'ов совпадающие с ключами
// Object.prototype (constructor, toString и т.д.) безопасны в
// Object.create(null), но эта защита исчезает после IPC round-trip. <-- почему? я не верю.
// Тесты проверяют что реальный Memento не ломает хранилище
// на таких именах.
suite('Pins — prototype key resilience', function () {

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


    test(`${/*++N*/'001'/**/} TaskName = "constructor" не ломает хранилище`, async function () {
        const pins = new Pins(memento);
        await pins.pin(scope, 'constructor' as TaskName, undefined);
        assert.ok(new Pins(memento).get().get(scope)?.has('constructor' as TaskName));
    });

    test(`${/*++N*/'002'/**/} ScopeKey = "toString" не ломает хранилище`, async function () {
        const pins = new Pins(memento);
        await pins.pin('toString' as ScopeKey, task, defId);
        assert.ok(new Pins(memento).get().has('toString' as ScopeKey));
    });

    test(`${/*++N*/'003'/**/} ScopeKey = "toString" после round-trip`, async function () {
        await new Pins(memento).pin('regular' as ScopeKey, task, defId);
        // теперь при следующем #read() придёт {} с прототипом
        const pins = new Pins(memento);
        await pins.pin('toString' as ScopeKey, task, defId);
        const result = new Pins(memento).get();
        assert.equal(result.get('toString' as ScopeKey)?.get(task), defId);
    });
});
