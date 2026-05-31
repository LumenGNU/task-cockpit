declare const ___SourceFile: unique symbol;


/** Номинальный тип для fsPath файла-источника задач.
 *
 * Это просто идентификатор, позволяющий однозначно определить путь к задаче.
 * Физической связи scopeTasksFile->файл_в_наличии нет.
 *
 *  */
type SourceFile = string & { readonly [___SourceFile]: never; };


export default SourceFile;
