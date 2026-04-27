import type * as TC from './types';

export const WORKSPACE_KEY: TC.WorkspaceKey = '\x00\x00$Workspace' as const;

export const GROUP_SEPARATOR: TC.GroupSeparator = '\u001D#\u001D' as const;
