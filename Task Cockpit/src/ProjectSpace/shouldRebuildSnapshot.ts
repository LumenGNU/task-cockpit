import {
    type ConfigurationChangeEvent
} from 'vscode';
import {
    CONFIG_SECTION_NAME
} from '../constants';


function shouldRebuildSnapshot(event: ConfigurationChangeEvent): boolean {

    // @todo  supports dotted names
    return event.affectsConfiguration(CONFIG_SECTION_NAME) || event.affectsConfiguration('tasks');
}


export default shouldRebuildSnapshot;
