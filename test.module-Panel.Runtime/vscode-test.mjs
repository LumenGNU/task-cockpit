import { defineConfig } from '@vscode/test-cli';
import { globSync } from 'fs';

const [major] = process.versions.node.split('.');
if (+major < 22) {
	throw new Error(`Node >= 22 required (current: ${process.versions.node}). Run: nvm use 22`);
}

function resolveTestFiles(pattern) {
	return globSync(pattern)
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const defaults = {
	// version: "1.109.5",
	// version: "1.86.2",
	mocha: {
		timeout: 15_000,
		slow: 99_000
	}
};

export default defineConfig({
	tests: [
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
		}
	],
});
