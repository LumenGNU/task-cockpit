
import * as assert from 'node:assert/strict';
import EligibleMap from 'src/EligibleTask/EligibleMap';
import EligibleTaskCache from 'src/EligibleTask/EligibleTaskCache';
import fetchEligibleTasks from 'src/EligibleTask/fetchEligibleTasks';
import WorkspaceKey from 'src/Scope/Workspace/Key';
import TaskName from 'src/type.d/TaskName';
import { CancellationToken } from 'vscode';


// `${/*N=0*/'000'/**/}`

suite('EligibleTaskCache', function () {

    suite('Lazy init', function () {

        test(`${/*++N*/'001'/**/} Создали кэш — fetch не запущен`, function () {

            let callCount = 0;

            const cache = new EligibleTaskCache(
                1000,
                (token) => {
                    callCount++;
                    return fetchEligibleTasks(token);
                }
            );

            assert.equal(callCount, 0);
            cache.dispose();
        });


        test(`${/*++N*/'002'/**/} Первый getEligibleTask() запускает fetch`, async function () {

            let callCount = 0;

            const cache = new EligibleTaskCache(
                1000,
                (token) => {
                    callCount++;
                    return fetchEligibleTasks(token);
                }
            );

            cache.snapshot.getEligibleTask('' as any, '' as any,);

            assert.equal(callCount, 1);
            cache.dispose();
        });



        test(`${/*++N*/'003'/**/} Второй параллельный getEligibleTask() во время fetch — не запускает новый, ждёт того же promise`, async function () {

            let callCount = 0;

            const cache = new EligibleTaskCache(
                1000,
                (token) => {
                    callCount++;
                    return fetchEligibleTasks(token);
                }
            );

            cache.snapshot.getEligibleTask('' as any, '' as any,);
            cache.snapshot.getEligibleTask('' as any, '' as any,);
            cache.snapshot.getEligibleTask('' as any, '' as any,);

            assert.equal(callCount, 1);
            cache.dispose();
        });


        test(`${/*++N*/'004'/**/} После разрешения — оба получают одинаковый снимок`, async function () {

            const cache = new EligibleTaskCache(
                1000,
                (token) => {
                    return fetchEligibleTasks(token);
                }
            );

            const p1 = cache.snapshot.getEligibleTask(WorkspaceKey, 'My Task' as TaskName);
            const p2 = cache.snapshot.getEligibleTask(WorkspaceKey, 'My Task' as TaskName);

            const [r1, r2] = await Promise.all([p1, p2]);

            assert.ok(r1);
            assert.ok(r2);
            assert.strictEqual(r1, r2);

            cache.dispose();

        });

    });

});
