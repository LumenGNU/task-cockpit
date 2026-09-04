#!/usr/bin/env -S npx tsx

import {
    EXTENSION,
    USER_TREE,
    PROJECT_TREE
} from './src/common.js';


function _J(s: string | string[]): string {
    return Array.isArray(s)
        ? s.join(' ')
        : s;
}


const KBD_OPEN = '';
const KBD_TASK_RUN = '';
const KBD_TASK_ABORT_ALL_INSTANCES = '';
const KBD_TASK_NAVIGATE_TO_TERMINAL = '';
const KBD_LIST_FIND = '';
const KBD_FULL_REFRESH = '';
const KBD_LIST_EXPAND_ALL = '';
const KBD_LIST_COLLAPSE_ALL = '';


const KEYBINDINGS = [

    // ------------------------------------------------------------------
    // Open User Tasks / Open Tasks File / Open Task Definition
    {
        key: KBD_OPEN,
        command: USER_TREE.COMMAND.OPEN_USER_TASKS.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`,
            `&& ${USER_TREE.WHEN.SELECTED_NODE_TYPE}`,
        ])
    },
    {
        key: KBD_OPEN,
        command: PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} != RunnableNode`
        ])
    },
    {
        key: KBD_OPEN,
        command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`
        ])
    },

    // -----------------------------------------------------------------------------
    // "Run Task / Run New Instance
    {
        key: KBD_TASK_RUN,
        command: USER_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`,
            `&& ${USER_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& viewItem =~ /:Running/`
        ])
    },
    {
        key: KBD_TASK_RUN,
        command: PROJECT_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& viewItem =~ /:Running/`
        ])
    },
    {
        key: KBD_TASK_RUN,
        command: USER_TREE.COMMAND.TASK_RUN_INLINE.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`,
            `&& ${USER_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& !(viewItem =~ /:Running/)`
        ])
    },
    {
        key: KBD_TASK_RUN,
        command: PROJECT_TREE.COMMAND.TASK_RUN_INLINE.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& !(viewItem =~ /:Running/)`
        ])
    },

    // -----------------------------------------------------------------------------
    // Abort All Instances
    {
        key: KBD_TASK_ABORT_ALL_INSTANCES,
        command: USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`,
            `&& ${USER_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& !(viewItem =~ /:Running/)`
        ])
    },
    {
        key: KBD_TASK_ABORT_ALL_INSTANCES,
        command: PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& !(viewItem =~ /:Running/)`
        ])
    },

    // -----------------------------------------------------------------------------
    // Navigate to Terminal
    {
        key: KBD_TASK_NAVIGATE_TO_TERMINAL,
        command: USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`,
            `&& ${USER_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& !(viewItem =~ /:Terminals/)`
        ])
    },
    {
        key: KBD_TASK_NAVIGATE_TO_TERMINAL,
        command: PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`,
            `&& ${PROJECT_TREE.WHEN.SELECTED_NODE_TYPE} == RunnableNode`,
            `&& !(viewItem =~ /:Terminals/)`
        ])
    },

    // -----------------------------------------------------------------------------
    // Find in List
    {
        key: KBD_LIST_FIND,
        command: USER_TREE.COMMAND.LIST_FIND.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`
        ])
    },
    {
        key: KBD_LIST_FIND,
        command: PROJECT_TREE.COMMAND.LIST_FIND.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`
        ])
    },

    // -----------------------------------------------------------------------------
    // Refresh Lists
    {
        key: KBD_FULL_REFRESH,
        command: EXTENSION.COMMAND.FULL_REFRESH.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID} || focusedView == ${PROJECT_TREE.ID}`
        ])
    },

    // -----------------------------------------------------------------------------
    // Expand All
    {
        key: KBD_LIST_EXPAND_ALL,
        command: USER_TREE.COMMAND.LIST_EXPAND_ALL.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`
        ])
    },
    {
        key: KBD_LIST_EXPAND_ALL,
        command: PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`
        ])
    },

    // -----------------------------------------------------------------------------
    //
    {
        key: KBD_LIST_COLLAPSE_ALL,
        command: USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ID,
        when: _J([
            `focusedView == ${USER_TREE.ID}`
        ])
    },
    {
        key: KBD_LIST_COLLAPSE_ALL,
        command: PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ID,
        when: _J([
            `focusedView == ${PROJECT_TREE.ID}`
        ])
    },

];

KEYBINDINGS.forEach((k) => {
    console.log(
        JSON.stringify(k, null, 4) + ','
    );
});
