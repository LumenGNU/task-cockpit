import {
    CancellationToken,
    FileDecoration,
    ProviderResult,
    ThemeColor,
    Uri,
    type FileDecorationProvider as VscFileDecorationProvider
} from 'vscode';

class FileDecorationProvider implements VscFileDecorationProvider {

    provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration> {

        if (token.isCancellationRequested) {
            return undefined;
        }

        // see: src/type.d/UriSchema.d.ts
        if (uri.scheme !== 'task-cockpit' || uri.authority !== 'Node') {
            return undefined;
        }

        // query keys:
        // color
        // running
        // total
        const query = new URLSearchParams(uri.query);

        const total = Number(query.get('total')) || 0;
        const running = Number(query.get('running')) || 0;
        const color = query.get('color') || undefined;

        return {
            color: color ? new ThemeColor(color) : undefined,
            // Большой кружок если есть running, маленький если нет, но есть "терминалы"
            // Цифра если running>1; знак + если running>9. (badge строго не более двух символов)
            badge: (running > 0) ? `●${(running > 1) ? ((running > 9) ? '+' : running) : ''}` : (total > 0) ? '•' : undefined,
            propagate: false
        } as const;
    }
}


export default FileDecorationProvider;
