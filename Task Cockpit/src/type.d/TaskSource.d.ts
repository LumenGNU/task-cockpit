import type { SourceUri } from './SourceUri';

export interface TaskSource {
    uri: SourceUri;
    JSONPath: ReadonlyArray<string>;
}
