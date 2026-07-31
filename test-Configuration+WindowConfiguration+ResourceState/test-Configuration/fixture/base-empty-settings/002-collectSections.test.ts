import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from 'src/Configuration';



// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('collectSections', function () {

        test(`${/*++N*/'001'/**/} Одна секция верхнего уровня`, function () {

            const schema = Configuration.createSchema<{ mySetting: boolean; }>({
                mySetting: Configuration.BooleanSpec({ configKey: 'myExt.mySetting', fallback: true })
            });

            const collected = Configuration.collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['mySetting', ['myExt.mySetting']]
            ]));

        });


        test(`${/*++N*/'002'/**/} Многоуровневая секция`, function () {

            const schema = Configuration.createSchema<{}>({
                config: {
                    flags: {
                        key: Configuration.BooleanSpec({ configKey: 'ext.nested.key', fallback: true })
                    }
                }
            });

            const collected = Configuration.collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['config', ['ext.nested.key']]
            ]));
        });


        test(`${/*++N*/'003'/**/} Вложенный объект – одна секция с разными полями`, function () {

            const schema = Configuration.createSchema<{}>({
                ui: {
                    fontSize: Configuration.BooleanSpec({ configKey: 'editor.fontSize', fallback: true }),
                    fontFamily: Configuration.BooleanSpec({ configKey: 'editor.fontFamily', fallback: true })
                }
            });

            const collected = Configuration.collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['ui', ['editor.fontSize', 'editor.fontFamily']]
            ]));

        });

        test(`${/*++N*/'004'/**/} Вложенный объект – одна секция с полями разной вложенности`, function () {

            const schema = Configuration.createSchema<{}>({
                appearance: {
                    theme: {
                        name: Configuration.BooleanSpec({ configKey: 'workbench.theme.name', fallback: true })
                    },
                    custom: {
                        config: {
                            key: Configuration.BooleanSpec({ configKey: 'workbench.theme.customization', fallback: true })
                        }
                    }
                }
            });

            const collected = Configuration.collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['appearance', ['workbench.theme.name', 'workbench.theme.customization']]
            ]));

        });


        test(`${/*++N*/'005'/**/} Несколько секций`, function () {

            const schema = Configuration.createSchema<{}>({
                general: Configuration.BooleanSpec({ configKey: 'app.general', fallback: true }),
                advanced: {
                    logLevel: Configuration.BooleanSpec({ configKey: 'logger.logLevel', fallback: true })
                }
            });

            const collected = Configuration.collectSections(schema);

            assert.deepEqual(collected, new Map([
                ['general', ['app.general']],
                ['advanced', ['logger.logLevel']],
            ]));

        });

        test(`${/*++N*/'006'/**/} Пустая схема`, function () {

            const schema = Configuration.createSchema<{}>({});

            const collected = Configuration.collectSections(schema);

            assert.equal(collected.size, 0);

        });



    });
});
