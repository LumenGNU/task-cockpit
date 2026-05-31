
import Folder from './Folder/Folder.d';
import Workspace from './Workspace/Workspace.d';


/** Scope — область-источник задач и их настроек.
 *
 * - Является единицей владения задачами и их конфигурацией:
 *   каждая задача принадлежит ровно одному scope.
 * - Задачи из разных scope не смешиваются; любые операции
 *   выполняются в контексте конкретного scope.
 * - Настройки (конфигурация области) также принадлежат scope
 *   и применяются только к его задачам.
 * */
type Scope = Workspace | Folder;

export default Scope;
