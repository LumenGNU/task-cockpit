import * as vscode from 'vscode';
import Hierarchy from './Cockpit/TreeModel/Hierarchy';
import Entity from './Cockpit/TreeModel/Entity';
import type * as TC from './types';
import helpers from './helpers';
import DebugTreeViewer from './DebugTreeViewer';



// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from './Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


export function activate(context: vscode.ExtensionContext) {

	// #region DEBUG

	const viewer = new DebugTreeViewer();

	const treeView = vscode.window.createTreeView('test-debug-tree', {
		treeDataProvider: viewer,
		showCollapseAll: true,
	});

	const disposable = vscode.Disposable.from(

		vscode.commands.registerCommand('test-extension-activate', () => {

			vscode.window.showInformationMessage('test-extension is now active');

			log(LogLevel.Debug, 'test-extension is now active');

			type LeafType = {
				calories: number,
				note?: string;
				description?: string;
			};

			function spec(branch: string[], data: LeafType): Hierarchy.Spec<typeof data, 'kitchen'> {
				return {
					scope: 'kitchen',
					path: branch,
					data
				};
			}

			const topNodes = Hierarchy.build<LeafType, string>([
				spec(['pizza', 'margherita'], { calories: 250 }),
				spec(['pizza', 'quattro formaggi'], { calories: 320 }),
				spec(['pizza', 'diavola'], { calories: 290 }),
				spec(['pizza'], { calories: 0, note: 'dough base' }), // данные + дети
				spec(['sushi', 'nigiri', 'salmon'], { calories: 45 }),
				spec(['sushi', 'nigiri', 'tuna'], { calories: 40 }),
				spec(['sushi', 'roll', 'dragon'], { calories: 500 }),
				spec(['sushi', 'roll', 'rainbow'], { calories: 470 }),
				spec(['sushi', 'gunkan'], { calories: 60 }),  // лист на уровне группирующих
				spec(['taco'], { calories: 210, description: 'A taco is a traditional Mexican dish consisting of a small hand-sized corn or wheat tortilla topped with a filling, folded or rolled, and eaten by hand' }), // одиночный лист, без вложенности
				spec(['ramen', 'tonkotsu'], { calories: 450 }),
				spec(['ramen', 'miso'], { calories: 380 }),
			]);

			console.log(JSON.stringify(Hierarchy.toJSON(topNodes), null, 2));

			console.log(Hierarchy.printTree(topNodes, (d) => `( calories: ${d.calories} )`));

			console.log('\n\n\n');
		}),

		vscode.commands.registerCommand('test-entity-debug', () => {

			log(LogLevel.Debug, 'Entity debug started');

			const { scopes, favoritesRefs, definitionMap, configMap, hiddenFolders } =
				parseScenario(scenario);

			const entities = Entity.buildEntities(
				scopes, favoritesRefs, definitionMap, configMap, hiddenFolders,
			);

			entities.forEach((e) => {
				console.log(Entity.printTree(e));
			});

			viewer.setData(entities);
		}),
	);
	// #endregion DEBUG

	context.subscriptions.push(disposable);
}

// --- Формат сценария ---

interface DebugScenario {
	folders: Record<string, string>; // name → fsPath (до tasks.json)
	definitions: Record<TC.File, Record<TC.Name, TC.TaskDefinition>>; // fsPath → TaskDefinition
	config: TC.BranchConfig;
	favorites?: { folder: string; label: string }[];
	hiddenFolders?: string[];
}


function buildDefinition(file: TC.File, name: TC.Name, def?: Partial<TC.TaskDefinition>): TC.TaskDefinition {
	return {
		id: helpers.buildId(file, name),
		icon: def?.icon ?? {},
		group: def?.group,
		hidden: def?.hidden,
		isBackground: def?.isBackground,
		rejectFlag: def?.rejectFlag
	}
}


function buildDefinitions(file: TC.File, tasks: ReadonlyArray<Readonly<{ name: string, def?: Partial<TC.TaskDefinition> }>>): Record<TC.File, Record<TC.Name, TC.TaskDefinition>> {
	const j: Record<TC.Name, TC.TaskDefinition> = {};
	for (const { name: _name, def } of tasks) {
		const name = _name as TC.Name;
		j[name] = buildDefinition(file, name, def);
	}
	return {
		[file]: j
	};
}

const frontend = '/workspace/frontend/.vscode/tasks.json' as TC.File;
const backend = '/workspace/backend/.vscode/tasks.json' as TC.File;

// --- Сценарий как plain-объект ---

/*
const scenario: DebugScenario = {
	folders: {
		frontend,
		backend,
	},
	definitions: {

		...buildDefinitions(frontend, [
			{
				name: 'build:dev',
				def: { group: { kind: 'Build', isDefault: false } }
			},
			{
				name: 'build:prod',
				def: { group: { kind: 'Build', isDefault: true } }
			},
			{
				name: 'lint',
				def: {}
			},
			{
				name: 'test:unit',
				def: { group: { kind: 'Test', isDefault: false } }
			},
			{
				name: 'test:e2e',
				def: { group: { kind: 'Test', isDefault: false } }
			}
		]),

		...buildDefinitions(backend, [
			{
				name: 'build:server'
			},
			{
				name: 'migrate'
			},
			{
				name: 'seed'
			}
		]),
	},
	config: { segmentSeparator: ':', useGroupKind: true },
	favorites: [
		{ folder: 'frontend', label: 'build:dev' },
		{ folder: 'backend', label: 'build:server' },
		{ folder: 'frontend', label: 'lint' },
	],
	hiddenFolders: ['backend'],
};
*/

/*
const scenario: DebugScenario = {
	folders: {
		frontend,
	},
	definitions: {

		...buildDefinitions(frontend, [
			{
				name: 'build:dev',
				def: { group: { kind: 'Build', isDefault: false } }
			},
			{
				name: 'build:prod',
				def: { group: { kind: 'Build', isDefault: true } }
			},
			{
				name: 'lint',
				def: {}
			},
			{
				name: 'test:unit',
				def: { group: { kind: 'Test', isDefault: false } }
			},
			{
				name: 'test:e2e',
				def: { group: { kind: 'Test', isDefault: false } }
			}
		]),

	},
	config: { segmentSeparator: ':', useGroupKind: true },
	favorites: [
		{ folder: 'frontend', label: 'build:dev' },
		{ folder: 'frontend', label: 'lint' },
	],
	hiddenFolders: [],
};
*/

/*
const scenario: DebugScenario = {
	folders: {
		frontend,
		backend,
	},
	definitions: {

		...buildDefinitions(frontend, [
			{
				name: 'build-dev',
			},
		]),

		...buildDefinitions(backend, [
			{
				name: 'build-server'
			}
		]),
	},
	config: { segmentSeparator: false, useGroupKind: true },
	favorites: [
		{ folder: 'frontend', label: 'build-dev' },
		{ folder: 'backend', label: 'build-server' },
	],
	hiddenFolders: [],
};
*/

/*
// демонстрирует проблему @bug: `reverseAndJoin()` на пустом `chain` порождает...
const scenario: DebugScenario = {
	folders: {
		frontend,
		// backend,
	},
	definitions: {

		...buildDefinitions(frontend, [
			{
				name: 'a:b:c:task2',
			},
			{
				name: 'a:b:c:d:e:task1',
			},
		]),

	},
	config: { segmentSeparator: ':', useGroupKind: true },
	favorites: [
		{ folder: 'frontend', label: 'a:b:c:task2' },
		{ folder: 'frontend', label: 'a:b:c:d:e:task1' },
	],
	hiddenFolders: [],
};
*/

/*
const scenario: DebugScenario = {
	folders: {
		frontend,
	},
	definitions: {
		...buildDefinitions(frontend, [
			// a(branch) → b → c(branch) → d → e(branch) → f → g → task1
			// + побочные ветки на каждом branch point
			{ name: 'a:b:c:d:e:f:g:task1' },
			{ name: 'a:b:c:d:e:sideF:task2' },
			{ name: 'a:b:c:sideD:task3' },
			{ name: 'a:sideB:task4' },
		]),
	},
	config: { segmentSeparator: ':', useGroupKind: false },
	favorites: [
		{ folder: 'frontend', label: 'a:b:c:d:e:f:g:task1' },
		{ folder: 'frontend', label: 'a:b:c:d:e:sideF:task2' },
		{ folder: 'frontend', label: 'a:b:c:sideD:task3' },
		{ folder: 'frontend', label: 'a:sideB:task4' },
	],
	hiddenFolders: [],
};
*/

const scenario: DebugScenario = {
	folders: {
		frontend,
	},
	definitions: {
		...buildDefinitions(frontend, [
			{ name: 'a:b:Task & Group:Sub Task' },
			{ name: 'a:b:Task & Group', def: { hidden: true } },
		]),
	},
	config: { segmentSeparator: ':', useGroupKind: false, showHidden: false },
	favorites: [
		{ folder: 'frontend', label: 'a:b:Task & Group' },
	],
	hiddenFolders: [],
};

// --- Парсер сценария → аргументы Entity.buildEntities ---

function parseScenario(s: DebugScenario) {

	const folderScopes = new Map<string, TC.Scope>();
	for (const [name, fsPath] of Object.entries(s.folders)) {
		const uri = vscode.Uri.file(fsPath) as TC.Uri;
		folderScopes.set(name, { name: name as TC.FolderName, uri });
	}

	const scopes: Parameters<typeof Entity.buildEntities>[0] = [
		...(s.favorites?.length ? [] : []),
		...folderScopes.values(),
	];

	const definitionMap: TC.DefinitionsByFile = new Map();

	for (const [_file, defs] of Object.entries(s.definitions)) {
		const file = _file as TC.File;
		const scopedDefs: TC.ScopedDefinitions = new Map();
		for (const [name, definition] of Object.entries(defs)) {
			scopedDefs.set(name as TC.Name, definition);
		}
		definitionMap.set(file, scopedDefs);
	}

	const configMap: TC.BranchConfigByFile = new Map(
		Object.keys(s.definitions).map(file => [file as TC.File, s.config]),
	);

	const favoritesRefs = (s.favorites ?? []).map(f => ({
		scope: folderScopes.get(f.folder)!,
		label: f.label as TC.Name,
	}));

	return { scopes, favoritesRefs, definitionMap, configMap, hiddenFolders: s.hiddenFolders ?? [] };
}


// This method is called when your extension is deactivated
export function deactivate() {
	// #region DEBUG
	Logger.dispose();
	// #endregion DEBUG
}
