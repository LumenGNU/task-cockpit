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
// project-root/
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
// │     └─ fixtures/
// │        ├─ fixtureA/
// │        │  ├─ *.js                 ← скомпилированные js
// │        │  └─ *.test.js            ← скомпилированные тесты (файлы с суффиксом test.js)
// │        ├─ fixtureB/
// │        └─ ...
// ├─ .vscode-fixtures-test.mjs        ← сам конфиг
// └─ reporter.mjs                     ← кастомный репортер Mocha (опционально)
// 
// Важно:
// 
// Для каждой фикстуры в ~out-test/test/fixtures/<fixture>/ должен быть хотя бы один файл с именем *test.js
// Именно они будут выполняться.
// 
// Файл reporter.mjs должен находиться в корне проекта, если включён вывод в файл.
// 
// Процесс компиляции и запуска
// Разработчик пишет тесты в test/fixtures/<fixture>/
// - Система сборки компилирует ts в ~out-test/test/fixtures/<fixture>/ с сохранением структуры и суффиксами .js.
// - Данные фикстуры **не переносятся**, и остаются в test/fixtures/<fixture>/.
// - Скомпилированные и подготовленные файлы расширения помещаются в ~out-test/src.
// 
// Запуск тестов осуществляется командой, передающей необходимые переменные окружения и 
// использующей @vscode/test-cli. Конфигурационный файл vscode-fixtures-test.mjs автоматически:
// - Определяет, какие фикстуры запускать (конкретную или все).
// - Для каждой фикстуры находит соответствующую рабочую область: если есть <fixture>.code-workspace 
//   в исходной папке фикстуры, используется он, иначе — сама исходная папка фикстуры.
// - Собирает все *test.js файлы из выходной папки фикстуры, подставляет их в качестве тестовых файлов.
// - Применяет глобальные настройки (версия VS Code, параметры Mocha, аргументы запуска).
// 
// Все настройки управляются через переменные окружения:
// 
// FIXTURE_NAME  — Имя конкретной фикстуры или строка '*' для запуска всех фикстур.    (Обязательна)
// VSC_VERSION   — Версия VS Code для тестов (используется @vscode/test-cli).    (1.86.2)
// MOCHA_TIMEOUT — Таймаут для тестов Mocha (в миллисекундах).    (5000)
// MOCHA_SLOW    — Порог «медленного» теста в Mocha(мс).    (750)
// OUT_TO_FILE   — Если задано значение true, y, yes(без учёта регистра), включается кастомный репортер, 
//                 выводящий результаты в файл через reporter.mjs. no
//
// Пример запуска всех тестов с параметрами:
// ~~~
// FIXTURE_NAME = '*' VSC_VERSION = 1.85.0 MOCHA_TIMEOUT = 10000 npx vscode - test
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
// Если reporter.mjs не найден при включённом OUT_TO_FILE, выполнение прервётся с ошибкой.

import { defineConfig } from '@vscode/test-cli';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';


// Специальное имя '*' для "все"
const FIXTURE_NAME = process.env.FIXTURE_NAME;
const VSC_VERSION = process.env.VSC_VERSION;
const MOCHA_TIMEOUT = process.env.MOCHA_TIMEOUT;
const MOCHA_SLOW = process.env.MOCHA_SLOW;
const OUT_TO_FILE = ['true', 'y', 'yes'].includes(process.env.OUT_TO_FILE?.toLowerCase() || 'no');
const REPORT_DIR = process.env.REPORT_DIR;


const OUT_DIR = process.env.OUT_DIR || '~out-test';
const SRC_TEST_DIR = process.env.SRC_TEST_DIR || 'test';


const SUT_OUT = path.join(OUT_DIR, 'src');
if (!fs.existsSync(SUT_OUT) || !fs.statSync(SUT_OUT).isDirectory()) {
    console.error(chalk.red(`[Error]: compiled extension not found at '${SUT_OUT}'. Did you forget to build?`));
    process.exit(1);
}

if (OUT_TO_FILE) {

    if (!REPORT_DIR) {
        console.error(chalk.red('[Error]: REPORT_DIR is required when OUT_TO_FILE is set'));
        process.exit(1);
    }

}

// --- defaults ---
const defaults = {
    version: VSC_VERSION || '1.86.2',
    mocha: {
        require: ['source-map-support/register'],
        timeout: Number(MOCHA_TIMEOUT || 5_000),
        slow: Number(MOCHA_SLOW || 750),
        reporter: OUT_TO_FILE ? (() => {
            const reporter = 'reporter.cjs';
            if (fs.existsSync(reporter) && fs.statSync(reporter).isFile()) {
                return reporter;
            }
            console.error(chalk.red(`[Error]: reporter '${reporter}' does not exist or is not a file.`));
            process.exit(1);
        })() : undefined
    },
    launchArgs: [
        '--disable-gpu',
        '--disable-telemetry',
        '--disable-crash-reporter',
        // '--disable-workspace-trust',
        // '--no-sandbox',
    ],
    env: {
        "VK_ICD_FILENAMES": "",
    },
    extensionDevelopmentPath: SUT_OUT, // где находится скомпилированное расширени
};
// ----------


if (!FIXTURE_NAME || FIXTURE_NAME.trim().length < 1) {
    console.error(chalk.red('[Error]: FIXTURE_NAME environment variable is missing or empty.'));
    process.exit(1);
}


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
    const testsOut = path.join(OUT_DIR, SRC_TEST_DIR, 'fixtures');
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


const suites = [

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

        // файлы тестов. полные пути
        const files =
            fs.readdirSync(out, { withFileTypes: true })
                .filter(f => f.isFile() && f.name.endsWith('test.js')) // файлы *test.js и сам test.js
                .map(f => path.join(out, f.name))
                .sort(new Intl.Collator(undefined, {
                    numeric: true,      // Sort numbers numerically (1, 2, 10)
                    sensitivity: 'base', // Ignore accents/case differences
                }).compare);

        if (files.length < 1) {
            console.error(chalk.red(`[Error]: no test files ('*test.js') found in '${out}'.`));
            process.exit(1);
        }

        return {
            label: fixture,
            workspaceFolder: fs.existsSync(workspace) ? workspace : dir,
            files,
            ...defaults
        };
    }),

];


if (suites.length < 1) {
    console.error(chalk.red(`[FAIL]: No tests.`));
    process.exit(1);
}


if (suites.length > 1) { // проверка на возможные коллизии label
    const seen = new Set();
    const duplicates = new Set();
    for (const t of suites) {
        if (seen.has(t.label)) duplicates.add(t.label);
        else seen.add(t.label);
    }
    if (duplicates.size > 0) {
        console.error(chalk.red(`[FAIL]: Duplicate test labels:`));
        for (const label of duplicates) {
            console.error(chalk.red(`    • "${label}"`));
        }
        process.exit(1);
    }
}


export default defineConfig({
    tests: suites
});



// ==================================

//