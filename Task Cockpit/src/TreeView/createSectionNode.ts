import buildHierarchy from './buildHierarchy';
import ScopeSection from './Section/ScopeSection';
import type ScopeInput from '../ProjectSpace/ScopeInput';
import type ScopeKey from '../Scope/Key';


function createSectionNode(
    scopeKey: ScopeKey,
    scopeInput: Readonly<ScopeInput>
): Readonly<ScopeSection> {

    const { label, scopeType, sourceUri } = scopeInput;
    const { children, stats } = buildHierarchy({
        definitions: scopeInput.definitions,
        filter:
            scopeInput.config.filtering.showHidden
                ? undefined
                : function (_taskName, definition) { return !definition.hidden; },
        hierarchyConfig: scopeInput.config.hierarchyConf,
        pathCompression: 'off',
    });

    return ScopeSection.create(
        scopeKey,
        {
            children,
            label,
            scopeType,
            sourceUri,
            stats,
            scopeKey
        }
    );
}


export default createSectionNode;
