/** @file DecorationProviders/Color.ts */
/** @module Color */

import * as vscode from 'vscode';
import helpers from '../helpers';


export default class Color implements vscode.FileDecorationProvider {


    provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {

        if (token.isCancellationRequested) {
            return undefined;
        }

        const metadata = helpers.resolveMetadata(uri, 'task', 'marker');

        if (!metadata) {
            return undefined;
        }

        const color = metadata.color;

        if (!color) {
            return undefined;
        }

        return {
            color: new vscode.ThemeColor(color),
            propagate: false,
        };

    }
}
