import type Config from '../Configuration/Resource/Config';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type Scope from '../Scope/Scope';
import type ScopeType from '../Scope/Type';
import type TaskDefinition from '../Configuration/TaskDefinition';
import type SourceUri from '../Scope/SourceUri/SourceUri';
import type ScopedDetail from './ScopedDetail';
import type HierarchyElement from '../HierarchyModel/HierarchyElement';
import type TaskName from '../TaskName/TaskName';
import type DefinitionId from '../EligibleTask/DefinitionId';

/** Входные данные для одного {@linkcode Scope} —
 * области-источника задач, для которой собраны данные. */
interface ScopeData {

    // Тип области
    type: ScopeType;

    /** Отображаемое имя области */
    label: string;

    /** Файл-источник задач ассоциированный с даной областью (может не существовать физически) */
    sourceUri: SourceUri;

    /** Конфигурация для области. */
    nodeConfig: Config['Node'];

    /** Карта определений задач из этой области, индексированная по имени задачи. */
    definitions: ReadonlyMap<TaskName, TaskDefinition>;

    detail: ScopedDetail;

    userProps: Readonly<{ pins: ReadonlyMap<TaskName, DefinitionId | null> | null; }> | null,

    /**
     * null — только если scope скрыт для просмотра
    */
    scopeHierarchy: ReadonlyArray<HierarchyElement> | null;

    /**
     * null — нет пинов в этой scope
    */
    pinHierarchy: ReadonlyArray<HierarchyElement> | null;
}

export default ScopeData;
