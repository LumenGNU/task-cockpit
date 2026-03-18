/** @file Cockpit/Runtime/Terminals.ts */
/** @module Terminals */

import * as vscode from 'vscode';
import type * as TC from '../types';
import helpers from '../helpers';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


interface ActiveRequest {
    timestamp: number;
    cancellation: vscode.CancellationTokenSource;
}


/** Резолвер PID открытых терминалов VS Code.
 *
 * Возвращает атомарный снимок (snapshot) PID всех терминалов.
 * Гарантирует целостность: либо все терминалы опрошены, либо запрос отменён.
 *
 * ## API
 *
 * ### Методы:
 * - `reconcile(timestamp)` — инициировать сбор PID, результат через событие
 * - `dispose()` — освободить ресурсы, отменить активные запросы
 *
 * ### События:
 * - `onReconciledTerminals` — snapshot готов
 *
 * ## Модель конкурентности
 *
 * Latest-wins с run-to-completion:
 * - Новый запрос вытесняет pending, но не прерывает активный
 * - Активный запрос всегда завершается полностью
 * - Гарантия: последний запрос будет выполнен
 *
 * ## Важно
 *
 * - Кэширование запрещено — каждый вызов опрашивает API заново
 * - Терминал не ответивший за timeout исключается из результата (не ошибка)
 * - Частичные результаты не возвращаются — только полный snapshot
 *
 * @see Terminals.md — детали реализации, обоснование решений */
export default class Terminals implements vscode.Disposable {

    private readonly timeout: number;

    private readonly reconciledEmitter: vscode.EventEmitter<TC.TerminalsSnapshot>;
    public readonly onDidReconcile: vscode.Event<TC.TerminalsSnapshot>;


    private activeExecution: ActiveRequest | undefined;
    private pending: number | undefined;

    private disposed: boolean;


    constructor(timeout: number = 1300) {
        this.disposed = false;
        this.timeout = timeout;

        this.reconciledEmitter = new vscode.EventEmitter<TC.TerminalsSnapshot>();
        this.onDidReconcile = this.reconciledEmitter.event;
    }


    private ensureNotDisposed(): void {
        if (this.disposed) {
            throw new Error('Monitor: use after dispose');
        }
    }

    public dispose(): void {
        this.disposed = true;
        this.reconciledEmitter.dispose();
        this.cancelActive();
        this.pending = undefined;

        // #region DEBUG
        log(LogLevel.Debug,
            'disposed');
        // #endregion DEBUG
    }


    // #region Public

    /** Инициировать сбор PID всех открытых терминалов.
     *
     * Опрашивает каждый терминал с индивидуальным таймаутом.
     * Терминалы не ответившие вовремя исключаются из результата.
     * Результат приходит через событие `onDidReconcile`.
     *
     * При вызове во время выполнения предыдущего запроса:
     * - Активный запрос продолжает выполняться до конца
     * - Pending запрос (если был) молча вытесняется
     * - Новый запрос становится pending и выполнится после активного
     *
     * @param timestamp — идентификатор запроса (возвращается в snapshot)
     *
     * @fire onDidReconcile */
    public reconcile(timestamp: number): void {

        this.ensureNotDisposed();

        // #region DEBUG
        const status = this.activeExecution
            ? (this.pending !== undefined ? `queued, supersedes ${this.pending}` : 'queued')
            : 'immediate';
        log(LogLevel.Debug, `Reconcile requested (${status})`, timestamp.toString());
        // #endregion DEBUG

        // заместить в очереди
        this.pending = timestamp;

        // попробовать запустить (если idle)
        if (this.activeExecution === undefined) {
            this.executeNext();
        }


    }

    // #endregion Public



    // #region Управление очередью

    // взять из очереди и запустить
    private async executeNext(): Promise<void> {

        if (this.pending === undefined) {
            return;
        }

        const execution = {
            timestamp: this.pending,
            cancellation: new vscode.CancellationTokenSource
        };

        this.activeExecution = execution;
        this.pending = undefined;

        // выполнить конкретный запрос

        // #region DEBUG
        log(LogLevel.Debug,
            'Executing request',
            execution.timestamp.toString());
        // #endregion DEBUG

        try {

            const result = await this.performReconciliation(execution.timestamp, execution.cancellation.token);
            this.reconciledEmitter.fire(result);

        } catch (error) {

            // #region DEBUG
            if (error instanceof Error && !(error instanceof vscode.CancellationError)) {
                log(LogLevel.Error,
                    `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
                    execution.timestamp.toString());
            }

            log(LogLevel.Debug,
                'Request has been canceled',
                execution.timestamp.toString());

            // #endregion DEBUG


        } finally {

            if (this.activeExecution) { // ← работает как disposed-guard
                //  очистка + запуск следующего
                execution.cancellation.dispose();
                this.activeExecution = undefined;

                // стек уже свободен после await — следующий вызов это отдельная микрозадача, не рекурсия
                this.executeNext();
            }

        }

    }


    // отменить текущий (для dispose)
    private cancelActive(): void {

        if (!this.activeExecution) {
            return;
        }

        this.activeExecution.cancellation.cancel();
        this.activeExecution.cancellation.dispose();
        this.activeExecution = undefined;
    }

    // #endregion Управление очередью


    // #region Резолвинг

    private async performReconciliation(
        timestamp: number,
        cancellationToken: vscode.CancellationToken
    ): Promise<TC.TerminalsSnapshot> {

        if (cancellationToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        const terminals = vscode.window.terminals;

        if (terminals.length === 0) {
            return { timestamp, processIds: new Set() };
        }

        // Запускаем опрос.
        const results = await Promise.all(
            terminals.map(t => this.getTerminalPid(t, cancellationToken))
        );

        if (cancellationToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        // #region DEBUG
        const responded = results.filter(p => p !== undefined).length;
        const failed = terminals.length - responded;
        log(LogLevel.Debug,
            `${responded}/${terminals.length} terminals responded` +
            (failed > 0 ? `, ${failed} timed out or closed` : ''),
            timestamp.toString());
        // #endregion DEBUG

        // Фильтруем закрытые/зависшие (undefined)
        return {
            timestamp,
            processIds: new Set(
                results.filter((pid): pid is TC.ProcessId => pid !== undefined)
            )
        };
    }

    // Считаю этот метод завершенным. не стоит его изменять без явной выгоды
    public async getTerminalPid(
        terminal: vscode.Terminal,
        cancellationToken?: vscode.CancellationToken
    ): Promise<TC.ProcessId | undefined> {

        if (this.disposed) {
            return;
        }

        if (cancellationToken && cancellationToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        let timeoutId: NodeJS.Timeout | undefined;
        let disposeListener: vscode.Disposable | undefined;
        let cancellationListener: vscode.Disposable | undefined;

        try {

            const racers: PromiseLike<TC.ProcessId | undefined>[] = [
                // Успешный исход
                terminal.processId.then(pid => helpers.isValidPid(pid) ? pid : undefined)
            ];

            racers.push(
                // Тайм-аут
                // Workaround для багов #91905 (2020) и #236869 (2024):
                // processId зависает, если есть проблемы с shellIntegration и т.д.
                new Promise<undefined>((resolve) => {
                    timeoutId = setTimeout(() => {

                        // // #region DEBUG
                        // logger?.(
                        //     vscode.LogLevel.Warning,
                        //     `Terminal "${terminal.name || '<unnamed>'}" PID resolution timed out`);
                        // // #endregion DEBUG

                        resolve(undefined);
                    }, this.timeout);
                }),
            );

            racers.push(
                // Закрытие терминала
                new Promise<undefined>((resolve) => {
                    disposeListener = vscode.window.onDidCloseTerminal(t => {
                        if (t === terminal) {
                            resolve(undefined);
                        };
                    });
                    if (terminal.exitStatus) {
                        resolve(undefined);
                    }
                }),
            );

            if (cancellationToken) {
                racers.push(
                    new Promise<never>((_, reject) => {
                        cancellationListener = cancellationToken.onCancellationRequested(() => reject(new vscode.CancellationError()));
                        if (cancellationToken.isCancellationRequested) {
                            reject(new vscode.CancellationError());
                        }
                    })
                );
            }

            return await Promise.race(racers);

        } finally {
            // очистка
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            if (disposeListener) {
                disposeListener.dispose();
            }
            if (cancellationListener) {
                cancellationListener.dispose();
            }
        }
    }

    // #endregion

}
