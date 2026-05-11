import type {
    WorkspaceKey,
    GroupSeparator,
    ConfigSectionName,
    DisplaySeparator
} from "./types";




export const GROUP_SEPARATOR = '\u001D#\u001D' satisfies GroupSeparator;
export const DISPLAY_SEPARATOR = ' • ' satisfies DisplaySeparator;
export const WORKSPACE_KEY = '\x00\x00$Workspace' satisfies WorkspaceKey;


export const COCKPIT_CNF_SECTION_NAME = 'taskCockpit' satisfies ConfigSectionName;
