import type Config from '../Configuration/Scoped/Config';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type Scope from '../Scope/Scope';
import type SourceFile from '../Scope/SourceFile/SourceFile';
import type Definitions from '../Scope/TaskSource/Definitions/Definitions';

/** Входные данные для одного {@linkcode Scope} —
 * области-источника задач, для которой собраны данные. */
interface ScopeInput {

    /** Отображаемое имя области */
    displayName: string;

    /** Файл-источник задач ассоциированный с даной областью */
    sourceFile: SourceFile;

    /** Конфигурация области. */
    config: Config;

    /** Карта определений задач, индексированная по имени задачи. */
    definitions: Definitions;
}

export default ScopeInput;
