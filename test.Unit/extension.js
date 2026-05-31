//

'use strict';

let name = undefined;

function activate(context) {
    name ??= context.extension.packageJSON.name;
    console.log(`[${name}] Test environment ready`);
}

function deactivate() {
    console.log(`[${name}] Test environment stopped`);
}

module.exports = { activate, deactivate };