import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';



const configSectionName = 'taskCockpit_TEST';


class Test {
	readonly #onDid: vscode.EventEmitter<void>;
	public readonly onDid: vscode.Event<void>;
	#disposed = false;

	constructor() {
		this.#onDid = new vscode.EventEmitter();
		this.onDid = this.#onDid.event;
	}

	dispose() {
		if (this.#disposed) return;
		this.#disposed = true;
		this.#onDid.dispose(); // ← как в Monitor
	}

	run() {
		setTimeout(() => {
			console.log('[timer] start, disposed:', this.#disposed);
			if (!this.#disposed) {
				this.#onDid.fire();  // ← как #pruneDead внутри timer callback
				console.log('[timer] after fire, disposed:', this.#disposed);
				// если здесь disposed=true → scheduleCheck на мёртвом объекте
			}
		}, 1000);
	}
}

export function activate(context: vscode.ExtensionContext) {
	const t = new Test();

	t.onDid(() => {
		console.log('[listener] before dispose');
		t.dispose();
		console.log('[listener] after dispose');
	});

	t.run();
}


// This method is called when your extension is deactivated
export function deactivate() {

}
