import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import {
    createSchema,
    collectSections,
    SpecType
} from 'src/StateCoordinator/ConfigSchema/ConfigSchema';



// `${/*N=0*/'000'/**/}`

suite('ConfigSchema', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('collectSections', function () {

        test(`${/*++N*/'001'/**/} Поле с явной секцией (одно поле на верхнем уровне)`, function () {

            const schema = createSchema({ mySetting: { section: 'myExt', type: SpecType.Boolean, spec: { fallback: true } } });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['mySetting', ['myExt.mySetting']]
            ]));

        });

        test(`${/*++N*/'002'/**/} Поле без секции`, function () {

            const schema = createSchema({ mySetting: { section: '', type: SpecType.String, spec: { fallback: 'a' } } });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['mySetting', ['mySetting']]
            ]));

        });


        test(`${/*++N*/'003'/**/} Многоуровневая секция`, function () {

            const schema = createSchema({
                flag: {
                    section: 'ext.nested',
                    type: SpecType.Boolean,
                    spec: { fallback: false }
                }
            });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['flag', ['ext.nested.flag']]
            ]));
        });


        test(`${/*++N*/'004'/**/} Вложенный объект – несколько полей с разными секциями`, function () {

            const schema = createSchema<{}>({
                ui: {
                    fontSize: { section: 'editor', type: SpecType.Number, spec: { fallback: 12, min: 8, max: 32 } },
                    fontFamily: { section: 'editor', type: SpecType.String, spec: { fallback: 'monospace' } }
                }
            });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['ui', ['editor.fontSize', 'editor.fontFamily']]
            ]));

        });

        test(`${/*++N*/'005'/**/} Вложенный объект – комбинация пустых и непустых секций`, function () {

            const schema = createSchema<{}>({
                appearance: {
                    theme: { section: 'workbench', type: SpecType.StringLiteral, spec: { values: ['dark', 'light'], fallback: 'dark' } },
                    custom: { section: '', type: SpecType.String, spec: { fallback: '' } }
                }
            });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['appearance', ['workbench.theme', 'custom']]
            ]));

        });

        test(`${/*++N*/'006'/**/} Глубокая вложенность (три уровня)`, function () {

            const schema = createSchema({
                debug: {
                    breakpoints: {
                        enabled: { section: 'debugger', type: SpecType.Boolean, spec: { fallback: true } },
                        count: { section: '', type: SpecType.Number, spec: { fallback: 5 } }
                    }
                }
            });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['debug', ['debugger.enabled', 'count']]
            ]));

        });

        test(`${/*++N*/'007'/**/} Несколько независимых ветвей верхнего уровня`, function () {

            const schema = createSchema({
                general: { section: 'app', type: SpecType.Boolean, spec: { fallback: true } },
                advanced: {
                    logLevel: { section: 'logger', type: SpecType.StringLiteral, spec: { values: ['off', 'error', 'warn'], fallback: 'warn' } }
                }
            });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['general', ['app.general']],
                ['advanced', ['logger.logLevel']],
            ]));

        });

        test(`${/*++N*/'008'/**/} Пустая схема`, function () {

            const S = {};

            const schema = createSchema(S);

            const collected = collectSections(schema);

            assert.equal(collected.size, 0);

        });


        test(`${/*++N*/'009'/**/} Поле с секцией, одинаковых у разных полей – проверка дедупликации`, function () {

            const schema = createSchema({
                feature: {
                    a: { section: 'ext.sub', type: SpecType.Boolean, spec: { fallback: true } },
                    b: { section: 'ext.sub', type: SpecType.Number, spec: { fallback: 1 } }
                }
            });

            const collected = collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['feature', ['ext.sub.a', 'ext.sub.b']]
            ]));

        });

    });
});
