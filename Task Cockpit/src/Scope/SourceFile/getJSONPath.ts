import type SourceFile from './SourceFile';


function getJSONPath(sourceFile: SourceFile): ReadonlyArray<string> {
    if (sourceFile.endsWith('.code-workspace')) {
        return ['tasks', 'tasks'];
    }

    return ['tasks'];
}


export default getJSONPath;
