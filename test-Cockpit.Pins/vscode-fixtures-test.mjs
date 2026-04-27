// @ts-check

import { defineConfig } from '@vscode/test-cli';
// import { globSync } from 'fs';
import { existsSync, readdirSync } from 'node:fs';

// const [major] = process.versions.node.split('.');
// if (+major < 22) {
//     throw new Error(`Node >= 22 required (current: ${process.versions.node}). Run: nvm use 22`);
// }

const xunitFile = process.env.MOCHA_XUNIT_FILE;


const filter = process.env.MOCHA_TEST_FILTER;


const FIXTURES_SRC = 'src/test/fixtures';
const TEST_FILES_OUT = '~out/test/fixtures';



// function resolveTestFiles(pattern) {
//     return globSync(pattern)
//         .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
// }

const defaults = {
    // version: "1.109.5",
    version: "1.86.2",
    mocha: {
        timeout: 5_000,
        slow: 750,
        ...(xunitFile && {
            reporter: 'xunit',
            reporterOptions: { output: xunitFile }
        })
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
    }
};





const fixtures = readdirSync(FIXTURES_SRC, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);


const allTests = [


    // {
    //     label: 'Single-folder Tests',
    //     workspaceFolder: 'test-fixtures/single-folder',
    //     files: resolveTestFiles('~out/test/**/*-single-folder.test.js'),
    //     ...defaults
    // },

    ...fixtures.map((fixtureName) => {
        const dir = `${FIXTURES_SRC}/${fixtureName}`;
        const ws = `${dir}/${fixtureName}.code-workspace`;
        return {
            label: `fixture::${fixtureName}`,
            workspaceFolder: existsSync(ws) ? ws : dir,
            files: `~out/test/Tasks/${fixtureName}/*test.js`,
            ...defaults
        };
    }),

];


export default defineConfig({
    tests: filter
        ? allTests.filter(t => t.label.startsWith(filter))
        : allTests,
});