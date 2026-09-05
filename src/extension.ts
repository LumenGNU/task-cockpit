
import {
    commands,
    Disposable,
    window
} from 'vscode';
import CommandHandlers from './extension/CommandHandlers';
import LogOutputChannel from './extension/LogOutputChannel';
import Services from './extension/Services';

import type {
    ExtensionContext
} from 'vscode';


export async function activate(context: ExtensionContext): Promise<void> {

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const extDisplayName = context.extension.packageJSON['displayName'] as string;
    const logOutputChannel = LogOutputChannel.createLogger(extDisplayName);

    context.subscriptions.push(logOutputChannel);

    try {
        const services = await Services.create(extDisplayName, 30_000, logOutputChannel);

        // первое обновление — начало работы
        await services.resourceStateCoordinator!.forceFullRefresh();

        // Команды становятся доступны после forceFullRefresh
        const handlers = CommandHandlers.create(context, services, logOutputChannel);
        const cmdDisposables = registerCommands(handlers, logOutputChannel);

        context.subscriptions.push(
            cmdDisposables,
            services
        );

    }
    catch (err) {
        window.showErrorMessage(String(err));
        throw err;
    }

}

export function deactivate(): void { }


function registerCommands(
    handlers: Readonly<CommandHandlers>,
    logOutputChannel: LogOutputChannel
): Disposable {

    const disposables: Disposable[] = [];

    for (const [k, handler] of Object.entries(handlers)) {
        logOutputChannel.trace(`[Register Command] ${k}`);
        disposables.push(
            commands.registerCommand(k, handler)
        );
    }

    return Disposable.from(...disposables);

}
