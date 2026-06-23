
import * as assert from 'node:assert/strict';
import EligibleMap from 'src/EligibleTask/EligibleMap';
import EligibleTaskCache from 'src/EligibleTask/EligibleTaskCache';
import fetchEligibleTasks from 'src/EligibleTask/fetchEligibleTasks';
import WorkspaceKey from 'src/Scope/Workspace/Key';
import TaskName from 'src/type.d/TaskName';
import { CancellationToken } from 'vscode';


// `${/*N=0*/'000'/**/}`

suite('EligibleTaskCache', function () {

    suite('TTL', function () {

        test(`${/*++N*/'001'/**/} Создали кэш — fetch не запущен`, function () {

        });
    });

});
