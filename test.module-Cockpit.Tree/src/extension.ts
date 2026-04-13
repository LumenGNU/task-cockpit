import * as vscode from 'vscode';
import TreeModel from './Cockpit/TreeModel';
import * as TC from './types';
import helpers from './helpers';
import DebugTreeViewer from './DebugTreeViewer';
import Hierarchy from './Cockpit/TreeModel/Hierarchy';
import { parse as parseJSONC } from 'jsonc-parser';
import * as Sketch from './Sketch';


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

			// vscode.window.showInformationMessage('test-extension is now active');

			// log(LogLevel.Debug, 'test-extension is now active');

			// type LeafType = {
			// 	calories: number,
			// 	note?: string;
			// 	description?: string;
			// };

			// function spec(branch: string[], data: LeafType): Hierarchy.Spec<typeof data, 'kitchen'> {
			// 	return {
			// 		scope: 'kitchen',
			// 		path: branch,
			// 		data
			// 	};
			// }

			// const topNodes = Hierarchy.build<LeafType, string>([
			// 	spec(['pizza', 'margherita'], { calories: 250 }),
			// 	spec(['pizza', 'quattro formaggi'], { calories: 320 }),
			// 	spec(['pizza', 'diavola'], { calories: 290 }),
			// 	spec(['pizza'], { calories: 0, note: 'dough base' }), // данные + дети
			// 	spec(['sushi', 'nigiri', 'salmon'], { calories: 45 }),
			// 	spec(['sushi', 'nigiri', 'tuna'], { calories: 40 }),
			// 	spec(['sushi', 'roll', 'dragon'], { calories: 500 }),
			// 	spec(['sushi', 'roll', 'rainbow'], { calories: 470 }),
			// 	spec(['sushi', 'gunkan'], { calories: 60 }),  // лист на уровне группирующих
			// 	spec(['taco'], { calories: 210, description: 'A taco is a traditional Mexican dish consisting of a small hand-sized corn or wheat tortilla topped with a filling, folded or rolled, and eaten by hand' }), // одиночный лист, без вложенности
			// 	spec(['ramen', 'tonkotsu'], { calories: 450 }),
			// 	spec(['ramen', 'miso'], { calories: 380 }),
			// ]);

			// console.log(JSON.stringify(Hierarchy.toJSON(topNodes), null, 2));

			// console.log(Hierarchy.printTree(topNodes, (d) => `( calories: ${d.calories} )`));

			// console.log('\n\n\n');
		}),

		vscode.commands.registerCommand('-debug-open-sketch-', async () => {


			log(LogLevel.Debug, `debug, open sketch...`);

			const uris = await vscode.window.showOpenDialog({
				canSelectMany: false,
				filters: { 'Scenario': ['jsonc'] },
				title: 'Select debug scenario',
				canSelectFolders: false,
				defaultUri: vscode.Uri.joinPath(context.extensionUri, 'src/test/sketches')
			});

			if (!uris?.length) {
				log(LogLevel.Debug, 'sketch: aborted');
				return;
			}

			log(LogLevel.Debug, `sketch: "${vscode.workspace.asRelativePath(uris[0]!)}":\n`);

			const doc = await vscode.workspace.openTextDocument(uris[0]!);
			await vscode.window.showTextDocument(doc, { preview: true });
			// await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');

			try {
				const raw = await vscode.workspace.fs.readFile(uris[0]!);
				const json = parseJSONC(Buffer.from(raw).toString('utf-8'), undefined, {
					allowEmptyContent: true,
					allowTrailingComma: true,
					disallowComments: false
				});

				const { title, treeInput, asciiTree } = Sketch.load(json);

				console.log(`Loaded sketch "${title}"\n`);

				const { sections, folderCounts } = TreeModel.build(treeInput);

				const actualAsciiTree = TreeModel.printTree(sections);

				if (asciiTree.length > 0) {
					if (actualAsciiTree === asciiTree) {
						console.log(actualAsciiTree);
					}
					else {
						vscode.window.showErrorMessage('Sketch: asciiTree no match');
						console.error(actualAsciiTree);
					}
				}
				else {
					vscode.window.showErrorMessage('Sketch: asciiTree empty');
					console.log(actualAsciiTree);
				}
				console.log('\n');

				viewer.setData(sections);
			}
			catch (err) {
				console.error((err as any).message);
				vscode.window.showErrorMessage('Sketch error');
			}

		}),
	);

	context.subscriptions.push(disposable);
	// #endregion DEBUG
}

// --- Формат сценария ---



// This method is called when your extension is deactivated
export function deactivate() {
	// #region DEBUG
	Logger.dispose();
	// #endregion DEBUG
}
