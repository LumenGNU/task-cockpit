import * as vscode from 'vscode';
import Hierarchy from './Cockpit/TreeModel/Hierarchy';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from './Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('test-extension-activate', async () => {

		vscode.window.showInformationMessage('test-extension is now active');

		// #region DEBUG
		log(LogLevel.Debug, 'test-extension is now active');

		type LeafType = { calories: number, note?: string; };

		function spec(branch: string[], data: LeafType): Hierarchy.Spec<typeof data> {
			return {
				segments: branch,
				data
			};
		}

		const topNodes = Hierarchy.build<LeafType, string>('kitchen', [
			spec(['pizza', 'margherita'], { calories: 250 }),
			spec(['pizza', 'quattro formaggi'], { calories: 320 }),
			spec(['pizza', 'diavola'], { calories: 290 }),
			spec(['pizza'], { calories: 0, note: 'dough base' }), // данные + дети
			spec(['sushi', 'nigiri', 'salmon'], { calories: 45 }),
			spec(['sushi', 'nigiri', 'tuna'], { calories: 40 }),
			spec(['sushi', 'roll', 'dragon'], { calories: 500 }),
			spec(['sushi', 'roll', 'rainbow'], { calories: 470 }),
			spec(['sushi', 'gunkan'], { calories: 60 }),  // лист на уровне группирующих
			spec(['taco'], { calories: 210 }), // одиночный лист, без вложенности
			spec(['ramen', 'tonkotsu'], { calories: 450 }),
			spec(['ramen', 'miso'], { calories: 380 }),
		]);

		console.log(JSON.stringify(Hierarchy.toDebugJSON(topNodes), null, 2));

		// #endregion DEBUG
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
	// #region DEBUG
	Logger.dispose();
	// #endregion DEBUG
}
