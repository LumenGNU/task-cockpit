import type SourceUri from '../SourceUri/SourceUri';


/** Файл-источник определений задач */
interface TaskSource {
    uri: SourceUri;
    JSONPath: ReadonlyArray<string>;
}


export default TaskSource;
