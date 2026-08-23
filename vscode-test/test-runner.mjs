#!/usr/bin/env -S bash -c 'NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; exec node "$1" "${@:2}"' --

// @ts-check

import * as C from './color.mjs';

// Проверка версии Node.js
const REQUIRED_NODE_MAJOR = 22;
const currentMajor = parseInt(process.versions.node.split('.')[0], 10);
if (currentMajor < REQUIRED_NODE_MAJOR) {
    process.stderr.write(
        `${C.fail('🛇 ')} Node.js v${REQUIRED_NODE_MAJOR}+ is required (current: v${process.versions.node})\n`
    );
    process.exit(1);
}

import sm from 'source-map-support';
sm.install();

// Конфигурация тест-раннера для фикстур —
// Предназначен для конфигурации запуска интеграционных тестов VS Code расширения,
// организованных по фикстурам.
// и компилируются в JavaScript в отдельный выходной каталог, независимо от остальных файлов расширения.
//
// Структура директорий
//
// project-root (CWD) /
// ├─ src/             ← структура с исходными файлами расширения
// │  ├─ **/*.ts
// │  └─ ...           (extension.ts расширения не используется в тестах)
// ...
// ├─ <SUT_TEST>/      ← структура с исходными файлами тестов (TypeScript)
// │  ├─ package.json       ← package.json
// │  ├─ extension.ts       ← extension.ts для тестового расширения
// │  ├─ fixtureA/
// │  │  ├─ *test.ts                 ← тест
// │  │  ├─ *.ts                     ← вспомогательные файлы
// │  │  ├─ ...
// │  │  ├─ *.*                      ← некомпилируемые файлы и директории — данные фикстуры (опционально)
// │  │  ├─ .vscode/                 ← (опционально)
// │  │  │  └─ ...
// │  │  ├─ fixtureA.code-workspace  ← (опционально, если есть workspace (имя_фикстуры.code-workspace) будет открыт в vscode)
// │  │  └─ ...
// ...
// │  ├─ fixtureB/
// │  │  └─ ...
// │  └─ ...
// ...
// ├─ <OUT_DIR>/            ← выходной каталог, подготовленный для запуска тестов
// │  ├─ <SUT_EXT>/         ← скомпилированные и подготовленные файлы расширения (из src/)
// │  │  ├─ **/*.js
// │  │  ├─ *
// │  │  └─ ...
// │  ├─ <SUT_TEST>/    ← скомпилированные файлы тестов, не содержит данных фикстур
// │  │  ├─ package.json       ← package.json
// │  │  ├─ extension.js       ← скомпилированный extension.js для тестового расширения
// │  │  ├─ fixtureA/
// │  │  │  ├─ *.js                  ← скомпилированные вспомогательные файлы
// │  │  │  ├─ *.test.js             ← скомпилированные тесты;
// │  │  │  └─ ...
// │  │  ├─ fixtureB/
// │  │  └─ ...
// ...
// └─ package.json    ← package.json расширения. не используется
// ...

// Данные из CWD/SUT_TEST/fixtureX/ — как запускать:

// workspaceFile
// isCustomExtensionJs
// isCustomPackageJson

// Данные из OUT_DIR/SUT_TEST/fixtureX/ — что запускать:

// testFiles (.test.js, не .test.ts)
// isCustomExtensionJs тоже отсюда — потому что нас интересует наличие скомпилированного extension.js, а не исходника

import { runTests } from '@vscode/test-electron';
import path from 'node:path';
import fs from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * @typedef { Object } Fixture
 * @property { string } fixtureName
 * @property { string[] } testFiles
 * @property { string } workspace
*/

const CWD = process.cwd();

const OUT_DIR = process.env.OUT_DIR ?? '';

if (!OUT_DIR) {
    throw new Error('OUT_DIR is not set');
}

if (!fs.existsSync(OUT_DIR)) {
    throw new Error(`Output directory not found: "${OUT_DIR}"`);
}

const SUT_TEST = process.env.SUT_TEST ?? 'test';

if (!fs.existsSync(SUT_TEST)) {
    throw new Error(`Test directory not found: "${SUT_TEST}"`);
}

const SUT_EXT = process.env.SUT_EXT ?? '';

if (!SUT_EXT) {
    throw new Error('SUT_EXT is not set');
}

if (!fs.existsSync(SUT_EXT)) {
    throw new Error(`Extension directory not found: "${SUT_EXT}"`);
}

const extensionDevelopmentPath = (() => {

    const developmentPath = path.join(CWD, OUT_DIR, SUT_TEST);

    const inPkgJson = path.join(CWD, SUT_TEST, 'package.json');

    if (!fs.existsSync(inPkgJson)) {
        throw new Error(`package.json not found in test suite: "${inPkgJson}"`);
    }

    // копирование package.json
    fs.copyFileSync(inPkgJson, path.join(developmentPath, 'package.json'));

    const extJs = path.join(CWD, OUT_DIR, SUT_TEST, 'extension.js');
    if (!fs.existsSync(extJs)) {
        throw new Error(`extension.js not found in test suite output: "${extJs}"`);
    }

    return developmentPath;
})();

const extensionTestsPath = path.resolve(CWD, path.join('.', '.vscode-test', 'mocha.cjs'));

const TESTS_RAW = process.env.TESTS;
const TESTS = TESTS_RAW?.split(path.delimiter) ?? ['test-*/*'];
// Формат каждого элемента: "fixture-glob/test-file-glob".
// к test-file-glob будет добавлен .test.js
// Примеры:
//   TESTS="test-basics/*"              — одна фикстура, все тесты
//   TESTS="test-*/suite"               — все фикстуры, конкретный файл
//   TESTS="test-a/* test-b/unit*"      — две пары


const VSC_VERSION = process.env.VSC_VERSION ?? '1.86.2';
const VSC_PROFILE = process.env.VSC_PROFILE;

const termCols = process.stdout.columns || 80;
const hrLength = Math.max(0, termCols - 3);


const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});


async function main() {

    process.stderr.write(`\nRun fixture tests [${formatter.format(new Date())}]\n`);

    process.stderr.write(`${'~'.repeat(hrLength)}\n`);

    const fixtures = findFixtures(TESTS);
    printFixtures(fixtures);

    const statsByFixture = await runFixtures(fixtures);

    const exitCode = printSummary(statsByFixture);

    return exitCode;
}

/**
 * @param { Map<string, Stats|'Fixture threw error'> } statsByFixture
 * @returns { number }
 */
function printSummary(statsByFixture) {

    process.stderr.write(`\n${'-'.repeat(hrLength)}\n`);
    process.stderr.write(`Summary:\n\n`);

    let totalFixtures = statsByFixture.size;
    let passedFixtures = 0;
    let failedFixtures = 0;
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let totalDuration = 0;
    let hasDuration = false;

    for (const [fixtureName, result] of statsByFixture) {

        if (!result) continue;

        if (result === 'Fixture threw error') {
            failedFixtures++;
            process.stderr.write(`  ‼ ${fixtureName.padEnd(20)} threw error\n`);
        } else {
            const stats = result;
            const failed = stats.failures > 0;
            if (failed) failedFixtures++; else passedFixtures++;

            const status = failed ? '✘' : '✔';
            const duration = stats.duration != null
                ? ` (${(stats.duration / 1000).toFixed(1)}s)`
                : '';

            process.stderr.write(
                `  ${status} ${fixtureName.padEnd(20)} ` +
                `${stats.tests} tests, ${stats.passes} passed, ${stats.failures} failed, ${stats.pending} skipped${duration}\n`
            );

            totalTests += stats.tests;
            totalPassed += stats.passes;
            totalFailed += stats.failures;
            totalPending += stats.pending;
            if (stats.duration != null) {
                totalDuration += stats.duration;
                hasDuration = true;
            }
        }
    }

    process.stderr.write(`\nFixtures: ${totalFixtures} total, ${passedFixtures} passed, ${failedFixtures} failed\n`);
    if (totalTests > 0) {
        process.stderr.write(`Tests:    ${totalTests} total, ${totalPassed} passed, ${totalFailed} failed, ${totalPending} skipped\n`);
    }
    if (hasDuration) {
        process.stderr.write(`Time:     ${(totalDuration / 1000).toFixed(1)}s\n`);
    }
    process.stderr.write(`${'~'.repeat(hrLength)}\n`);

    return totalFailed > 0 ? 1 : 0;
}

/**
 * @typedef { Object } Stats
 *   @property { number } suites
 *   @property { number } tests
 *   @property { number } passes
 *   @property { number } pending
 *   @property { number } failures
 *   @property { Date | undefined } [start]
 *   @property { Date | undefined } [end]
 *   @property { number | undefined } [duration]
*/


/**
 * @param { Fixture[] } fixtures
 * @returns { Promise<Map<string, Stats|'Fixture threw error'>> }
*/
async function runFixtures(fixtures) {

    /** @type { Map<string, Stats|'Fixture threw error'> } */
    const statsByFixture = new Map();

    for (const fixture of fixtures) {

        const tmpd = fs.mkdtempSync(`${tmpdir()}${path.sep}`);
        const tmpFile = path.join(tmpd, 'stats.json');

        try {
            await runFixture(fixture, tmpFile);

            /** @type { Stats } */
            const stats = JSON.parse(fs.readFileSync(tmpFile, { encoding: 'utf-8' }));

            statsByFixture.set(fixture.fixtureName, stats);
        }
        catch (error) {
            statsByFixture.set(fixture.fixtureName, 'Fixture threw error');
            process.stderr.write(`Fixture threw error: ${error}\n`);
        }
        finally {
            fs.rmSync(tmpd, { recursive: true, force: true });
        }
    }

    return statsByFixture;
}


/**
 * @param { Fixture } fixture
 * @param { string } summaryFile
 * @returns { Promise<void> }
*/
async function runFixture(fixture, summaryFile) {

    process.stderr.write(`\n${'˙'.repeat(hrLength)}\n`);
    process.stderr.write(`[${fixture.fixtureName}]\n\n`);

    if (!fs.existsSync(extensionTestsPath)) {
        throw new Error(`Extension test runner not found: "${extensionTestsPath}"`);
    }

    const errCode = await runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        version: VSC_VERSION,
        launchArgs: [
            fixture.workspace,
            '--disable-gpu',
            '--disable-telemetry',
            '--disable-crash-reporter',
            '--disable-extensions',
            '--locale', 'en-US',
            ...(VSC_PROFILE ? ['--profile', VSC_PROFILE] : []),
        ],
        extensionTestsEnv: {
            MOCHA_TEST_FILES: fixture.testFiles.join(path.delimiter),
            MOCHA_REPORTER: process.env.MOCHA_REPORTER,
            MOCHA_SLOW: process.env.MOCHA_SLOW,
            MOCHA_UI: process.env.MOCHA_UI,
            SUMMARY_FILE: summaryFile
        }
    });

    if (errCode > 0) {
        throw new Error(`Fixture "${fixture.fixtureName}" failed with exit code ${errCode}`);
    }
}


/**
 * @param { string } fixtureName
 * @param { string } testGlob
 * @returns { Fixture }
 */
function buildFixture(fixtureName, testGlob) {

    // данные фикстуры
    const srcFixturePath = path.join(fixtureName);

    if (!fs.existsSync(srcFixturePath)) {
        throw new Error(`Fixture source directory not found: "${srcFixturePath}"`);
    }

    // скомпилированные файлы фикстуры
    const outFixturePath = path.join(OUT_DIR, fixtureName);

    if (!fs.existsSync(outFixturePath)) {
        throw new Error(`Fixture output directory not found: "${outFixturePath}"`);
    }

    return {
        fixtureName,
        workspace: resolveWorkspace(fixtureName, srcFixturePath),
        testFiles: resolveTestFiles(outFixturePath, testGlob)
    };
}

/**
 * @param { string } fixtureName
 * @param { string } srcFixturePath
 * @returns { string }
 * */
function resolveWorkspace(fixtureName, srcFixturePath) {

    const fixtureBaseName = path.basename(fixtureName);

    const wsMatches =
        fs.globSync(path.join(srcFixturePath, `*.code-workspace`))
            .filter(ws => fixtureBaseName.endsWith(path.basename(ws, '.code-workspace')));

    if (wsMatches.length > 1) {
        throw new Error(`Multiple .code-workspace files found in "${srcFixturePath}"`);
    }

    return wsMatches[0] ?? srcFixturePath;
}


/**
 * @param { string } outFixturePath
 * @param { string } testGlob
 * @returns { string[] }
 * */
function resolveTestFiles(outFixturePath, testGlob) {

    const testFiles = fs.globSync(path.join(outFixturePath, `${testGlob}.test.js`));

    if (testFiles.length < 1) {
        throw new Error(`No test files found: "${path.join(outFixturePath, testGlob)}.test.js"`);
    }

    return testFiles;
}


/**
 * @param { string[] } globs — вида "fixture-glob/test-file-glob"
 * @returns {Fixture[]}
 */
function findFixtures(globs) {

    return globs.flatMap((glob) => {

        const sep = glob.indexOf('/');

        if (sep === -1) {
            throw new Error(`Invalid format: "${glob}" — expected "fixture/test-glob"`);
        }

        const fixtureGlob = glob.slice(0, sep);
        const testGlob = glob.slice(sep + 1);

        const matches =
            fs.globSync(path.join(SUT_TEST, fixtureGlob))
                .sort()
                .filter((fixture) => {
                    return fs.statSync(fixture).isDirectory();
                })
                // Добавляем фильтр: исключаем пути, где любой сегмент начинается с "~"
                .filter((fixture) => {
                    const relativePath = path.relative(SUT_TEST, fixture);
                    const segments = relativePath.split(path.sep);
                    // Если хотя бы один сегмент начинается с "~", отбрасываем
                    return !segments.some(segment => segment.startsWith('~'));
                });

        if (matches.length === 0) {
            throw new Error(`No fixtures found for pattern "${fixtureGlob}" in "${SUT_TEST}"`);
        }

        return matches.map(fixtureName => buildFixture(fixtureName, testGlob));
    });
}


/**
 * @param { Fixture[] } fixtures
 */
function printFixtures(fixtures) {

    process.stderr.write(`\nFixtures: ${fixtures.length}\n\n`);

    for (const [i, fixture] of fixtures.entries()) {
        process.stderr.write(`[${i + 1}/${fixtures.length}] ${fixture.fixtureName}\n`);
        process.stderr.write(`  workspace: ${fixture.workspace}\n`);
        process.stderr.write('  tests:\n');
        fixture.testFiles.forEach((test) => process.stderr.write(`    ⬝ ${test}\n`));

        process.stderr.write('\n');
    }
}


process.exit(
    await main()
);
