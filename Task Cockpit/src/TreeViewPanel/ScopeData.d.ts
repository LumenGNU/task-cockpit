
import type TaskName from '../TaskName';
import type HierarchyModel from '../HierarchyModel/HierarchyModel';
import type { Scope } from '../ResourceState/ResourceStateCoordinator';
import ScopeKey from '../ScopeKey';

/** Входные данные для одного {@linkcode Scope} —
 * области-источника задач, для которой собраны данные. */
type ScopeData =
    {
        scopeKey: ScopeKey;

        // Тип области
        // scopeType: 'Global' | 'Workspace' | 'Folder'; // | 'Stale';

        /** Отображаемое имя области */
        displayName: string;

        /** Файл-источник задач ассоциированный с даной областью (может не существовать физически)
         *
         * Для Global-области null
         */
        taskSource: Scope.SourceUri | null;

        detail: {
            total: number;
            hiddenCount: number;
        };

        hierarchy: HierarchyModel.Hierarchy<ScopeKey, { taskName: TaskName; }>;

    };

export default ScopeData;
