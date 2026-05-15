import * as assert from 'assert/strict';
import Monitor from '../../../src/Runtime/Monitor';


/** Polling interval cap для тестового Monitor (мс). */
const POLL_INTERVAL = 500;
const monitorSettings: Monitor.Settings = {
    polling: {
        min: POLL_INTERVAL,
        cap: POLL_INTERVAL * 2,
        acceleration: 0.5,
    },
};


/** Достаёт приватный метод pollingInterval для white-box тестирования кривой. */
function getPollingInterval(monitor: Monitor): typeof monitor['pollingInterval'] {
    if ('pollingInterval' in monitor && typeof monitor['pollingInterval'] === 'function') {
        return monitor['pollingInterval'].bind(monitor);
    }
    throw new TypeError('Monitor.pollingInterval is not accessible — method renamed or removed?');
}

// `${/*N=0*/'000'/**/}` 

suite('Workspace:Runtime:Monitor', function () {

    suite('pollingInterval (adaptive polling curve)', () => {

        let monitor: Monitor;
        let pollingInterval: (typeof monitor)['pollingInterval'];

        setup(function () {
            monitor = new Monitor(monitorSettings);
            pollingInterval = getPollingInterval(monitor);
        });

        teardown(function () {
            monitor.dispose();
        });


        test(`${/*++N*/'001'/**/} при нуле процессов интервал undefined → опрос отключен`, function () {

            const for0 = pollingInterval(0);
            assert.strictEqual(for0, undefined, 'zero processes → undefined (stop)');
        });


        test(`${/*++N*/'002'/**/} при малом числе процессов интервал не меньше min`, function () {

            const for1 = pollingInterval(1);
            assert.ok(for1);
            assert.ok(for1 >= monitorSettings.polling.min, `interval (${for1}) must not be below min (${monitorSettings.polling.min})`);

        });


        test(`${/*++N*/'003'/**/} интервал растёт с числом процессов`, function () {

            const for1 = pollingInterval(1);
            const for3 = pollingInterval(3);
            const for15 = pollingInterval(15);

            assert.ok(for1);
            assert.ok(for3);
            assert.ok(for15);

            assert.ok(for3 > for1, `3 processes (${for3}) must be slower than 1 (${for1})`);
            assert.ok(for15 > for3, `15 processes (${for15}) must be slower than 3 (${for3})`);
        });


        test(`${/*++N*/'004'/**/} интервал не превышает cap даже при огромном числе процессов`, function () {

            const for1000 = pollingInterval(1000);
            assert.ok(for1000);
            assert.ok(for1000 <= monitorSettings.polling.cap, `interval (${for1000}) must not exceed cap (${monitorSettings.polling.cap})`);
        });

    });

});
