// @ts-check
// vscode-fixture-tests.mjs
// VS Code Fixture Test Runner Configuration


// Конфигурация тест-раннера для фикстур —
// Предназначен для конфигурации запуска интеграционных тестов VS Code расширения,
// организованных по фикстурам.
// Работает с @vscode/test-cli и учитывает, что исходные тесты написаны на TypeScript
// и компилируются в JavaScript в отдельный выходной каталог, независимо от остальных файлов расширения.
//
// Структура директорий
//
// project-root (CWD) /
// ├─ src/             ← структура с исходными файлами расширения
// │  ├─ **/*.ts
// │  └─ *
// ├─ <SUT_TEST>/      ← структура с исходными файлами тестов
// │  └─ fixture/          ← исходники фикстур (TypeScript)
// │     ├─ fixtureA/
// │     │  ├─ *test.ts                 ← тест
// │     │  ├─ *.ts                     ← вспомогательные файлы
// │     │  ...
// │     │  ├─ *.*                      ← некомпилируемые файлы и директории — данные фикстуры (опционально)
// │     │  ├─ .vscode/                 ← (опционально)
// │     │  │  └─ ...
// │     │  ├─ fixtureA.code-workspace  ← (опционально, если есть workspace будет открыт в vscode)
// │     │  └─ ...
// │     ├─ fixtureB/
// │     └─ ...
// ...
// ├─ <OUT_DIR>/            ← выходной каталог, подготовленный для запуска тестов
// │  ├─ <SUT_EXT>/         ← скомпилированные и подготовленные файлы расширения (из src/)
// │  │  ├─ **/*.js
// │  │  ├─ *
// │  │  ├─ ...
// │  │  └─ extension.js
// │  ├─ <SUT_TEST>/    ← скомпилированные файлы тестов
// │  │  └─ fixture/
// │  │     ├─ fixtureA/
// │  │     │  ├─ *.js                  ← скомпилированные вспомогательные файлы
// │  │     │  └─ *.test.js             ← скомпилированные тесты; имя файла = "Лейбл_Теста"
// │  │     ├─ fixtureB/
// │  │     └─ ...
// │  └─ package.json       ← подготовленный package.json ("main": "<SUT_EXT>/extension.js")
// ├─ ...
// ...
//
// Важно:
//
// Для каждой фикстуры в ~out-test/test/fixture/<fixture>/ должен быть хотя бы один файл с именем *test.js
// Именно они будут выполняться.
//
// Процесс компиляции и запуска
// Разработчик пишет тесты в test/fixture/<fixture>/
// - Система сборки компилирует ts в ~out-test/test/fixture/<fixture>/ с сохранением структуры и суффиксами .js.
// - Данные фикстуры **не переносятся**, и остаются в test/fixture/<fixture>/.
// - Скомпилированные и подготовленные файлы расширения помещаются в ~out-test/SUT_EXT.
//
// Запуск тестов осуществляется командой, передающей необходимые переменные окружения и
// использующей @vscode/test-cli. Конфигурационный файл vscode-fixture-tests.mjs автоматически:
// - Определяет, какие фикстуры запускать: фильтрует по лейблу.
// - Для каждой фикстуры находит соответствующую рабочую область: если есть <fixture>.code-workspace
//   в исходной папке фикстуры, используется он, иначе — сама исходная папка фикстуры.
// - Собирает все *test.js файлы из выходной папки фикстуры, подходящих под фильтр, и подставляет их в качестве
//   тестовых файлов.
// - Применяет глобальные настройки (версия VS Code, параметры Mocha, аргументы запуска).
// - Если включен вывод в файл — формирует сооьвеьсьвующие настройки для репортера.
//
// Все настройки управляются через переменные окружения:
//
// OUT_DIR        — Выходной каталог, подготовленный для запуска тестов.
//                  (default: ~out-test)
// SUT_EXT        — Подкаталог внутри OUT_DIR, куда помещаются скомпилированные файлы расширения.
//                  (default: src)
// SUT_TEST       — Подкаталог с исходниками тестов относительно корня проекта.
//                  Используется для поиска фикстур и скомпилированных тестов.
//                  (default: test)
// TESTS          — Фильтр запуска в формате "Имя_Фикстуры::Префикс_Теста". (обязательная)
//                  "Имя_Фикстуры" — точное совпадение с именем каталога в <SUT_TEST>/fixture/.
//                  "Префикс_Теста" — сопоставляется с именами *.test.js файлов в каталоге фикстуры.
//                  "*" в любой позиции означает "все".
//                  Примеры: "*::*", "fixtureA::*", "*::S1-", "fixtureA::S1-"
// VSC_VERSION    — Версия VS Code для запуска тестов.
//                  (default: 1.86.2)
// REPORTER       — Репортер Mocha. Если не задана, используется репортер по умолчанию.
//                  (default: не задан)
// MOCHA_SLOW      — Порог «медленного» теста в Mocha(мс).    (750)
// ------
// @todo
//
// MOCHA_TIMEOUT   — Таймаут для тестов Mocha (в миллисекундах).    (5000)
// OUT_TO_FILE     — Если задано значение true, y, yes(без учёта регистра), включается кастомный репортер,
//                   выводящий результаты в файл через *-reporter.mjs.
//
// Пример запуска всех тестов с параметрами:
// ~~~
// TESTS = '*::*' VSC_VERSION = 1.85.0 MOCHA_TIMEOUT = 10000 npx vscode
// ~~~
//
// Как организуется связка TS → JS
//
// Скрипт **не занимается компиляцией**. Он конфигурирует test-runner, и ожидает уже готовые JavaScript-файлы,
// правильно размещенные в ~out-test/.
//
// Важно правильно настроить tsconfig.json.
//
// Дополнительные замечания:
// Проверка коллизий имён(label) предупредит, если две фикстуры получили одинаковое имя (возможно при ручном изменении списка `suites`).
//
// Если фильтр TESTS собрал пустой список  — выполнение прервётся с ошибкой.
// Если reporter.cjs не найден при включённом OUT_TO_FILE — выполнение прервётся с ошибкой.
//
// Каждая "фикстура" это отдельный запуск экземпляра VS Code и отдельный файл отчета.

// @todo VSC_PROFILE -- смотри vscode-unit-tests
// @todo пропускать имена начинающиеся с ~ или . -- смотри vscode-unit-tests
// @todo Библиотека цветов -- нужно использовать ./color.mjs -- смотри vscode-unit-tests

import { defineConfig } from '@vscode/test-cli';
import fs from 'node:fs';
import path from 'node:path';
import * as c from './color.mjs';

const OUT_DIR = path.join(process.cwd(), process.env.OUT_DIR || '~out-test');
const SUT_TEST_REL = process.env.SUT_TEST || 'test';
const SUT_TEST = path.join(process.cwd(), SUT_TEST_REL);
const VSC_PROFILE = process.env.VSC_PROFILE;

const TEST_FILE_SUFFIX = 'test.js';

const MOCHA_SLOW = Number(process.env.MOCHA_SLOW) || 750;


// Специальное имя '*' для "все"
const TESTS = process.env.TESTS;

const [FIXTURE_NAME, TEST_PREFIX] = (() => {
    if (!TESTS || TESTS.trim().length < 1) {
        console.error(c.fail(`${c.bold('[Error]')}: TESTS environment variable is missing or empty.`));
        console.error(c.warn('  Expected format: TESTS="<fixture>::<prefix>"  (e.g. "*::*" or "fixtureA::S1-")'));
        process.exit(1);
    }
    const parts = TESTS.split('::');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
        console.error(c.fail(`${c.bold('[Error]')}: invalid TESTS value: "${TESTS}".`));
        console.error(c.warn('  Expected format: TESTS="<fixture>::<prefix>"  (e.g. "*::*" or "fixtureA::S1-")'));
        process.exit(1);
    }
    return [parts[0].trim(), parts[1].trim()];
})();

const VSC_VERSION = process.env.VSC_VERSION || '1.86.2';


const SUT_EXT_REL = process.env.SUT_EXT || 'src';

const SUT_OUT = (() => {
    const d = path.join(OUT_DIR, SUT_EXT_REL);
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) {
        console.error(c.fail(`${c.bold('[Error]')}: compiled extension not found at '${d}'. Did you forget to build?`));
        process.exit(1);
    }
    return d;
})();

// if (TEST_REPORT_TO_FILE) {
//     if (!REPORT_DIR) {
//         console.error(chalk.red('[Error]: REPORT_DIR is required when OUT_TO_FILE is set'));
//         process.exit(1);
//     }
// }

const REPORTER = process.env.REPORTER;


// --- defaults ---
const defaults = {
    version: VSC_VERSION,
    extensionDevelopmentPath: OUT_DIR, // где находится package.json
    launchArgs: [
        // '--disable-gpu',
        '--disable-telemetry',
        '--disable-crash-reporter',
        '--disable-extensions',
        ...(VSC_PROFILE ? ['--profile', VSC_PROFILE] : []),
        // '--disable-workspace-trust',
        // '--no-sandbox',
    ],
    mocha: {
        ui: /** @type { 'tdd' } */('tdd'),
        reporter: REPORTER,
        diff: true,
        color: true,
        'full-trace': false,
        require: ['source-map-support/register'],
        "node-option": ["unhandled-rejections=strict"],
        slow: MOCHA_SLOW
    },
    env: {
        // "DRI_PRIME": "1",
        // "LIBVA_DRIVER_NAME": "radeonsi",
        'VK_ICD_FILENAMES': '',
    }
};
// ----------



// Фикстуры и исходники тестов
const FIXTURE_SRC = (() => {
    const fixtureSrc = path.join(SUT_TEST, 'fixture');
    if (fs.existsSync(fixtureSrc) && fs.statSync(fixtureSrc).isDirectory()) {
        return fixtureSrc;
    }
    console.error(c.fail(`${c.bold('[Error]')}: fixture source directory '${fixtureSrc}' does not exist or is not a directory.`));
    process.exit(1);
})();


// .js тестов
const TEST_FILES_OUT = (() => {
    const testsOut = path.join(OUT_DIR, SUT_TEST_REL, 'fixture');
    if (fs.existsSync(testsOut) && fs.statSync(testsOut).isDirectory()) {
        return testsOut;
    }
    console.error(c.fail(`${c.bold('[Error]')}: test output directory '${testsOut}' does not exist or is not a directory.`));
    process.exit(1);
})();


// фикстуры для запуска
// '*' - все. конкретная - конкретная
const fixtures = (() => {
    if (FIXTURE_NAME === '*') {
        const all = fs.readdirSync(FIXTURE_SRC, { withFileTypes: true })
            .filter(e => e.isDirectory() && !e.name.startsWith('~') && !e.name.startsWith('.'))
            .map(d => d.name)
            .sort(new Intl.Collator(undefined, {
                numeric: true,      // Sort numbers numerically (1, 2, 10)
                sensitivity: 'base', // Ignore accents/case differences
            }).compare);

        if (all.length < 1) {
            console.error(c.fail(`${c.bold('[Error]')}: no fixture directories found in '${FIXTURE_SRC}'.`));
            process.exit(1);
        }
        return all;
    }
    const full = path.join(FIXTURE_SRC, FIXTURE_NAME);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        return [FIXTURE_NAME];
    }
    console.error(c.fail(`${c.bold('[Error]')}: specified fixture directory '${full}' not found or not a directory.`));
    process.exit(1);
})();


const tests = [

    ...fixtures.map((fixture) => {

        const dir = path.join(FIXTURE_SRC, fixture);
        const workspace = path.join(dir, `${fixture}.code-workspace`);

        const out = (() => {
            const d = path.join(TEST_FILES_OUT, fixture);
            if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
                return d;
            }
            console.error(c.fail(`${c.bold('[Error]')}: specified fixture output directory '${d}' not found or not a directory.`));
            process.exit(1);
        })();


        const allFiles = fs.readdirSync(out, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.endsWith(TEST_FILE_SUFFIX))
            .map(f => path.join(out, f.name))
            .sort(new Intl.Collator(undefined, {
                numeric: true,      // Sort numbers numerically (1, 2, 10)
                sensitivity: 'base', // Ignore accents/case differences
            }).compare);

        const includes =
            TEST_PREFIX === '*'
                ? allFiles
                : allFiles.filter(f => path.basename(f).startsWith(TEST_PREFIX));


        if (includes.length < 1 && TEST_PREFIX === '*') {
            console.error(c.fail(`${c.bold('[Error]')}: no test files ('*${TEST_FILE_SUFFIX}') found in '${out}'.`));
            process.exit(1);
        }


        // не запускать фикстуру если ncludes.length < 1
        if (includes.length < 1) {
            if (TEST_PREFIX !== '*') {
                // больше информации если TEST_PREFIX !== '*'
                console.warn(c.warn(`${c.bold('[Warn]')}: no test files ('${TEST_PREFIX}*${TEST_FILE_SUFFIX}') found in '${path.relative(SUT_OUT, dir)}'. The fixture will be skipped.`));
            }
            return null;
        }

        const reporterOptions = undefined;
        // @todo
        //  TEST_REPORT_TO_FILE ? {
        //     outputFile: `${fixture}.ctrf.json`,
        //     outputDir: REPORT_DIR,
        //     stringify: {
        //         pretty: true,
        //         indent: 2
        //     },
        //     resolveSourceMaps: true,
        //     ctrf: {
        //         environment: {
        //             appName: 'vscode',
        //             appVersion: VSC_VERSION,
        //             testEnvironment: 'vscode-test'
        //         },
        //         extra: {
        //             extensionDevelopmentPath: SUT_OUT,
        //             includes,
        //             pending
        //         }
        //     },
        // } : undefined;

        return {
            label: fixture,
            workspaceFolder: fs.existsSync(workspace) ? workspace : dir,
            files: includes,
            ...defaults,
            mocha: {
                ...defaults.mocha,
                ...(reporterOptions ? { reporterOptions } : {}),
            }
        };
    }),

];


const testsFiltered = tests.filter(t => t != null);

if (testsFiltered.length < 1) {
    console.error(c.fail(`${c.bold('[Error]')}: No tests.`));
    process.exit(1);
}


if (testsFiltered.length > 1) { // проверка на возможные коллизии label
    const seen = new Set();
    const duplicates = new Set();
    for (const t of testsFiltered) {
        if (seen.has(t.label)) {
            duplicates.add(t.label);
        }
        else {
            seen.add(t.label);
        }
    }
    if (duplicates.size > 0) {
        console.error(c.fail(`${c.bold('[Error]')}: Duplicate test labels:`));
        for (const label of duplicates) {
            console.error(c.fail(`    • "${label}"`));
        }
        process.exit(1);
    }
}


export default defineConfig({
    tests: testsFiltered
});



// ==================================

//
