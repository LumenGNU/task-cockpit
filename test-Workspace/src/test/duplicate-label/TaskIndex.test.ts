import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import type * as TC from '../../types.js';
import TaskIndex from '../../Workspace/TaskIndex.js';


suite('Duplicate label fixture', () => {

    suiteSetup(async () => {
        // --- Контракт фикстуры ---
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length === 1 && folders[0]?.name === 'duplicate-label',
            `fixture contract expected "duplicate-label", got ${folders ? folders.map(f => f.name).join(', ') : '<none>'
            }`);

        const tasks = await vscode.tasks.fetchTasks();
        const twins = tasks.filter(t => t.name === 'twin');
        assert.ok(twins.length > 1, `fixture contract expected multiple "twin", got ${twins.length}`);
    });

    suite('TaskIndex', () => {

        test('collision collapses to single entry', async () => {

            const cts = new vscode.CancellationTokenSource();
            try {
                const index = await TaskIndex.fetch(cts.token);
                const ids = Object.keys(index) as TC.TaskId[];

                // Контракт fetch: коллизия не порождает исключения и не ломает индекс.
                // Какая из двух задач «выжила» — неопределено сознательно:
                // сам VS Code разрешает дубликаты непоследовательно (см. https://gist.github.com/LumenGNU/e8425e9e07309ce0e38d171bb6359675).
                assert.strictEqual(ids.length, 1, 'collision must collapse to single entry');
                assert.equal(index[ids[0]!]?.name, 'twin');
                // но будем ожидать последний в файле
                assert.equal(index[ids[0]!]?.detail, 'twin - second');
            }
            finally {
                cts.dispose();
            }
        });

    });
});