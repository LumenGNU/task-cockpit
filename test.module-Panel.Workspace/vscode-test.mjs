import { defineConfig } from '@vscode/test-cli';
import { globSync } from 'fs';
import { existsSync, readdirSync } from 'node:fs';

const [major] = process.versions.node.split('.');
if (+major < 22) {
    throw new Error(`Node >= 22 required (current: ${process.versions.node}). Run: nvm use 22`);
}

const resultFile = process.env.MOCHA_XUNIT_FILE;
const filter = process.env.MOCHA_TEST_FILTER;

function resolveTestFiles(pattern) {
    return globSync(pattern)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const defaults = {
    // version: "1.109.5",
    version: "1.86.2",
    mocha: {
        timeout: 5_000,
        slow: 750,
        ...(resultFile && {
            reporter: 'xunit',
            reporterOptions: { output: resultFile }
        })
    },
    launchArgs: [
        '--disable-gpu',
        '--disable-telemetry',
        '--disable-crash-reporter',
        '--disable-workspace-trust',
        // '--no-sandbox',               // полезно в CI
    ],
    env: {
        "VK_ICD_FILENAMES": "",
    }
};



const CoreTasksFixtures = readdirSync('src/test/Tasks', { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

const allTests = [
    {
        label: 'nnn',
        files: 'nn.js',
        ...defaults
    },

    {
        label: 'Multi-root Tests',
        workspaceFolder: 'test-fixtures/multi-root.code-workspace',
        files: resolveTestFiles('~out/test/**/*-multi-root.test.js'),
        ...defaults,
    },
    {
        label: 'Single-empty-folder Tests',
        workspaceFolder: 'test-fixtures/single-empty-folder',
        files: resolveTestFiles('~out/test/**/*-single-empty-folder.test.js'),
        ...defaults
    },
    {
        label: 'Single-folder Tests',
        workspaceFolder: 'test-fixtures/single-folder',
        files: resolveTestFiles('~out/test/**/*-single-folder.test.js'),
        ...defaults
    },

    ...CoreTasksFixtures.map((fixture) => {
        const dir = `src/test/Tasks/${fixture}`;
        const ws = `${dir}/${fixture}.code-workspace`;
        return {
            label: `Core.Tasks.${fixture}`,
            workspaceFolder: existsSync(ws) ? ws : dir,
            files: `~out/test/Tasks/${fixture}/*test.js`,
            ...defaults
        };
    }),

];


export default defineConfig({
    tests: filter
        ? allTests.filter(t => t.label.startsWith(filter))
        : allTests,
});