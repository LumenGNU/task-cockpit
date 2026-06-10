import assert from 'node:assert/strict';
import Registry, { type Stats } from 'src/Runtime/Registry';
import type ProcessId from 'src/Runtime/ProcessId';
import type TaskIdentifier from 'src/Runtime/TaskIdentifier';
import WORKSPACE_KEY from 'src/Scope/Workspace/Key';
import ScopeKey from 'src/Scope/Key';
import TaskName from 'src/type.d/TaskName';
import type Process from 'src/Runtime/Process';


function hashDjb2(s: string): number {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i); // hash * 33 + c
    }
    return hash >>> 0; // Uint32: [0, 4_294_967_295]
}


// Хелперы для branded types
const Pid = (s: string): ProcessId => hashDjb2(s) as ProcessId;

const Identifier = function (s: string) {
    const scopeKey = WORKSPACE_KEY;
    const taskName = s;

    return {
        get() {
            return { scopeKey: WORKSPACE_KEY, taskName: s } as TaskIdentifier;
        },
        get scopeKey() {
            return scopeKey as ScopeKey;
        },
        get taskName() {
            return taskName as TaskName;
        }
    } as const;

};

let monotonic = 0;
const monotonicStamp = () => ++monotonic;


// `${/*N=0*/'000'/**/}`

suite('Registry', function () {

    let registry: Registry;

    setup(function () {
        monotonic = 0;
        registry = Registry.create();
    });

    teardown(function () {
        registry?.clear();
    });

    // ----------------------------------------------------------------------
    suite('register', function () {

        test(`${/*++N*/'001'/**/} процесс добавляется в состоянии running`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            assert.equal(registry.get(Pid('p1'))?.running, true);
        });

        test(`${/*++N*/'002'/**/} get возвращает корректные поля после регистрации`, function () {

            const stamp = monotonicStamp();

            registry.register(Identifier('t1').get(), Pid('p1'), stamp);
            const entry = registry.get(Pid('p1'));
            assert.deepEqual(entry, { running: true, timestamp: stamp });
        });

        test.skip(`${/*++N*/'003'/**/} дубликат processId — ошибка (DEBUG)`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            assert.throws(() => registry.register(Identifier('t2').get(), Pid('p1'), monotonicStamp()));
        });

    });


    // ----------------------------------------------------------------------
    suite('markCompleted', function () {

        test(`${/*++N*/'004'/**/} процесс переходит в running=false`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.markCompleted(new Set([Pid('p1')]));
            assert.equal(registry.get(Pid('p1'))?.running, false);
        });

        test(`${/*++N*/'005'/**/} процесс остаётся в реестре после markCompleted`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.markCompleted(new Set([Pid('p1')]));
            assert.ok(registry.get(Pid('p1')));
        });

        test(`${/*++N*/'006'/**/} markCompleted на незарегистрированный процесс — ошибка`, function () {

            assert.throws(() => registry.markCompleted(new Set([Pid('ghost')])));
        });

        test(`${/*++N*/'007'/**/} только указанные процессы переходят в completed`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());

            registry.markCompleted(new Set([Pid('p1')]));

            assert.equal(registry.get(Pid('p1'))?.running, false);
            assert.equal(registry.get(Pid('p2'))?.running, true);
        });


        test(`${/*++N*/'008'/**/} возвращает идентификатор затронутой задачи`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const result = registry.markCompleted(new Set([Pid('p1')]));

            assert.ok(result.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName));
        });


        test(`${/*++N*/'009'/**/} идемпотентность, на уже-completed процессе — пропускает`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const result1 = registry.markCompleted(new Set([Pid('p1')]));

            assert.ok(result1.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName));

            const result2 = registry.markCompleted(new Set([Pid('p1')]));

            assert.equal(result2.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName), undefined);
        });


        test(`${/*++N*/'010'/**/} возвращает идентификаторы всех затронутых задач`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t2').get(), Pid('p2'), monotonicStamp());
            const result = registry.markCompleted(new Set([Pid('p1'), Pid('p2')]));

            assert.ok(result.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName));
            assert.ok(result.get(Identifier('t2').scopeKey)?.has(Identifier('t2').taskName));
        });

        test(`${/*++N*/'011'/**/} возвращает уникальные идентификаторы без дубликатов`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());
            const result = registry.markCompleted(new Set([Pid('p1'), Pid('p2')]));

            assert.ok(result.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName));
            assert.equal(result.get(Identifier('t1').scopeKey)?.size, 1);
        });

    });


    // ----------------------------------------------------------------------
    suite('reconcile', function () {


        test(`${/*++N*/'012'/**/} процесс, отсутствующий в снапшоте и не новее него, удаляется`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set() });
            assert.equal(registry.get(Pid('p1')), undefined);
        });


        test(`${/*++N*/'013'/**/} процесс, присутствующий в снапшоте, не удаляется`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set([Pid('p1')]) });
            assert.ok(registry.get(Pid('p1')));
        });


        test(`${/*++N*/'014'/**/} процесс новее снапшота не удаляется, даже если отсутствует в нём`, function () {

            const stampOld = monotonicStamp();
            const stampNew = monotonicStamp();

            registry.register(Identifier('t1').get(), Pid('p1'), stampNew); // timestamp > snapshot.timestamp
            registry.reconcile({ requestId: stampOld, processIds: new Set() });
            assert.ok(registry.get(Pid('p1')));
        });


        test(`${/*++N*/'015'/**/} процесс с timestamp == snapshot.timestamp удаляется (не новее)`, function () {

            const stamp = monotonicStamp();

            registry.register(Identifier('t1').get(), Pid('p1'), stamp);
            registry.reconcile({ requestId: stamp, processIds: new Set() });
            assert.equal(registry.get(Pid('p1')), undefined);
        });


        test(`${/*++N*/'016'/**/} смешанный сценарий, пустой снапшот: старый удаляется, новый — нет`, function () {

            const stampOld = monotonicStamp();
            const stampMid = monotonicStamp();
            const stampNew = monotonicStamp();

            registry.register(Identifier('t1').get(), Pid('old'), stampOld);
            registry.register(Identifier('t1').get(), Pid('new'), stampNew);

            // снапшот новее stampOld, но старее stampNew
            registry.reconcile({ requestId: stampMid, processIds: new Set() });

            assert.equal(registry.get(Pid('old')), undefined);
            assert.ok(registry.get(Pid('new')));
        });


        test(`${/*++N*/'017'/**/} удаляет процесс в любом состоянии`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());

            registry.markCompleted(new Set([Pid('p1')]));

            assert.equal(registry.get(Pid('p1'))?.running, false);
            assert.equal(registry.get(Pid('p2'))?.running, true);

            const result = registry.reconcile({ requestId: monotonicStamp(), processIds: new Set() });
            // идентификатор в результате
            assert.ok(result.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName));
            // оба процесса удалены из реестра
            assert.equal(registry.get(Pid('p1')), undefined);
            assert.equal(registry.get(Pid('p2')), undefined);
        });


        test(`${/*++N*/'018'/**/} возвращает идентификатор удалённых процессов`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const result = registry.reconcile({ requestId: monotonicStamp(), processIds: new Set() });
            assert.ok(result.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName));
        });


        test(`${/*++N*/'019'/**/} возвращает идентификаторы по нескольким задачам`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t2').get(), Pid('p2'), monotonicStamp());
            const result = registry.reconcile({ requestId: monotonicStamp(), processIds: new Set() });

            assert.ok(result.get(Identifier('t1').scopeKey)?.has(Identifier('t1').taskName));
            assert.ok(result.get(Identifier('t2').scopeKey)?.has(Identifier('t2').taskName));
        });


        test(`${/*++N*/'020'/**/} возвращает пустой результат если ничего не удалено`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const result = registry.reconcile({ requestId: monotonicStamp(), processIds: new Set([Pid('p1')]) });
            assert.equal(result.size, 0);
        });


        test(`${/*++N*/'021'/**/} ничего не делает с не зарегистрированными процессами в снапшоте`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const result = registry.reconcile({
                requestId: monotonicStamp(),
                processIds: new Set([Pid('ghost'), Pid('p1')]) // ghost не зарегистрирован
            });
            assert.equal(result.size, 0); // ничего не удалено
            assert.ok(registry.get(Pid('p1'))); // p1 остался в реестре

        });


        test(`${/*++N*/'022'/**/} markCompleted после reconcile выбрасывает ошибку`, () => {
            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set() });
            // после reconcile p1 "не зарегистрирован"
            assert.throws(() => registry.markCompleted(new Set([Pid('p1')])));
        });

    });

    // ----------------------------------------------------------------------

    suite('Изоляция ScopeKey', function () {
        test('разные ScopeKey не пересекаются', () => {
            const scopeA = 'a' as ScopeKey;
            const scopeB = 'b' as ScopeKey;
            const taskName = 'T' as TaskName;
            registry.register({ scopeKey: scopeA, taskName }, Pid('p1'), monotonicStamp());
            registry.register({ scopeKey: scopeB, taskName }, Pid('p2'), monotonicStamp());
            assert.equal(registry.ProcessId.get(scopeA)?.get(taskName)?.has(Pid('p1')), true);
            assert.equal(registry.ProcessId.get(scopeB)?.get(taskName)?.has(Pid('p2')), true);
            assert.equal(registry.Stats.get(scopeA)?.get(taskName)?.total, 1);
            assert.equal(registry.Stats.get(scopeB)?.get(taskName)?.total, 1);
        });
    });


    // ----------------------------------------------------------------------
    suite('ProcessId', function () {

        test(`${/*++N*/'023'/**/} процесс виден через идентификатор задачи`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const set = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);

            assert.ok(set);
            assert.equal(set.size, 1);

            assert.ok(set.has(Pid('p1')));

        });


        test(`${/*++N*/'024'/**/} возвращает undefined если у задачи нет процессов`, function () {
            const set = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.equal(set, undefined);

        });


        test(`${/*++N*/'025'/**/} несколько процессов одной задачи — все видны`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());

            const set = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);

            assert.ok(set);
            assert.equal(set.size, 2);
            assert.ok(set.has(Pid('p1')) && set.has(Pid('p2')), 'в list только процессы задачи t1');

        });


        test(`${/*++N*/'026'/**/} процессы разных задач не смешиваются`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t2').get(), Pid('p2'), monotonicStamp());

            const pidsT1 = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.ok(pidsT1);
            assert.ok(pidsT1.has(Pid('p1')));

            const pidsT2 = registry.ProcessId.get(Identifier('t2').scopeKey)?.get(Identifier('t2').taskName);
            assert.ok(pidsT2);
            assert.ok(pidsT2.has(Pid('p2')));

        });


        test(`${/*++N*/'027'/**/} после удаления последнего процесса задачи возвращает undefined`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const pidsT1 = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.ok(pidsT1);

            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set([]) });

            const pidsT2 = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.equal(pidsT2, undefined);
        });


        test(`${/*++N*/'028'/**/} TOCTOU двухуровневого геттера, inner-get должен вернуть undefined`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());

            // ProcessId и Stats
            const getter = registry.ProcessId.get(Identifier('t1').scopeKey);
            assert.ok(getter); // scope существовал

            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set() });
            assert.ok(!registry.ProcessId.get(Identifier('t1').scopeKey)); // scope удалён

            // inner-get должен вернуть undefined, а не взорваться
            assert.equal(getter.get(Identifier('t1').taskName), undefined);
        });
    });


    // ----------------------------------------------------------------------
    suite('Stats', function () {

        test(`${/*++N*/'029'/**/} сводка видна через идентификатор задачи`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const stats = registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);

            assert.ok(stats);
        });


        test(`${/*++N*/'030'/**/} возвращает undefined если у задачи нет процессов`, function () {

            const stats = registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.equal(stats, undefined);
        });


        test(`${/*++N*/'031'/**/} корректно считает total и running`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p3'), monotonicStamp());
            const stats1 = registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.deepEqual(stats1, { total: 3, running: 3 });
            registry.markCompleted(new Set([Pid('p1')]));
            const stats2 = registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.deepEqual(stats2, { total: 3, running: 2 });
            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set([Pid('p2'), Pid('p3')]) });
            const stats3 = registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.deepEqual(stats3, { total: 2, running: 2 });
        });


        test(`${/*++N*/'032'/**/} не смешивает процессы разных задач`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t2').get(), Pid('p2'), monotonicStamp());
            registry.markCompleted(new Set([Pid('p2')]));
            assert.deepEqual(registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName), { total: 1, running: 1 });
            assert.deepEqual(registry.Stats.get(Identifier('t2').scopeKey)?.get(Identifier('t2').taskName), { total: 1, running: 0 });
        });


        test(`${/*++N*/'033'/**/} после удаления последнего процесса задачи возвращает undefined`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());

            assert.ok(registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName));

            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set([Pid('p2')]) });

            assert.ok(registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName));

            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set([]) });

            assert.equal(registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName), undefined);

        });

        test(`${/*++N*/'034'/**/} TOCTOU двухуровневого геттера, inner-get должен вернуть undefined`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());

            // ProcessId и Stats
            const getter = registry.Stats.get(Identifier('t1').scopeKey);
            assert.ok(getter); // scope существовал

            registry.reconcile({ requestId: monotonicStamp(), processIds: new Set() });
            assert.ok(!registry.Stats.get(Identifier('t1').scopeKey)); // scope удалён

            // inner-get должен вернуть undefined, а не взорваться
            assert.equal(getter.get(Identifier('t1').taskName), undefined);
        });
    });


    suite('clear', function () {

        test(`${/*++N*/'035'/**/} после clear все геттеры возвращают undefined`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());

            assert.ok(registry.get(Pid('p1')));

            registry.clear();

            assert.equal(registry.get(Pid('p1')), undefined);
            assert.equal(registry.ProcessId.get(Identifier('t1').scopeKey), undefined);

        });

        test.skip(`${/*++N*/'036'/**/} после clear дубликат processId НЕ бросает (DEBUG)`, function () {
            assert.fail('TODO');
        });

    });


    // ----------------------------------------------------------------------
    suite('Readonly API — мутация результата не затрагивает реестр', function () {

        test(`${/*++N*/'037'/**/} get — мутация результата не меняет внутреннее состояние`, function () {

            const stamp1 = monotonicStamp();
            const stamp2 = monotonicStamp();

            const mutator = (taskProcess: Process | undefined) => { taskProcess!.timestamp = 0; };

            registry.register(Identifier('t1').get(), Pid('p1'), stamp1);
            registry.register(Identifier('t1').get(), Pid('p2'), stamp2);

            const prc1 = registry.get(Pid('p1'));
            prc1!
                // @ts-expect-error ts тут видит ro
                .timestamp = 0;

            const prc2 = registry.get(Pid('p2'));

            mutator(prc2);

            // внутреннее состояние не мутировало
            assert.equal(registry.get(Pid('p1'))?.timestamp, stamp1);
            assert.equal(registry.get(Pid('p2'))?.timestamp, stamp2);

        });

        test(`${/*++N*/'038'/**/} ProcessId — мутация результата не меняет внутреннее состояние`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());

            const set = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.ok(set);
            assert.equal(set.size, 2);

            const mutator = (set: Set<ProcessId>) => {
                set.clear();
            };

            // @ts-expect-error ts тут видит ro
            mutator(set);

            assert.equal(
                registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName)?.size,
                2
            );
        });


        test(`${/*++N*/'039'/**/} Stats — мутация результата не меняет внутреннее состояние`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());

            const stats = registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);

            assert.equal(stats?.total, 2);

            const mutator = (stats: Stats) => { stats.total = 100; };

            mutator(stats);

            assert.equal(
                registry.Stats.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName)?.total,
                2
            );
        });

        test(`${/*++N*/'040'/**/} ProcessId — forward isolation`, function () {

            registry.register(Identifier('t1').get(), Pid('p1'), monotonicStamp());
            const snap = registry.ProcessId.get(Identifier('t1').scopeKey)?.get(Identifier('t1').taskName);
            assert.equal(snap?.size, 1);

            registry.register(Identifier('t1').get(), Pid('p2'), monotonicStamp());
            assert.equal(snap?.size, 1); // snap — копия, не ссылка
        });


    });

});
