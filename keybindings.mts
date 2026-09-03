#!/usr/bin/env -S npx tsx

import {
    USER_TREE,
    PROJECT_TREE
} from './src/common.js';


function _J(s: string | string[]): string {
    return Array.isArray(s)
        ? s.join(' ')
        : s;
}


const KBD_OPEN = 'f7';

const KEYBINDINGS = [
    {
        key: KBD_OPEN,
        command: USER_TREE.COMMAND.OPEN_USER_TASKS.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`,
            `&& listHasSelectionOrFocus`,
            `&& ${USER_TREE.WHEN.SELECTED_NODE_TYPE}`,
        ])
    },
    {
        key: KBD_OPEN,
        command: PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& listHasSelectionOrFocus`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} != RunnableNode`
        ])
    },
    {
        key: KBD_OPEN,
        command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& listHasSelectionOrFocus`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`
        ])
    }
];

console.log(
    JSON.stringify(KEYBINDINGS, null, 4) + '\n'
);
