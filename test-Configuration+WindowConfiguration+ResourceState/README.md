вариант для windowConf тестов:

import * as assert from 'assert';
import * as vscode from 'vscode';
import { WindowConfiguration } from '../../extension'; // ваш путь
import { WindowSchema } from '../../WindowConfigurationSchema';

suite('WindowConfiguration', () => {
    let wc: WindowConfiguration;

    teardown(async () => {
        // Убедиться, что экземпляр удалён, а настройки сброшены
        if (wc && !wc.disposed) {
            wc.dispose();
        }
        // Вернуть конфигурацию к исходному состоянию, если меняли глобально
        const config = vscode.workspace.getConfiguration();
        // Например, удалить все window-ключи, которые вы изменяли
        // Проще всего использовать специальный тестовый workspace с изолированными настройками
    });

    test('initialization populates cache', () => {
        wc = new WindowConfiguration();
        // Проверяем, что getConfig возвращает значения по ключам схемы
        for (const key of wc.availableKeys) {
            const value = wc.getConfig(key);
            // Просто удостоверимся, что не undefined/не исключение
            assert.ok(value !== undefined, `Key ${key} should have a value`);
        }
    });

    test('onDidChange fires with correct affected keys', async () => {
        wc = new WindowConfiguration();

        // Подготовим ключ, который точно принадлежит window-секциям
        const testKey = [...WindowSchema.SECTIONS_BY_KEY.keys()][0];
        // Получим одну из секций, в которой живёт этот ключ
        const section = [...WindowSchema.SECTIONS_BY_KEY.get(testKey)!][0];

        // Подписываемся на событие
        const promise = new Promise<Set<string>>((resolve) => {
            const disposable = wc.onDidChange((affectedKeys) => {
                disposable.dispose();
                resolve(affectedKeys);
            });
        });

        // Изменяем настройку в этой секции через VS Code API
        const config = vscode.workspace.getConfiguration();
        await config.update(section, { /* новое значение, зависящее от типа */ }, vscode.ConfigurationTarget.Global);

        // Ждём события (с таймаутом)
        const affectedKeys = await promise;
        assert.ok(affectedKeys.has(testKey), `Expected affected keys to contain "${testKey}"`);
    });

    test('does not fire for unrelated section change', async () => {
        wc = new WindowConfiguration();

        let fired = false;
        const disposable = wc.onDidChange(() => {
            fired = true;
        });

        // Меняем настройку, которая точно не входит в WindowSchema.SECTIONS_BY_KEY
        const unrelatedSection = 'editor.fontSize'; // пример, убедитесь, что секция действительно не используется
        const config = vscode.workspace.getConfiguration();
        await config.update(unrelatedSection, 14, vscode.ConfigurationTarget.Global);

        // Даём немного времени на асинхронную обработку
        await new Promise(resolve => setTimeout(resolve, 500));

        assert.strictEqual(fired, false, 'Should not fire for unrelated configuration change');
        disposable.dispose();
    });

    test('getConfig after dispose throws', () => {
        wc = new WindowConfiguration();
        wc.dispose();
        assert.throws(() => wc.getConfig([...WindowSchema.SECTIONS_BY_KEY.keys()][0]));
    });

    test('configuration change is ignored after dispose', async () => {
        wc = new WindowConfiguration();
        wc.dispose();

        let fired = false;
        wc.onDidChange(() => { fired = true; }); // подписка после dispose, но всё равно проверим

        const testKey = [...WindowSchema.SECTIONS_BY_KEY.keys()][0];
        const section = [...WindowSchema.SECTIONS_BY_KEY.get(testKey)!][0];
        const config = vscode.workspace.getConfiguration();
        await config.update(section, /* значение */, vscode.ConfigurationTarget.Global);

        await new Promise(resolve => setTimeout(resolve, 500));
        assert.strictEqual(fired, false);
    });

    test('cache updates after configuration change', async () => {
        wc = new WindowConfiguration();
        const testKey = [...WindowSchema.SECTIONS_BY_KEY.keys()][0];
        const section = [...WindowSchema.SECTIONS_BY_KEY.get(testKey)!][0];

        const oldValue = wc.getConfig(testKey);

        // Меняем настройку на другое значение
        const config = vscode.workspace.getConfiguration();
        // Предположим, что значение — число
        const newValue = (typeof oldValue === 'number') ? oldValue + 1 : !oldValue;
        await config.update(section, newValue, vscode.ConfigurationTarget.Global);

        // Дожидаемся события
        await new Promise<void>(resolve => {
            const d = wc.onDidChange(() => {
                d.dispose();
                resolve();
            });
        });

        const updatedValue = wc.getConfig(testKey);
        // Сравниваем; учтите, что значение может быть объектом — тогда глубокое сравнение
        assert.deepStrictEqual(updatedValue, newValue);
    });
});
