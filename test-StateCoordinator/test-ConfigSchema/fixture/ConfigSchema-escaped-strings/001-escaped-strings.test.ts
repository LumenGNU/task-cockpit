import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import {
    createSchema,
    SpecType,
    coerce
} from 'src/StateCoordinator/ConfigSchema/ConfigSchema';



// В settings.json:
//
// "escapedStrings": {
//     // \u0000 — валиден в JSON по RFC 8259, но некоторые тулзы не любят
//     // VS Code парсит через собственный движок — должно пройти
//     "nullByte": "\u0000",
//     "newline": "\n",
//     "tab": "\t",
//     // emoji — surrogate pair в UTF-16, length === 2 без u-флага
//     "emoji": "😀",
//     // combining: e (U+0065) + combining accent (U+0301) = 2 code points, 1 grapheme
//     "combining": "e\u0301",
//     // zero-width space
//     "zwsp": "\u200B",
//     // буквально backslash-x-0-0 (4 символа), не escape
//     "literalEscape": "\\x00"
//     "singleBackslash": "\\"   // → JS: '\', 1 символ
// }

// `${/*N=0*/'000'/**/}`

suite('ConfigSchema', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('escaped-strings (спецсимволы в значениях)', function () {

        const baseSection = 'escapedStrings';
        const configurationScope = null;

        suiteSetup(function () {
            const cfg = vscode.workspace.getConfiguration(baseSection);
            assert.ok(cfg.has('nullByte'));
            assert.ok(cfg.has('newline'));
            assert.ok(cfg.has('tab'));
            assert.ok(cfg.has('emoji'));
            assert.ok(cfg.has('combining'));
            assert.ok(cfg.has('zwsp'));
            assert.ok(cfg.has('literalEscape'));
            assert.ok(cfg.has('singleBackslash'));
        });

        test(`${/*++N*/'001'/**/} null byte проходит /^.$/ — возвращает значение`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ nullByte: string; }>({
                nullByte: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/ } }
            });
            assert.equal(coerce(configObj, schema).nullByte, '\u0000');
        });

        test(`${/*++N*/'002'/**/} newline не проходит /^.$/ — возвращает фолбек`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ newline: string; }>({
                newline: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/ } }
            });
            assert.equal(coerce(configObj, schema).newline, 'fallback');
        });

        test(`${/*++N*/'003'/**/} tab проходит /^.$/ — возвращает значение`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ tab: string; }>({
                tab: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/ } }
            });
            assert.equal(coerce(configObj, schema).tab, '\t');
        });

        test(`${/*++N*/'004'/**/} emoji без u-флага не проходит /^.$/ — возвращает фолбек`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ emoji: string; }>({
                emoji: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/ } }
            });
            assert.equal(coerce(configObj, schema).emoji, 'fallback');
        });

        test(`${/*++N*/'005'/**/} emoji с u-флагом проходит /^.$/u — возвращает значение`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ emoji: string; }>({
                emoji: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/u } }
            });
            assert.equal(coerce(configObj, schema).emoji, '😀');
        });

        test(`${/*++N*/'006'/**/} combining sequence не проходит /^.$/u — возвращает фолбек`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            // e + U+0301 = 2 code points, grapheme-уровень regex не знает
            const schema = createSchema<{ combining: string; }>({
                combining: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/u } }
            });
            assert.equal(coerce(configObj, schema).combining, 'fallback');
        });

        test(`${/*++N*/'007'/**/} zero-width space проходит /^.$/ — возвращает значение`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ zwsp: string; }>({
                zwsp: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/ } }
            });
            assert.equal(coerce(configObj, schema).zwsp, '\u200B');
        });

        test(`${/*++N*/'008'/**/} литеральный \\x00 проходит /^\\x00$/ — возвращает значение`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ literalEscape: string; }>({
                literalEscape: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(\\x00$|fallback)/ } }
            });
            assert.equal(coerce(configObj, schema).literalEscape, '\\x00');
        });

        test(`${/*++N*/'009'/**/} одинокий \\ проходит /^.$/ — возвращает значение`, function () {

            const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

            const schema = createSchema<{ singleBackslash: string; }>({
                singleBackslash: { section: '', type: SpecType.String, spec: { fallback: 'fallback', pattern: /^(.|fallback)$/ } }
            });
            assert.equal(coerce(configObj, schema).singleBackslash, '\\');
        });
    });
});
