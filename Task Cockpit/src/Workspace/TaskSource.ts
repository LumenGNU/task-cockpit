/** @file Workspace/TaskSource.ts */
/** @module TaskSource */

import {
    workspace as VscWorkspace,
    FileType
} from 'vscode';
import ScopeFile from './ScopeFile';
import type SourceUri from '../type.d/SourceUri';

interface TaskSource {
    uri: SourceUri;
    JSONPath: ReadonlyArray<string>;
}


const TaskSource = {

    /** Источник задач для данного scope: vscode.Uri файла и JSON-путь
     * до массива задач внутри него.
     *
     * - Folder-scope → `.vscode/tasks.json`, путь `['tasks']`.
     * - Workspace-scope → `.code-workspace`, путь `['tasks', 'tasks']`.
     *
     * Возвращает `null`, если файл-источник не существует
     *
     * Семантика: "эта область (не)разрешается в источник задач".
     * Не дает информации "есть ли задачи фактически".
     *
     * @throws Не бросает // @todo УБЕДИСЬ! */
    async resolveSource(uri: SourceUri): Promise<Readonly<TaskSource> | null> {

        try {
            const stat = await VscWorkspace.fs.stat(uri);
            if (!(stat.type & FileType.File)) {
                return null;
            }
        }
        catch {
            return null;
        }

        return {
            uri,
            JSONPath: ScopeFile.getJSONPath(uri.fsPath)
        };
    },

} as const;


export default TaskSource;
