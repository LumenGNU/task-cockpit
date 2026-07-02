import {
    workspace,
    FileType
} from 'vscode';
import getJSONPath from './getJSONPath';
import getSourceUri from './getSourceUri';
import type FolderScope from '../Scope/Folder/Folder';
import type TaskSource from './TaskSource';
import type WorkspaceScope from '../Scope/Workspace/Workspace';


/** Разрешает файл-источник для указанной области
 *
 * - Folder-scope → `.vscode/tasks.json`, путь `['tasks']`.
 * - Workspace-scope → `.code-workspace`, путь `['tasks', 'tasks']`.
 *
 * Возвращает `null`, если файл-источник не существует
 *
 * Семантика: "эта область (не)разрешается в источник задач".
 * Не дает информации "есть ли задачи фактически".
 *
 * @throws { never } Не бросает */
async function resolveTaskSource(scope: WorkspaceScope | FolderScope): Promise<Readonly<TaskSource> | null> {

    const uri = getSourceUri(scope);

    try {
        const stat = await workspace.fs.stat(uri);
        if (!(stat.type & FileType.File)) {
            return null;
        }
    }
    catch {
        return null;
    }

    return {
        uri,
        JSONPath: getJSONPath(uri.fsPath)
    };
}


export default resolveTaskSource;
