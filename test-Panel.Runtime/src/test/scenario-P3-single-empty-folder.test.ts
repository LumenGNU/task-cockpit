import * as assert from 'assert';
import Monitor from '../Runtime/Monitor';


/** Polling interval cap для тестового Monitor (мс). */
const POLL_CAP = 2000;


/** Достаёт приватный метод pollingInterval для white-box тестирования кривой. */
function getPollingInterval(monitor: Monitor): typeof monitor['pollingInterval'] {
    if ('pollingInterval' in monitor && typeof monitor['pollingInterval'] === 'function') {
        return monitor['pollingInterval'].bind(monitor);
    }
    throw new TypeError('Monitor.pollingInterval is not accessible — method renamed or removed?');
}


// White-box: тестирование adaptive polling curve
suite('@module MainPanel.Runtime:Monitor (pollingInterval)', function () {

    suite('Scenario P3', () => {

        let monitor: Monitor;
        let interval: ReturnType<typeof getPollingInterval>;

        setup(function () {
            monitor = new Monitor(POLL_CAP);
            interval = getPollingInterval(monitor);
        });

        teardown(function () {
            monitor.dispose();
        });


        // Интервал растёт с числом процессов (нелинейная кривая)
        test('polling interval grows with process count', function () {
            assert.strictEqual(interval(0), undefined, 'zero processes → undefined (stop)');

            const for1 = interval(1)!;
            const for3 = interval(3)!;
            const for15 = interval(15)!;

            assert.ok(for1 > 0, 'must be positive');
            assert.ok(for3 > for1, `3 processes (${for3}) must be slower than 1 (${for1})`);
            assert.ok(for15 > for3, `15 processes (${for15}) must be slower than 3 (${for3})`);
        });


        // Интервал не превышает cap даже при огромном числе процессов
        test('polling interval respects cap', function () {
            const result = interval(1000)!;
            assert.ok(result <= POLL_CAP, `interval (${result}) must not exceed cap (${POLL_CAP})`);
        });

    });

});