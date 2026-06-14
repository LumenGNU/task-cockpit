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

// Базовые операции записи и чтения. Проверяет корректность pin()
// во всех вариантах входных данных и гарантию что get() отражает
// актуальное состояние — в том числе после пересоздания
// экземпляра (через реальный Memento).
suite('Pins — pin / get', function () {

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


    test(`${/*++N*/'001'/**/} get() на пустом хранилище возвращает пустую Map`, async function () {
        assert.equal(new Pins(memento).get().size, 0);
    });

    test(`${/*++N*/'002'/**/} pin → get возвращает запись`, async function () {
        const pins = new Pins(memento);
        await pins.pin(scope, task, defId);
        assert.equal(pins.get().get(scope)?.get(task), defId);
    });

    test(`${/*++N*/'003'/**/} definition = undefined сохраняется как null`, async function () {
        const pins = new Pins(memento);
        await pins.pin(scope, task, undefined);
        assert.equal(new Pins(memento).get().get(scope)?.get(task), null);
    });

    test(`${/*++N*/'004'/**/} pin добавляет задачу в существующий scope, не трогая остальные`, async function () {
        const other = 'watch' as TaskName;
        const pins = new Pins(memento);
        await pins.pin(scope, task, defId);
        await pins.pin(scope, other, defId);
        const scoped = new Pins(memento).get().get(scope);
        assert.ok(scoped);
        assert.equal(scoped.get(task), defId);
        assert.equal(scoped.get(other), defId);
    });

    test(`${/*++N*/'005'/**/} pin перезаписывает существующую задачу`, async function () {
        const defId2 = 'def-2' as DefinitionId;
        const pins = new Pins(memento);
        await pins.pin(scope, task, defId);
        await pins.pin(scope, task, defId2);
        assert.equal(new Pins(memento).get().get(scope)?.get(task), defId2);
    });

    test(`${/*++N*/'006'/**/} данные переживают пересоздание экземпляра`, async function () {
        await new Pins(memento).pin(scope, task, defId);
        assert.equal(new Pins(memento).get().get(scope)?.get(task), defId);
    });
});
