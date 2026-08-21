import * as vscode from 'vscode';
import WindowConfiguration from '../../src/WindowConfiguration/WindowConfiguration';
import FileDecorationProvider from '../../src/DecorationProvider/FileDecorationProvider';
import Config from '../../src/WindowConfiguration/Config';
import WindowConfigurationSchema from '../../src/WindowConfiguration/WindowConfigurationSchema';

export interface IFixture {
    fileDecorationProvider: FileDecorationProvider;
    updateConfig: (value: FileDecorationConf) => Promise<void>;
}

const CONFIGURATION_KEY = 'FileDecoration' as const;
type FileDecorationConf = Config[typeof CONFIGURATION_KEY];

const windowConfiguration = new WindowConfiguration();

async function updateConfig(
    value: FileDecorationConf
): Promise<void> {

    const fd = WindowConfigurationSchema.SCHEMA[CONFIGURATION_KEY];
    const cfg = vscode.workspace.getConfiguration();

    function isSatisfied(): boolean {
        const current = windowConfiguration.getConfiguration(CONFIGURATION_KEY);
        return JSON.stringify(current) === JSON.stringify(value);
    }

    // если состояние уже целевое
    if (isSatisfied()) {
        return;
    }

    // Подписка ДО отправки обновлений — чтобы не пропустить событие
    const settled = new Promise<void>((resolve) => {
        const disposable = windowConfiguration.onDidChangeConfiguration(async () => {
            if (isSatisfied()) {
                disposable.dispose();
                await new Promise<void>(resolve => setTimeout(resolve, 550));
                resolve();
            }
        });
    });


    await Promise.all([
        cfg.update(fd.runningSymbol.configKey, value.runningSymbol, vscode.ConfigurationTarget.Global),
        cfg.update(fd.overflowSymbol.configKey, value.overflowSymbol, vscode.ConfigurationTarget.Global),
        cfg.update(fd.badgeOrder.configKey, value.badgeOrder, vscode.ConfigurationTarget.Global),
        cfg.update(fd.availableSymbol.configKey, value.availableSymbol, vscode.ConfigurationTarget.Global),
    ]);

    await settled;
}


export function activate(context: vscode.ExtensionContext): IFixture {

    const fileDecorationProvider = new FileDecorationProvider({ windowConfiguration });

    return {
        fileDecorationProvider,
        updateConfig
    };
}

export function deactivate(): void {
    windowConfiguration.dispose();
}
