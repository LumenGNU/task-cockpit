

import {
    Disposable,
    ExtensionContext,
    commands,
    window
} from 'vscode';
import DiagnosticsManager from './TasksSource/Diagnostics/DiagnosticsManager';
import ConfigurationProvider from './Configuration/ConfigurationProvider';

const outputChannel = window.createOutputChannel('Task Cockpit DEBUG', { log: true });

const disposables: Disposable[] = [];

export function activate(context: ExtensionContext): void {


    outputChannel.show();

    outputChannel.appendLine('activated!');



    const cp = new ConfigurationProvider('taskCockpit');
    const dm = new DiagnosticsManager(cp, outputChannel);


    disposables.push(
        cp,
        dm
    );

    disposables.push(
        commands.registerCommand('debug.A', async () => {


            const p = [
                new Promise<never>((_resolve, reject) => {
                    setTimeout(() => {
                        console.log('1 - rejected');
                        reject(1);
                    }, 500);
                }),
                new Promise<never>((_resolve, reject) => {
                    setTimeout(() => {
                        console.log('2 - rejected');
                        reject(new Error());
                    }, 15000);
                }),
            ];

            try {
                await Promise.all(p);
            }
            catch {
                console.log('ERRORED!');
            }

            console.log('xxx');
        })
    );

}

export function deactivate(): void {
    disposables.forEach((d) => {
        d.dispose();
    });
    outputChannel.dispose();
}
