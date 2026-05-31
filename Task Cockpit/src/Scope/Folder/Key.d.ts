import type {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Uri
} from 'vscode';


declare const ___Folder: unique symbol;


/** Строковое представление {@link Uri.toString | folder URI}.
 * Служит ключом сериализации для folder-scoped задач. */
type Key = string & {
    readonly [___Folder]: never;
};


export default Key;
