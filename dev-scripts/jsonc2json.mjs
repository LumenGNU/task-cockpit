// @ts-check

import * as fs from 'fs';
import * as JSONC from 'jsonc-parser';

// @todo скрипт можно безопасно прервать

const EXTENSION_JSONC = process.env.EXTENSION_JSONC; // './extension.jsonc';
const PACKAGE_IN = process.env.PACKAGE_IN; // './package.json';
const PACKAGE_OUT = process.env.PACKAGE_OUT; // './out/package.json';

const MAIN_JS = process.env.MAIN_JS; // './out/.../extension.js';

// @todo EXTENSION_JSONC PACKAGE_IN PACKAGE_OUT и остальные требуются, значений по умолчанию - нет

// @todo мержит package.json и extension.jsonc в vscode манифест
//   EXTENSION_JSONC -> PACKAGE_IN -> PACKAGE_OUT
// @todo в package.json игнорируются .scripts, .devDependencies
// @todo устанавливает .main в MAIN_JS
// @todo устанавливает .version -- ?????

// Сохраняем как чистый JSON
// fs.writeFileSync('./config.json', JSON.stringify(data, null, 2));
console.log(JSON.stringify(data, null, 2));


// --------------------------------------------------------------------

/**
 * @param { string } fileName
*/
function jsoncRead(fileName) {


    const input = fs.readFileSync(fileName, 'utf-8');

    /** @type {JSONC.ParseError[]} */
    const errors = [];
    const data = JSONC.parse(input, errors, { allowTrailingComma: true });

    if (errors.length > 0) {
        errors.forEach((error) => {
            console.error(`Error: ${JSONC.printParseErrorCode(error.error)}. offset: ${error.offset}; length: ${error.length}`);
        });

        process.exit(1);
    }

}
