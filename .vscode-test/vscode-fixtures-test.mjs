// @ts-check
// vscode-fixtures-test.mjs
// VS Code Fixtures Test Runner Configuration


// Конфигурация тест-раннера для фикстур —
// Предназначен для конфигурации запуска интеграционных тестов VS Code расширения, 
// организованных по фикстурам. 
// Работает с @vscode/test-cli и учитывает, что исходные тесты написаны на TypeScript 
// и компилируются в JavaScript в отдельный выходной каталог, независимо от остальных файлов расширения.
// 
// Структура директорий
// 
// project-root (CWD) /
// ├─ src/       ← структура с исходными файлами расширения
// │  ├─ **/*.ts
// │  └─ *
// ├─ test/
// │  └─ fixtures/      ← исходники фикстур (TypeScript)
// │     ├─ fixtureA/
// │     │  ├─ fixtureA.code-workspace  (опционально)
// │     │  ├─ *test.ts                  ← тест
// │     │  ├─ *.ts                      ← вспомогательный файлы
// │     │  ├─ *.*                       ← не компилируемые файлы и директории — данные фикстуры
// │     │  └─ ...
// │     ├─ fixtureB/
// │     └─ ...
// ├─ ~out-test/        ← выходнай каталог, подготовленный для запуска тестов
// │  ├─ src/                     ← сюда помещаются подготовленные, скомпилированные файлы расширения
// │  │  ├─ **/*.js              
// │  │  ├─ *
// │  │  ├─ package.json
// │  │  └─ ...
// │  └─ test/                    ← сюда компилируются файлы-тесты
// │     └─ fixtures/        ← Фикстуры. Каждый каталог внутри это "Имя_Фикстуры"
// │        ├─ fixtureA/
// │        │  ├─ *.js                 ← скомпилированные js
// │        │  └─ *.test.js            ← скомпилированные тесты (файлы с суффиксом test.js) отражаются на "Лейбл_Теста"
// │        ├─ fixtureB/
// │        └─ ...
// ├─ .vscode-fixtures-test.mjs        ← сам конфиг
// └─ *-reporter.сjs                     ← кастомный репортер Mocha (опционально)
// 
// Важно:
// 
// Для каждой фикстуры в ~out-test/test/fixtures/<fixture>/ должен быть хотя бы один файл с именем *test.js
// Именно они будут выполняться.
// 
// Файл *-reporter.сjs должен находиться в корне проекта, если включён вывод в файл.
// 
// Процесс компиляции и запуска
// Разработчик пишет тесты в test/fixtures/<fixture>/
// - Система сборки компилирует ts в ~out-test/test/fixtures/<fixture>/ с сохранением структуры и суффиксами .js.
// - Данные фикстуры **не переносятся**, и остаются в test/fixtures/<fixture>/.
// - Скомпилированные и подготовленные файлы расширения помещаются в ~out-test/src.
// 
// Запуск тестов осуществляется командой, передающей необходимые переменные окружения и 
// использующей @vscode/test-cli. Конфигурационный файл vscode-fixtures-test.mjs автоматически:
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
// FIXTURES_TESTS  — "Имя_Фикстуры::Префикс_Теста". (Обязательна)
//                   Фильтр запуска. "*" — специальное значение для "все".
//                   "Имя_Фикстуры" — ожидается точное совпадение с именем каталога в test/fixtures/.
//                   "Префикс_Теста" — будет сопоставлено с именами *.test.js файлов в каталоге для
//                   фильтрации.
//                   "*::*" — все сценарии во всех фикстурах
//                   "*::S1-" — все "S1-*" сценарии во всех фикстурах
// VSC_VERSION     — Версия VS Code для тестов (используется @vscode/test-cli).    (1.86.2)
// MOCHA_TIMEOUT   — Таймаут для тестов Mocha (в миллисекундах).    (5000)
// MOCHA_SLOW      — Порог «медленного» теста в Mocha(мс).    (750)
// OUT_TO_FILE     — Если задано значение true, y, yes(без учёта регистра), включается кастомный репортер, 
//                   выводящий результаты в файл через *-reporter.mjs.
//
// Пример запуска всех тестов с параметрами:
// ~~~
// FIXTURES_TESTS = '*::*' VSC_VERSION = 1.85.0 MOCHA_TIMEOUT = 10000 npx vscode
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
// Если фильтр FIXTURES_TESTS собрал пустой список  — выполнение прервётся с ошибкой.
// Если reporter.cjs не найден при включённом OUT_TO_FILE — выполнение прервётся с ошибкой.
// 
// Каждая "фикстура" это отдельный запуск экземпляра VS Code и отдельный файл отчета.


import { defineConfig } from '@vscode/test-cli';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';


const OUT_DIR = path.join(process.cwd(), process.env.OUT_DIR || '~out-test');
const SRC_TEST_DIR_REL = process.env.SRC_TEST_DIR || 'test';
const SRC_TEST_DIR = path.join(process.cwd(), SRC_TEST_DIR_REL);


const TEST_FILE_SUFFIX = 'test.js';


// Специальное имя '*' для "все"
const FIXTURES_TESTS = process.env.FIXTURES_TESTS;

const [FIXTURE_NAME, TEST_PREFIX] = (() => {
    if (!FIXTURES_TESTS || FIXTURES_TESTS.trim().length < 1) {
        console.error(chalk.red('[Error]: FIXTURES_TESTS environment variable is missing or empty.'));
        console.error(chalk.yellow('  Expected format: FIXTURES_TESTS="<fixture>::<prefix>"  (e.g. "*::*" or "fixtureA::S1-")'));
        process.exit(1);
    }
    const parts = FIXTURES_TESTS.split('::');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
        console.error(chalk.red(`[Error]: invalid FIXTURES_TESTS value: "${FIXTURES_TESTS}".`));
        console.error(chalk.yellow('  Expected format: FIXTURES_TESTS="<fixture>::<prefix>"  (e.g. "*::*" or "fixtureA::S1-")'));
        process.exit(1);
    }
    return [parts[0].trim(), parts[1].trim()];
})();

const VSC_VERSION = process.env.VSC_VERSION || '1.86.2';


const SUT_OUT = path.join(OUT_DIR, 'src');
if (!fs.existsSync(SUT_OUT) || !fs.statSync(SUT_OUT).isDirectory()) {
    console.error(chalk.red(`[Error]: compiled extension not found at '${SUT_OUT}'. Did you forget to build?`));
    process.exit(1);
}

// if (TEST_REPORT_TO_FILE) {
//     if (!REPORT_DIR) {
//         console.error(chalk.red('[Error]: REPORT_DIR is required when OUT_TO_FILE is set'));
//         process.exit(1);
//     }
// }

const TEST_REPORTER = process.env.TEST_REPORTER;


// --- defaults ---
const defaults = {
    version: VSC_VERSION,
    mocha: {
        ui: /** @type { 'tdd' } */('tdd'),
        reporter: TEST_REPORTER,
        diff: true,
        color: true,
        'full-trace': false,
        require: ['source-map-support/register']
    },
    launchArgs: [
        // '--disable-gpu',
        '--disable-telemetry',
        '--disable-crash-reporter',
        // '--disable-workspace-trust',
        // '--no-sandbox',
    ],
    env: {
        // "DRI_PRIME": "1",
        // "LIBVA_DRIVER_NAME": "radeonsi",
        'VK_ICD_FILENAMES': '',
    },
    extensionDevelopmentPath: SUT_OUT, // где находится скомпилированное расширение
};
// ----------



// Фикстуры и исходники тестов
const FIXTURES_SRC = (() => {
    const fixturesSrc = path.join(SRC_TEST_DIR, 'fixtures');
    if (fs.existsSync(fixturesSrc) && fs.statSync(fixturesSrc).isDirectory()) {
        return fixturesSrc;
    }
    console.error(chalk.red(`[Error]: fixtures source directory '${fixturesSrc}' does not exist or is not a directory.`));
    process.exit(1);
})();


// .js тестов
const TEST_FILES_OUT = (() => {
    const testsOut = path.join(OUT_DIR, SRC_TEST_DIR_REL, 'fixtures');
    if (fs.existsSync(testsOut) && fs.statSync(testsOut).isDirectory()) {
        return testsOut;
    }
    console.error(chalk.red(`[Error]: test output directory '${testsOut}' does not exist or is not a directory.`));
    process.exit(1);
})();


// фикстуры для запуска
// '*' - все. конкретная - конкретная
const fixtures = (() => {
    if (FIXTURE_NAME === '*') {
        const all = fs.readdirSync(FIXTURES_SRC, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(d => d.name)
            .sort(new Intl.Collator(undefined, {
                numeric: true,      // Sort numbers numerically (1, 2, 10)
                sensitivity: 'base', // Ignore accents/case differences
            }).compare);

        if (all.length < 1) {
            console.error(chalk.red(`[Error]: no fixture directories found in '${FIXTURES_SRC}'.`));
            process.exit(1);
        }
        return all;
    }
    const full = path.join(FIXTURES_SRC, FIXTURE_NAME);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        return [FIXTURE_NAME];
    }
    console.error(chalk.red(`[Error]: specified fixture directory '${full}' not found or not a directory.`));
    process.exit(1);
})();


const tests = [

    ...fixtures.map((fixture) => {

        const dir = path.join(FIXTURES_SRC, fixture);
        const workspace = path.join(dir, `${fixture}.code-workspace`);

        const out = (() => {
            const d = path.join(TEST_FILES_OUT, fixture);
            if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
                return d;
            }
            console.error(chalk.red(`[Error]: specified fixture output directory '${d}' not found or not a directory.`));
            process.exit(1);
        })();


        const allFiles = fs.readdirSync(out, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.endsWith(TEST_FILE_SUFFIX))
            .map(f => path.join(out, f.name))
            .sort(new Intl.Collator(undefined, {
                numeric: true,      // Sort numbers numerically (1, 2, 10)
                sensitivity: 'base', // Ignore accents/case differences
            }).compare);

        const includes = TEST_PREFIX === '*'
            ? allFiles
            : allFiles.filter(f => path.basename(f).startsWith(TEST_PREFIX));

        // const pending = TEST_PREFIX === '*'
        //     ? []
        //     : allFiles.filter(f => !path.basename(f).startsWith(TEST_PREFIX));

        if (includes.length < 1) {
            console.error(chalk.red(`[Error]: no test files ('*${TEST_FILE_SUFFIX}') found in '${out}'.`));
            process.exit(1);
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


if (tests.length < 1) {
    console.error(chalk.red('[FAIL]: No tests.'));
    process.exit(1);
}


if (tests.length > 1) { // проверка на возможные коллизии label
    const seen = new Set();
    const duplicates = new Set();
    for (const t of tests) {
        if (seen.has(t.label)) {
            duplicates.add(t.label);
        }
        else {
            seen.add(t.label);
        }
    }
    if (duplicates.size > 0) {
        console.error(chalk.red('[FAIL]: Duplicate test labels:'));
        for (const label of duplicates) {
            console.error(chalk.red(`    • "${label}"`));
        }
        process.exit(1);
    }
}


export default defineConfig({
    tests
});



// ==================================

//