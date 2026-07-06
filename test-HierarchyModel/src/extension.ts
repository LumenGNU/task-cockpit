import {
    window,
    ExtensionContext
} from 'vscode';
import * as assert from 'node:assert/strict';
import Hierarchy from './HierarchyModel/HierarchyModel';



const log = window.createOutputChannel('Task Cockpit DEBUG', { log: true });


export function activate(context: ExtensionContext): void {

    log.info('activate');



}

export function deactivate(): void { }
