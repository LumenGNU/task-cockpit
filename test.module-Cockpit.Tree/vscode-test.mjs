{
	const [major] = process.versions.node.split('.');
	if (+major < 22) {
		throw new Error(`Node >= 22 required (current: ${process.versions.node}). Run: nvm use 22`);
	}
}

import { defineConfig } from '@vscode/test-cli';
import { globSync } from 'fs';


function resolveTestFiles(pattern) {
	return globSync(pattern)
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const defaults = {
	// version: "1.109.5",
	version: "1.86.2",
	mocha: {
		timeout: 33,
		slow: 16
	}
};

export default defineConfig({
	tests: [
		{
			label: 'Basic Tests',
			workspaceFolder: 'test-fixtures/empty-folder',
			files: resolveTestFiles('~out/test/**/*-basic.test.js'),
			...defaults
		},
		{
			label: 'Sketches Tests',
			workspaceFolder: 'test-fixtures/empty-folder',
			files: resolveTestFiles('~out/test/**/sketches.test.js'),
			...defaults
		}
	],
});
