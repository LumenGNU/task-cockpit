import * as vscode from 'vscode';


export interface ExtExports {
    readonly memento: vscode.Memento;
}


export function activate(context: vscode.ExtensionContext): ExtExports {

    const out = vscode.window.createOutputChannel('ProtoCheck');
    context.subscriptions.push(out);

    context.subscriptions.push(

        // Object.create(null) даёт объект без Object.prototype, поэтому у
        // него нет hasOwnProperty, toString и т.д.
        // Если после записи/чтения через Memento (который сериализует/десериализует
        // данные) объект получает обычный прототип, то у него появятся методы вроде
        // hasOwnProperty и Object.getPrototypeOf(obj) === Object.prototype станет true.
        // Команда выводит обе версии (оригинал и прочитанное) и явно показывает,
        // сохранился ли null‑прототип или нет.
        vscode.commands.registerCommand('DEBUG.checkMementoPrototype', async () => {
            const key = 'proto-test-key';

            // Создаём объект с прототипом null и "опасными" ключами
            const original: Record<string, any> = Object.create(null);
            // @ts-expect-error
            original.constructor = 'C';
            // @ts-expect-error
            original.toString = 'T';
            original.regular = 'R';

            // Вложенный объект тоже с прототипом null
            const nested: Record<string, any> = Object.create(null);
            // @ts-expect-error
            nested.constructor = 'nested-C';
            // @ts-expect-error
            nested.toString = 'nested-T';
            original.nested = nested;

            out.appendLine('--- ProtoCheck: original object ---');
            out.appendLine(`Object.getPrototypeOf(original) === null -> ${Object.getPrototypeOf(original) === null}`);
            out.appendLine(`original.hasOwnProperty (typeof) -> ${typeof (original as any).hasOwnProperty}`);
            out.appendLine(`Object.keys(original) -> ${JSON.stringify(Object.keys(original))}`);
            out.appendLine(`original as JSON -> ${JSON.stringify(original)}`);
            out.appendLine('');

            // Записываем в Memento
            await context.workspaceState.update(key, original);
            out.appendLine('Saved to workspaceState.');

            // Читаем обратно
            const read = context.workspaceState.get<any>(key);
            out.appendLine('Read back from workspaceState.');

            // Проверки
            const protoOfRead = Object.getPrototypeOf(read);
            const protoOfNested = read && read.nested ? Object.getPrototypeOf(read.nested) : undefined;
            const hasHasOwn = typeof (read as any)?.hasOwnProperty === 'function';
            const hasHasOwnNested = typeof (read as any)?.nested?.hasOwnProperty === 'function';

            out.appendLine('--- ProtoCheck: read object ---');
            out.appendLine(`read === undefined -> ${read === undefined}`);
            out.appendLine(`Object.getPrototypeOf(read) === null -> ${protoOfRead === null}`);
            out.appendLine(`Object.getPrototypeOf(read) === Object.prototype -> ${protoOfRead === Object.prototype}`);
            out.appendLine(`read.hasOwnProperty (typeof) -> ${hasHasOwn}`);
            out.appendLine(`Object.keys(read) -> ${JSON.stringify(Object.keys(read || {}))}`);
            out.appendLine(`read as JSON -> ${JSON.stringify(read)}`);
            out.appendLine('');
            out.appendLine('--- ProtoCheck: nested ---');
            out.appendLine(`Object.getPrototypeOf(read.nested) === null -> ${protoOfNested === null}`);
            out.appendLine(`Object.getPrototypeOf(read.nested) === Object.prototype -> ${protoOfNested === Object.prototype}`);
            out.appendLine(`read.nested.hasOwnProperty (typeof) -> ${hasHasOwnNested}`);
            out.appendLine(`Object.keys(read.nested || {}) -> ${JSON.stringify(Object.keys(read?.nested || {}))}`);
            out.appendLine(`read.nested as JSON -> ${JSON.stringify(read?.nested)}`);

            // Краткое сообщение пользователю
            const summary = protoOfRead === null
                ? 'Прочитанный объект сохранил прототип null.'
                : 'Прочитанный объект имеет обычный прототип (Object.prototype) — защита исчезла.';
            out.appendLine('');
            out.appendLine(`SUMMARY: ${summary}`);
            out.show(true);

            void vscode.window.showInformationMessage(`ProtoCheck: ${summary}`);
        }),


        vscode.commands.registerCommand('DEBUG.checkMapInMemento', async () => {
            const key = 'map-test-key';
            const out = vscode.window.createOutputChannel('MapCheck');
            out.show(true);

            // Создаём Map
            const m = new Map<string, any>();
            m.set('a', 1);
            m.set('constructor', 'C');
            m.set('nested', new Map([['x', 10]]));

            out.appendLine('Original:');
            out.appendLine(`is Map -> ${m instanceof Map}`);
            out.appendLine(`entries -> ${JSON.stringify(Array.from(m.entries()))}`);

            // Пытаемся записать Map напрямую
            await context.workspaceState.update(key, m as any);
            out.appendLine('Saved Map directly to workspaceState.');

            // Читаем обратно
            const read = context.workspaceState.get<any>(key);
            out.appendLine('Read back:');
            out.appendLine(`typeof read -> ${typeof read}`);
            out.appendLine(`read instanceof Map -> ${read instanceof Map}`);
            out.appendLine(`Object.getPrototypeOf(read) -> ${Object.getPrototypeOf(read)}`);
            out.appendLine(`JSON.stringify(read) -> ${JSON.stringify(read)}`);
            out.appendLine(`As entries (if array) -> ${Array.isArray(read) ? JSON.stringify(read) : 'not array'}`);

            // Очистка
            await context.workspaceState.update(key, undefined);
            out.appendLine('Cleaned up.');
            void vscode.window.showInformationMessage('MapCheck done — см. Output Channel MapCheck');
        })

    );

    return {
        memento: context.workspaceState
    } as const;

}


// This method is called when your extension is deactivated
export function deactivate() {

}
