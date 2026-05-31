import assert from 'node:assert/strict';
import ProcessRegistry from 'src/Runtime/ProcessRegistry';
import type ProcessId from 'src/type.d/ProcessId';
import type TaskId from 'src/type.d/TaskId';


function hashDjb2(s: string): number {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i); // hash * 33 + c
    }
    return hash | 0; // привести к 32-битному целому
}


// Хелперы для branded types
const pid = (s: string): ProcessId => hashDjb2(s) as ProcessId;
const tid = (s: string) => s as TaskId;

let monotonic = 0;
const tStamp = (val?: number) => val ?? ++monotonic;


// `${/*N=0*/'000'/**/}`

suite('ProcessRegistry', function () {

    let registry: ProcessRegistry;


    setup(function () {
        monotonic = 0;
        registry = ProcessRegistry.create();
    });

    // ----------------------------------------------------------------------
    suite('register', function () {

        test(`${/*++N*/'001'/**/} процесс добавляется в состоянии running`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            assert.equal(registry.getByProcessId(pid('p1'))?.running, true);
        });

        test(`${/*++N*/'002'/**/} get возвращает корректные поля после регистрации`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            const entry = registry.getByProcessId(pid('p1'));
            assert.deepEqual(entry, { running: true, timestamp: 100, taskId: tid('t1') });
        });

        test(`${/*++N*/'006'/**/} дубликат processId — ошибка`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            assert.throws(() => registry.register(pid('p1'), tid('t2'), tStamp()));
        });

    });


    // ----------------------------------------------------------------------
    suite('markCompleted', function () {

        test(`${/*++N*/'007'/**/} процесс переходит в running=false`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.markCompleted([pid('p1')]);
            assert.equal(registry.getByProcessId(pid('p1'))?.running, false);
        });

        test(`${/*++N*/'008'/**/} процесс остаётся в реестре после markCompleted`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.markCompleted([pid('p1')]);
            assert.ok(registry.getByProcessId(pid('p1')));
        });

        test(`${/*++N*/'010'/**/} markCompleted на незарегистрированный процесс — ошибка`, function () {

            assert.throws(() => registry.markCompleted([pid('ghost')]));
        });

        test(`${/*++N*/'011'/**/} только указанные процессы переходят в completed`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.register(pid('p2'), tid('t1'), tStamp());

            registry.markCompleted([pid('p1')]);

            assert.equal(registry.getByProcessId(pid('p1'))?.running, false);
            assert.equal(registry.getByProcessId(pid('p2'))?.running, true);
        });


        test(`${/*++N*/'030'/**/} возвращает TaskId затронутой задачи`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            const result = registry.markCompleted([pid('p1')]);
            assert.deepEqual(result, [tid('t1')]);
        });

        test(`${/*++N*/'031'/**/} возвращает TaskId всех затронутых задач`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.register(pid('p2'), tid('t2'), tStamp());
            const result = registry.markCompleted([pid('p1'), pid('p2')]);
            assert.equal(result.length, 2);
            assert.ok(result.includes(tid('t1')));
            assert.ok(result.includes(tid('t2')));
        });

        test(`${/*++N*/'032'/**/} возвращает уникальные TaskId без дубликатов`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.register(pid('p2'), tid('t1'), tStamp());
            const result = registry.markCompleted([pid('p1'), pid('p2')]);
            assert.deepEqual(result, [tid('t1')]);
        });

    });


    // ----------------------------------------------------------------------
    suite('reconcileSnapshot', function () {

        test(`${/*++N*/'016'/**/} процесс, отсутствующий в снапшоте и не новее него, удаляется`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            registry.reconcileSnapshot({ timestamp: 200, processIds: new Set() });
            assert.equal(registry.getByProcessId(pid('p1')), undefined);
        });

        test(`${/*++N*/'017'/**/} процесс, присутствующий в снапшоте, не удаляется`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            registry.reconcileSnapshot({ timestamp: 200, processIds: new Set([pid('p1')]) });
            assert.ok(registry.getByProcessId(pid('p1')));
        });

        test(`${/*++N*/'018'/**/} процесс новее снапшота не удаляется, даже если отсутствует в нём`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(300)); // timestamp > snapshot.timestamp
            registry.reconcileSnapshot({ timestamp: 200, processIds: new Set() });
            assert.ok(registry.getByProcessId(pid('p1')));
        });

        test(`${/*++N*/'019'/**/} процесс с timestamp == snapshot.timestamp удаляется (не новее)`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(200));
            registry.reconcileSnapshot({ timestamp: 200, processIds: new Set() });
            assert.equal(registry.getByProcessId(pid('p1')), undefined);
        });

        test(`${/*++N*/'020'/**/} смешанный сценарий: старый без снапшота удаляется, новый — нет`, function () {

            registry.register(pid('old'), tid('t1'), tStamp(100));
            registry.register(pid('new'), tid('t1'), tStamp(300));
            registry.reconcileSnapshot({ timestamp: 200, processIds: new Set() });
            assert.equal(registry.getByProcessId(pid('old')), undefined);
            assert.ok(registry.getByProcessId(pid('new')));
        });

        test(`${/*++N*/'036'/**/} возвращает TaskId удалённых процессов`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            const result = registry.reconcileSnapshot({ timestamp: 200, processIds: new Set() });
            assert.deepEqual(result, [tid('t1')]);
        });

        test(`${/*++N*/'037'/**/} возвращает TaskId по нескольким задачам`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            registry.register(pid('p2'), tid('t2'), tStamp(100));
            const result = registry.reconcileSnapshot({ timestamp: 200, processIds: new Set() });
            assert.equal(result.length, 2);
            assert.ok(result.includes(tid('t1')));
            assert.ok(result.includes(tid('t2')));
        });

        test(`${/*++N*/'038'/**/} возвращает пустой массив если ничего не удалено`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            const result = registry.reconcileSnapshot({ timestamp: 200, processIds: new Set([pid('p1')]) });
            assert.deepEqual(result, []);
        });

    });


    // ----------------------------------------------------------------------
    suite('getByTaskId', function () {

        test(`${/*++N*/'004'/**/} несколько процессов одной задачи — все видны через forTask`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.register(pid('p2'), tid('t1'), tStamp());

            const list = registry.getByTaskId(tid('t1'));

            assert.ok(list);
            assert.equal(list.size, 2);
            assert.ok(list.has(pid('p1')) && list.has(pid('p2')), 'в list только процессы задачи t1');

        });

        test(`${/*++N*/'005'/**/} процессы разных задач не смешиваются в forTask`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.register(pid('p2'), tid('t2'), tStamp());

            assert.equal(registry.getByTaskId(tid('t1'))?.size, 1);
            assert.ok(registry.getByTaskId(tid('t1'))?.has(pid('p1')));

            assert.equal(registry.getByTaskId(tid('t2'))?.size, 1);
            assert.ok(registry.getByTaskId(tid('t2'))?.has(pid('p2')));
        });

        test(`${/*++N*/'003'/**/} процесс виден через forTask`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            const list = registry.getByTaskId(tid('t1'));

            assert.ok(list);
            assert.equal(list.size, 1);

            assert.ok(list.has(pid('p1')));

        });

        test(`${/*++N*/'021'/**/} возвращает undefined если у задачи нет процессов`, function () {

            assert.equal(registry.getByTaskId(tid('t1')), undefined);
        });

    });


    // ----------------------------------------------------------------------
    suite('summaryByTaskId', function () {

        test(`${/*++N*/'023'/**/} возвращает undefined если у задачи нет процессов`, function () {

            assert.equal(registry.summaryByTaskId(tid('t1')), undefined);
        });

        test(`${/*++N*/'024'/**/} корректно считает total и running`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.register(pid('p2'), tid('t1'), tStamp());
            registry.register(pid('p3'), tid('t1'), tStamp());
            registry.markCompleted([pid('p1')]);
            const summary = registry.summaryByTaskId(tid('t1'));
            assert.deepEqual(summary, { total: 3, running: 2 });
        });

        test(`${/*++N*/'026'/**/} taskSummary не смешивает процессы разных задач`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp());
            registry.register(pid('p2'), tid('t2'), tStamp());
            registry.markCompleted([pid('p2')]);
            assert.deepEqual(registry.summaryByTaskId(tid('t1')), { total: 1, running: 1 });
            assert.deepEqual(registry.summaryByTaskId(tid('t2')), { total: 1, running: 0 });
        });

    });

    // ----------------------------------------------------------------------
    suite('мутация результата не затрагивает реестр', function () {

        test(`${/*++N*/'027'/**/} get — мутация свойства не меняет внутренее состояние`, function () {

            const mutator = (taskProcess: ProcessRegistry.Process | undefined) => { taskProcess!.timestamp = 0; };

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            registry.register(pid('p2'), tid('t1'), tStamp(200));

            const prc1 = registry.getByProcessId(pid('p1'));
            prc1!
                // @ts-expect-error ts тут видит ro
                .timestamp = 0;

            const prc2 = registry.getByProcessId(pid('p2'));

            mutator(prc2);

            // внутренее состояние не мутировало
            assert.equal(registry.getByProcessId(pid('p1'))?.timestamp, 100);
            assert.equal(registry.getByProcessId(pid('p2'))?.timestamp, 200);

        });

        test(`${/*++N*/'028'/**/} forTask — мутация массива не меняет внутренее состояние`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            registry.register(pid('p2'), tid('t1'), tStamp(200));

            const prcss = registry.getByTaskId(tid('t1'));
            assert.ok(prcss);
            assert.equal(prcss.size, 2);

            const mutator = (prcss: Set<ProcessId>) => {
                prcss.clear();
            };

            // @ts-expect-error ts тут видит ro
            mutator(prcss);

            assert.equal(registry.getByTaskId(tid('t1'))?.size, 2);
        });


        test(`${/*++N*/'029'/**/} taskSummary — мутация свойства не меняет внутренее состояние`, function () {

            registry.register(pid('p1'), tid('t1'), tStamp(100));
            registry.register(pid('p2'), tid('t1'), tStamp(200));

            const summary = registry.summaryByTaskId(tid('t1'));

            assert.equal(summary?.total, 2);

            const mutator = (summary: { total: number; }) => { summary.total = 100; };

            mutator(summary);

            assert.equal(registry.summaryByTaskId(tid('t1'))?.total, 2);

        });

    });

});
