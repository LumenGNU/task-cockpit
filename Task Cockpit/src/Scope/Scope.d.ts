
import type Folder from './Folder/Folder';
import type Workspace from './Workspace/Workspace';
import type Global from './Global/Global';


/** Scope — область-источник задач и их настроек.
 *
 * - Является единицей владения задачами и их конфигурацией:
 *   каждая задача принадлежит ровно одному scope.
 * - Задачи из разных scope не смешиваются; любые операции
 *   выполняются в контексте конкретного scope.
 * - Настройки (конфигурация области) также принадлежат scope
 *   и применяются только к его задачам.
 * */
type Scope = Global | Workspace | Folder;

export default Scope;
