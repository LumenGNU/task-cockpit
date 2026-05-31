import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import createReader from 'src/Configuration/Global/createReader';


// `${/*N=0*/'000'/**/}`

suite('Configuration Global — дополнительные проверки после схемы', function () {

    suite('polling.cap >= polling.min * 1.7', function () {


        test(`${/*++N*/'001'/**/} cap и min — значения по умолчанию (нет в конфигурации)`, function () {

            const CFG_SECTION = 'emptyConfig';
            const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
            assert.ok(!cfg.get('monitor.polling.min'));
            assert.ok(!cfg.get('monitor.polling.cap'));

            const reader = createReader(CFG_SECTION);
            const { cockpit: { monitor: { polling: { cap, min } } } } = reader.read();

            assert.ok(cap > (min * 1.7));

        });

        test(`${/*++N*/'002'/**/} cap указан, min — нет`, function () {

            const CFG_SECTION = 'onlyCap';
            const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
            assert.ok(!cfg.get('monitor.polling.min'));
            assert.equal(cfg.get('monitor.polling.cap'), 1000);

            const reader = createReader(CFG_SECTION);
            const { cockpit: { monitor: { polling: { cap, min } } } } = reader.read();

            assert.ok(cap >= (min * 1.7));

        });


        test(`${/*++N*/'003'/**/} min указан, cap — нет`, function () {

            const CFG_SECTION = 'onlyMin';
            const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
            assert.equal(cfg.get('monitor.polling.min'), 1000);
            assert.ok(!cfg.get('monitor.polling.cap'));

            const reader = createReader(CFG_SECTION);
            const { cockpit: { monitor: { polling: { cap, min } } } } = reader.read();

            assert.ok(cap >= (min * 1.7), `fail. cap: ${cap}, min: ${min}`);
        });


        test(`${/*++N*/'004'/**/} cap ниже порога → поднимается до min * 1.7`, function () {

            const CFG_SECTION = 'S_1';
            const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
            assert.equal(cfg.get('monitor.polling.min'), 1000);
            assert.equal(cfg.get('monitor.polling.cap'), 500);

            const reader = createReader(CFG_SECTION);
            const { cockpit: { monitor: { polling: { cap, min } } } } = reader.read();

            assert.ok(cap >= (min * 1.7));
            assert.equal(cap, 1700);
        });


        test(`${/*++N*/'005'/**/} cap точно на пороге → не трогается`, function () {

            const CFG_SECTION = 'S_2';
            const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
            assert.equal(cfg.get('monitor.polling.min'), 1100);
            assert.equal(cfg.get('monitor.polling.cap'), 1870);

            const reader = createReader(CFG_SECTION);
            const { cockpit: { monitor: { polling: { cap, min } } } } = reader.read();

            assert.ok(cap >= (min * 1.7));
            assert.equal(cap, 1870);
        });


        test(`${/*++N*/'006'/**/} cap выше порога → не трогается`, function () {

            const CFG_SECTION = 'S_3';
            const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
            assert.equal(cfg.get('monitor.polling.min'), 1000);
            assert.equal(cfg.get('monitor.polling.cap'), 1800);

            const reader = createReader(CFG_SECTION);
            const { cockpit: { monitor: { polling: { cap, min } } } } = reader.read();

            assert.ok(cap >= (min * 1.7));
            assert.equal(cap, 1800);
        });

    });

});
