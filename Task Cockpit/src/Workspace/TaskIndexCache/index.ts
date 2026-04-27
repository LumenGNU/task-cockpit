import * as vscode from 'vscode';
import RevocablePromise from '../../utils/RevocablePromise';
import TaskIndex from './TaskIndex';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, table } = Logger.get(module.filename);
// #endregion DEBUG


/** Кеш снапшота TaskIndex. Единственный поставщик EligibleTask.
 *
 * Кеширует результат {@linkcode TaskIndex.fetch} между вызовами `get()`.
 *
 * Кеш постепенно **протухает по бездействию**:
 * если к нему не обращаются в течение idle-TTL, он освобождается и при
 * следующем запросе будет вычислен заново. Каждое обращение к действующему
 * состоянию перезапускает отсчёт.
 *
 * Мотивация: {@linkcode TaskIndex.fetch} отфильтрованный набор
 * `vscode.Task`-объектов, собранных на момент вычисления. Сам VS Code их
 * постоянно не кэширует — фетчит через `vscode.tasks.fetchTasks` по запросу.
 * Расширение может простаивать длительное время между запусками задач;
 * idle-TTL нужен, чтобы в такие периоды выборка не удерживалась в памяти
 * без пользы.
 *
 *  - Владеет текущим состоянием (`RevocablePromise<Index>`).
 *  - Состояние вычисляется лениво (первый `get()`) или по внешнему
 *    сигналу (`update()`).
 *  - Fulfilled-состояние протухает по бездействию (`IDLE_TTL_MS`,
 *    refresh-on-access).
 *  - Rejected-состояние ≡ отменённое вычисление; живёт до следующего
 *    `update()`, по бездействию не протухает.
 *
 * {@linkcode TaskIndex.fetch} — Чистая функция от текущего состояния VS Code:
 * На любой невалидный или нечитаемый ввод (битый `tasks.json`, отсутствие
 * ожидаемых полей и т.п.) возвращает штатный результат с редуцированным
 * содержимым — вплоть до пустого. Исключения не бросает (см. контракт
 * {@linkcode RevocablePromise.runCancellable} и границы ответственности: чинить источник
 * не её ответственность. */
class TaskIndexCache implements vscode.Disposable {

    private rPromise: RevocablePromise<Readonly<TaskIndex>> | null = null;
    private idleTimer: NodeJS.Timeout | null = null;
    private disposed = false;

    private readonly idleTtlMs: number;

    constructor(idleTtlMs: number) {
        if (!Number.isFinite(idleTtlMs) || idleTtlMs < 1000) {
            throw new RangeError(`idleTtlMs must be finite and >= 1000, got ${idleTtlMs}`);
        }
        this.idleTtlMs = idleTtlMs;
    }


    /** Освобождает ресурсы: гасит таймер, отменяет текущее вычисление.
     *
     *  Повторный вызов — no-op (идемпотентно). */
    public dispose(): void {

        this.disposed = true;


        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        this.rPromise?.revoke();
        this.rPromise = null;
    }

    /** Инвалидирует кеш. Вызывается от событий workspace,
     *  когда текущий снапшот заведомо устарел.
     *
     *  После `dispose()` — no-op (идемпотентно). */
    public update() {

        if (this.disposed) {
            return;
        }

        this.reScan();
    }


    /** Возвращает актуальный снапшот TaskIndex.
     *
     *  Ждёт валидного (fulfilled) состояния. Если текущее вычисление было
     *  отменено (rejected ≡ CancellationError) — автоматически повторяет
     *  попытку, подвешиваясь на новый `reScan()`.
     *
     *  Метод не отменяется извне: ожидание ограничено только сроком жизни
     *  самого {@linkcode TaskIndexCache}. Количество итераций цикла равно
     *  числу событий {@linkcode update}, прилетевших подряд во время
     *  ожидания; каждая итерация ждёт новый `TaskIndex.fetch()` — busy-loop
     *  исключён.
     *
     *  @affects Получение валидного состояния продлевает его TTL через
     *  {@linkcode scheduleIdleEviction} (refresh-on-access).
     *
     * Если к моменту возврата кеш {@linkcode dispose | освобождён} —
     * возвращает пустой индекс. Покрывает два случая:
     * - `dispose()` пришёл во время ожидания (вызов был начат на живом кеше);
     * - вызов был сделан по уже освобождённому кешу (ошибка вызывающего,
     *   но здесь не отличаемая от первого случая).
     *
     *  @returns снапшот TaskIndex. */
    public async get(): Promise<TaskIndex> {

        while (!this.disposed) {
            const promise = this.rPromise?.promise ?? this.reScan();
            try {
                const result = await promise;
                this.scheduleIdleEviction(promise);
                return result;
            }
            catch (error) {
                // rejected ≡ CancellationError по контракту runCancellable:
                // revoke() был вызван либо из reScan() (тогда this.rPromise
                // уже указывает на новый промис — следующая итерация возьмёт
                // его), либо из dispose() (тогда цикл завершится по disposed).

                // Если сюда прилетел не CancellationError — это нарушение
                // контракта runCancellable, не наша зона ответственности — роняем.

                if (!(error instanceof vscode.CancellationError)) {
                    // #region DEBUG
                    log(LogLevel.Error, `runCancellable contract violation — expected CancellationError, got ${error?.constructor?.name ?? typeof error}`, 'TaskIndexCache.get');
                    // #endregion DEBUG
                    throw error;
                }

                continue;
            }
        }

        // Кеш освобождён: либо dispose() пришёл во время await
        // (легитимный race), либо вызов сделан по уже мёртвому кешу.
        // Для вызывающего оба случая эквивалентны — данных больше не будет.
        return Object.create(null);
    }


    /** Взводит (или перезапускает) idle-таймер текущего состояния.
     *
     *  `owner` — тот экземпляр `rPromise.promise`, с которым имеет дело
     *  вызывающий. Если на момент вызова `this.rPromise` уже указывает
     *  на другой промис — метод выходит без эффекта: таймер чужого
     *  состояния не трогаем. */
    private scheduleIdleEviction(owner: Promise<Readonly<TaskIndex>>): void {

        // не трогаем чужое состояние
        if (this.rPromise?.promise !== owner) {
            return; // состояние успели заменить
        }

        // перезапуск таймера
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        this.idleTimer = setTimeout(() => {
            // если таймер истёк...
            this.idleTimer = null;
            if (this.rPromise?.promise === owner) {
                this.rPromise = null; // ...состояние "протухло"
            }
        }, this.idleTtlMs);
    }


    /** Сбрасывает текущее состояние и запускает новое вычисление.
     *
     *  Не проверяет `disposed` — это ответственность вызывающего
     *  (`update()` проверяет сам, `get()` — через условие цикла). */
    private reScan(): Promise<Readonly<TaskIndex>> {

        // таймер привязан к текущему revocablePromise
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        if (this.rPromise) {
            this.rPromise.revoke();
            this.rPromise = null;
        }


        const { promise }
            = this.rPromise
            = RevocablePromise.runCancellable(TaskIndex.fetch);

        promise.then(
            () => this.scheduleIdleEviction(promise), // первичный взвод на случай, если никто не ждал
            () => {
                // rejected ≡ CancellationError по контракту runCancellable.
                // Rejected-состояние не протухает по бездействию: единственный
                // способ выйти из него — update() от внешнего события.
                // Само оно не починится, таймер не взводим.
            }
        );

        return promise;
    }

}

export default TaskIndexCache;

export * as TaskIndex from './TaskIndex';
