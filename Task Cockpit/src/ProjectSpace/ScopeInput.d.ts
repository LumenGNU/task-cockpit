import type Config from '../Configuration/Scoped/Config';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type Scope from '../Scope/Scope';
import type ScopeType from '../Scope/Type';
import type Definitions from '../Scope/TaskSource/Definitions/Definitions';
import type SourceUri from '../Scope/SourceUri/SourceUri';

/** Входные данные для одного {@linkcode Scope} —
 * области-источника задач, для которой собраны данные. */
interface ScopeInput {

    // Тип области
    scopeType: ScopeType;

    /** Отображаемое имя области */
    label: string;

    /** Файл-источник задач ассоциированный с даной областью (может не существовать физически) */
    sourceUri: SourceUri;

    /** Конфигурация для области. */
    config: Config;

    /** Карта определений задач из этой области, индексированная по имени задачи. */
    definitions: Definitions;
}

export default ScopeInput;
