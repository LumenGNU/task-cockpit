declare const ___FolderKey: unique symbol;


/** Строковое представление {@-link vscode.Uri.toString | folder URI}.
 * Служит ключом сериализации для folder-scoped задач. */
export type FolderKey = string & {
    readonly [___FolderKey]: never;
};
