// @ts-check

// vscode-unit-tests.mjs
// VS Code Unit Test Runner Configuration
//
// Конфигурация тест-раннера для unit-тестов —
// Предназначен для запуска unit-тестов расширения в едином экземпляре VS Code.
//
// Работает с @vscode/test-cli. Исходные тесты написаны на TypeScript и компилируются
// в JavaScript в отдельный выходной каталог, независимо от остальных файлов расширения.
//
// Структура директорий
//
// project-root (CWD) /
// ├─ src/
// │  └─ **/*.ts
// ├─ <SUT_TEST>/                       ← исходники тестов
// │  └─ unit/
// │     ├─ subdirA/
// │     │  ├─ *test.ts                 ← тест
// │     │  ├─ *.ts                     ← вспомогательные файлы
// │     │  └─ ...
// │     ├─ subdirB/
// │     └─ ...
// ...
// ├─ <OUT_DIR>/
// │  ├─ <SUT_EXT>/                     ← стабы расширения
// │  │  ├─ **/*.js
// │  │  ├─ *
// │  │  ├─ ...
// │  │  └─ extension.js
// │  ├─ <SUT_TEST>/
// │  │  └─ unit/                       ← скомпилированные unit-тесты
// │  │     ├─ subdirA/
// │  │     │  ├─ *.js
// │  │     │  └─ *.test.js
// │  │     ├─ subdirB/
// │  │     └─ ...
// │  └─ package.json
// └─ ...
//
// Все настройки управляются через переменные окружения:
//
// TESTS         — "Имя_Подпапки::Префикс_Теста"  (обязательная)
//                 "*::*"       — все тесты во всех подпапках
//                 "*::S1-"     — все S1-* тесты во всех подпапках
//                 "subdirA::*" — все тесты в subdirA
//                 Подпапки, имя которых начинается с "~" или ".", пропускаются при "*".
// OUT_DIR       — Выходной каталог, подготовленный для запуска тестов.
//                 (default: ~out-test)
// SUT_EXT       — Подкаталог внутри OUT_DIR со стабами расширения.
//                 (default: ~stripped)
// SUT_TEST      — Подкаталог с исходниками тестов относительно корня проекта.
//                 Используется для поиска исходников и скомпилированных тестов.
//                 (default: test)
// VSC_VERSION   — Версия VS Code для запуска тестов.
//                 (default: 1.86.2)
// VSC_PROFILE   — Имя профиля VS Code (--profile <name>). Если не задана — не передаётся.
// REPORTER      — Репортер Mocha. Если не задана — используется репортер по умолчанию.
// ------
// @todo
//
// MOCHA_TIMEOUT — Таймаут для тестов Mocha (в миллисекундах).  (5000)
// MOCHA_SLOW    — Порог «медленного» теста в Mocha (мс).       (750)
// OUT_TO_FILE   — Если задано значение true, y, yes (без учёта регистра), включается
//                 кастомный репортер, выводящий результаты в файл через *-reporter.mjs.
//
// Как организуется связка TS → JS
//
// Скрипт не занимается компиляцией. Он конфигурирует test-runner и ожидает уже готовые
// JavaScript-файлы, правильно размещённые в <OUT_DIR>/.
//
// Важно правильно настроить tsconfig.json.

import { defineConfig } from '@vscode/test-cli';
import fs from 'node:fs';
import path from 'node:path';
import * as c from './color.mjs';


const OUT_DIR = path.join(process.cwd(), process.env.OUT_DIR || '~out-test');
const SUT_TEST_REL = process.env.SUT_TEST || 'test';
const SUT_TEST = path.join(process.cwd(), SUT_TEST_REL);

const TEST_FILE_SUFFIX = 'test.js';


const TESTS = process.env.TESTS;

const [SUBDIR_NAME, TEST_PREFIX] = (() => {
    if (!TESTS || TESTS.trim().length < 1) {
        console.error(c.fail(`${c.bold('[Error]')}: TESTS environment variable is missing or empty.`));
        console.error(c.fail('  Expected format: TESTS="<subdir>::<prefix>"  (e.g. "*::*" or "myModule::S1-")'));
        process.exit(1);
    }
    const parts = TESTS.split('::');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
        console.error(c.fail(`${c.bold('[Error]')}: invalid TESTS value: "${TESTS}".`));
        console.error(c.fail('  Expected format: TESTS="<subdir>::<prefix>"  (e.g. "*::*" or "myModule::S1-")'));
        process.exit(1);
    }
    return [parts[0].trim(), parts[1].trim()];
})();


const VSC_VERSION = process.env.VSC_VERSION || '1.86.2';
const VSC_PROFILE = process.env.VSC_PROFILE;
const REPORTER = process.env.REPORTER;


const _SUT_EXT = (() => {
    const d = path.join(OUT_DIR, process.env.SUT_EXT || '~stripped');
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) {
        console.error(c.fail(`${c.bold('[Error]')}: extension stubs not found at '${d}'. Did you forget to build?`));
        process.exit(1);
    }
    return d;
})();


// --- defaults ---
const defaults = {
    version: VSC_VERSION,
    mocha: {
        ui: /** @type { 'tdd' } */('tdd'),
        reporter: REPORTER,
        diff: true,
        color: true,
        'full-trace': false,
        require: ['source-map-support/register'],
    },
    launchArgs: [
        '--disable-telemetry',
        '--disable-crash-reporter',
        ...(VSC_PROFILE ? ['--profile', VSC_PROFILE] : []),
    ],
    env: {
        'VK_ICD_FILENAMES': '',
    },
    extensionDevelopmentPath: OUT_DIR,
};
// ----------


const UNITS_SRC = (() => {
    const unitsSrc = path.join(SUT_TEST, 'unit');
    if (fs.existsSync(unitsSrc) && fs.statSync(unitsSrc).isDirectory()) {
        return unitsSrc;
    }
    console.error(c.fail(`${c.bold('[Error]')}: unit source directory '${unitsSrc}' does not exist or is not a directory.`));
    process.exit(1);
})();


const TEST_FILES_OUT = (() => {
    const testsOut = path.join(OUT_DIR, SUT_TEST_REL, 'unit');
    if (fs.existsSync(testsOut) && fs.statSync(testsOut).isDirectory()) {
        return testsOut;
    }
    console.error(c.fail(`${c.bold('[Error]')}: test output directory '${testsOut}' does not exist or is not a directory.`));
    process.exit(1);
})();


const subdirs = (() => {
    if (SUBDIR_NAME === '*') {
        const all = fs.readdirSync(UNITS_SRC, { withFileTypes: true })
            .filter(e => e.isDirectory() && !e.name.startsWith('~') && !e.name.startsWith('.'))
            .map(d => d.name)
            .sort(new Intl.Collator(undefined, {
                numeric: true,
                sensitivity: 'base',
            }).compare);

        if (all.length < 1) {
            console.error(c.fail(`${c.bold('[Error]')}: no subdirectories found in '${UNITS_SRC}'.`));
            process.exit(1);
        }
        return all;
    }
    const full = path.join(UNITS_SRC, SUBDIR_NAME);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        return [SUBDIR_NAME];
    }
    console.error(c.fail(`${c.bold('[Error]')}: specified unit subdirectory '${full}' not found or not a directory.`));
    process.exit(1);
})();


const files = (() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const result = [];

    for (const subdir of subdirs) {
        const outDir = path.join(TEST_FILES_OUT, subdir);
        if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
            console.error(c.fail(`${c.bold('[Error]')}: unit output subdirectory '${outDir}' not found or not a directory.`));
            process.exit(1);
        }

        const allFiles = fs.readdirSync(outDir, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.endsWith(TEST_FILE_SUFFIX))
            .map(f => path.join(outDir, f.name))
            .sort(collator.compare);

        const filtered = TEST_PREFIX === '*'
            ? allFiles
            : allFiles.filter(f => path.basename(f).startsWith(TEST_PREFIX));

        result.push(...filtered);
    }

    return result;
})();


if (files.length < 1) {
    console.error(c.fail(`${c.bold('[Error]')}: no test files ('*${TEST_FILE_SUFFIX}') found matching TESTS="${TESTS}".`));
    process.exit(1);
}


const reporterOptions = undefined;
// @todo OUT_TO_FILE


export default defineConfig({
    tests: [
        {
            label: 'unit',
            files,
            ...defaults,
            mocha: {
                ...defaults.mocha,
                ...(reporterOptions ? { reporterOptions } : {}),
            },
        },
    ],
});
