/** Устаревшая запись закреплённой задачи, scope которой больше не существует. */
export interface PinnedStale {
    scopeName: string;
    label: string;
}
