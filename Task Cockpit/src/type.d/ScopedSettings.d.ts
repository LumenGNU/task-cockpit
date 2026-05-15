import type { NodeConfig } from './NodeConfig';
import type { TreeConfig } from './TreeConfig';

/** Настройки для конкретной скопы.
 * Поля разделены по назначению — см. {@link ScopedSettings.TreeConfig}
 * и {@link ScopedSettings.NodeConfig}. */
export interface ScopedSettings {

    /** Параметры, определяющие структуру ветки дерева для scope. */
    treeConfig: TreeConfig;

    /** Параметры, определяющие визуальное отображение элементов дерева. */
    nodeConfig: NodeConfig;
}
