// @ts-check
'use strict';

// custom fixtures reporter for vscode test cli

const Mocha = require('mocha');
const { default: path } = require('node:path');
const { default: fs } = require('node:fs');
const Chalk = new (require('chalk').Instance)({ level: 3 });

const REPORT_DIR = process.env.REPORT_DIR || false;

if (REPORT_DIR) {

    // скриптам позволено изменять только файлы|директории с префиксом "~" в имени
    // и не позволено создавать
    if (!path.basename(REPORT_DIR).startsWith('~')) {
        console.error(Chalk.red('[Error]: ??????????????????????????'));
        process.exit(1);
    }

    // проверяется|очищается
    try {
        if (!fs.statSync(REPORT_DIR).isDirectory) {
            console.error(Chalk.red('[Error]: ??????????????????????????'));
            process.exit(1);
        }
        fs.rmSync(REPORT_DIR, { recursive: true, force: true });
        // @todo сообщить в консоль что очистили
    }
    catch (error) {
        console.error(Chalk.red(`[Error]: Failed to initialize report directory "${REPORT_DIR}": ${/** @type {Error} */(error).message}`));
        process.exit(1);
    }
}


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const {
    EVENT_RUN_BEGIN,
    EVENT_SUITE_BEGIN,
    EVENT_TEST_BEGIN,
    EVENT_TEST_FAIL,
    EVENT_TEST_PENDING,
    EVENT_TEST_END,
    EVENT_SUITE_END,
    EVENT_RUN_END,
} = Mocha.Runner.constants;


const MARKER = {
    pass: '✓',
    fail: '✕',
    hook: '●',
    pending: '–',
    blocked: '○'
};
// другие:
// ◉ ○ ⊛ ⊚ ◆ ◇ ⊘ ⭘ ✔ ✘
// блок Geometric Shapes 
// ✓  U+2713  passed
// ✕  U+2715  failed
// ●  U+25CF  ghost
// –  U+2013  pending
// ○  U+25CB  blocked

const WIDTH = 120;
const HR = '~';


// ---------------------------------------------------------------------------
// Model
// --
// Узлы (POJO):
// Глубина — не в узле, Walker передаёт depth в visit*. Узлы — чистые данные.
/** @typedef {{ type: 'body',  children: (SuiteNode|TestNode)[], stats: Mocha.Stats }} BodyNode */
/** @typedef {{ type: 'suite', title: string, pending: boolean, children: (SuiteNode|TestNode)[] }} SuiteNode */
/** @typedef {{ type: 'test',  title: string, isGhost?: boolean; state: 'passed'|'failed'|'pending'|'blocked', traces: TraceNode[] }} TestNode */
/** 
 * @typedef {{ 
 *     type: 'trace'|'cause',
 *     file: string | undefined,
 *     error: unknown, 
 *     children: TraceNode[] 
 * }} TraceNode 
 * */


// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
/**
 * @typedef {{
 *   begin(node: BodyNode, output: IOutput): void,
 *   end(node: BodyNode, output: IOutput): void,
 *   visitSuite(node: SuiteNode, depth: number, output: IOutput): void,
 *   visitTest(node: TestNode, depth: number, output: IOutput): void,
 *   visitTrace(node: TraceNode, depth: number, output: IOutput): void,
 * }} IRenderer
 */


// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * @typedef {{ write(str?: string): void }} IOutput
 */

class ConsoleOutput {
    /** @param {string} [str] */
    write(str = '') { console.log(str); }
}

class BufferedOutput {
    /** @type {string[]} */
    #lines = [];

    /** @param {string} [str] */
    write(str = '') { this.#lines.push(str ?? ''); }

    /** @returns {readonly string[]} */
    get lines() { return this.#lines; }
}



// Walker — статический, управляет обходом:
// Walker.walk(fileNode, renderer)
//   → renderer.begin(file)
//   → рекурсия children (suite → visitSuite + дети; test → visitTest + traces если failed)
//   → renderer.end(file)
// visitTrace рекурсивно по trace.children — future-proof для вложенных cause.



class AnsiRenderer {

    /**
     * @param {BodyNode} node
     * @param {IOutput} output
     */
    begin(node, output) {
        const fmt = new Intl.DateTimeFormat(undefined, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        output.write();
        output.write(Chalk.bold(`[TEST] Start: ${fmt.format(node.stats.start)}`));
        output.write(HR.repeat(WIDTH));
        output.write();
    }

    /**
     * @param {BodyNode} node
     * @param {IOutput} output
     */
    end(node, output) {
        const { total, passed, failed, pending, blocked, hasHookErrors } = collectStats(node);

        const fPassed = passed > 0 ? Chalk.bold.green(String(passed)) : Chalk.bold.red('0');
        const fFailed = failed > 0 ? Chalk.bold.red(String(failed)) : Chalk.bold.green('0');
        const fPending = pending > 0 ? Chalk.bold.cyan(String(pending)) : '0';
        // blocked показываем даже ноль (декоративно), если были проблемные хуки
        // @todo тут нужна более продуманная логика
        // @fixme сейчас это баг и бред
        const fBlocked = hasHookErrors ? `blocked: ${Chalk.bold.red(`${String(blocked || '*')} with hook error(s)`)}` : '';

        output.write();
        output.write(HR.repeat(WIDTH));
        output.write(Chalk.bold(`[TEST] End: ${node.stats.duration} ms`));
        output.write(`${Chalk.bold('[Summary]')}  total: ${Chalk.bold(String(total))}  passed: ${fPassed}  failed: ${fFailed}  pending: ${fPending}  ${fBlocked}`);
        output.write();
    }

    /**
     * @param {SuiteNode} node
     * @param {number} depth
     * @param {IOutput} output
     */
    visitSuite(node, depth, output) {
        const indent = '    '.repeat(depth);
        const lines = node.title.split('\n');
        const first = lines.shift() ?? '';
        const prefix = node.pending ? `${MARKER.pending} ` : '';
        const style = node.pending
            ? (/** @type {string} */ s) => Chalk.bold.dim(s)
            : (/** @type {string} */ s) => Chalk.bold(s);

        output.write(`${indent}${style(`${prefix}${first}`)}`);
        for (const line of lines) output.write(`${indent}${style(`  ${line}`)}`);
    }

    /**
     * @param {TestNode} node
     * @param {number} depth
     * @param {IOutput} output
     */
    visitTest(node, depth, output) {
        const indent = '    '.repeat(depth);
        const lines = node.title.split('\n');
        const first = lines.shift() ?? '';

        let prefix = '';
        let style = /** @type {(s: string) => string} */ (s => s);

        switch (node.state) {
            case 'passed': prefix = `${MARKER.pass} `; break;
            case 'failed': {
                prefix = node.isGhost ? `${MARKER.hook} ` : `${MARKER.fail} `;
                style = s => Chalk.red(s);
                break;
            }
            case 'pending': prefix = `${MARKER.pending} `; style = s => Chalk.dim(s); break;
            case 'blocked': prefix = `${MARKER.blocked} `; style = s => Chalk.dim(s); break;
            default:
                const /** @type never */_ = node.state;
        }

        output.write(`${indent}${style(`${prefix}${first}`)}`);
        for (const line of lines) output.write(`${indent}${style(`  ${line}`)}`);
    }

    /**
     * @param {TraceNode} node
     * @param {number} depth
     * @param {IOutput} output
     */
    visitTrace(node, depth, output) {
        const indent = '    '.repeat(depth);
        for (const line of this.#errorToLines(node.error)) {
            output.write(Chalk.dim.red(`${indent}${line}`));
        }
        output.write(` `); // пустая строка после стек-трейса
    }

    /**
     * @param {unknown} error
     * @returns {string[]}
     */
    #errorToLines(error) {
        if (error instanceof Error) return (error.stack ?? error.message).split('\n');
        try {
            const json = JSON.stringify(error, null, 2);
            return (json ?? String(error)).split('\n');
        } catch {
            return [String(error)];
        }
    }

}

// ---------------------------------------------------------------------------
// Walker
// ---------------------------------------------------------------------------

class Walker {

    /**
     * @param {BodyNode} file
     * @param {IRenderer} renderer
     * @param {IOutput} output
     */
    static walk(file, renderer, output) {
        renderer.begin(file, output);
        for (const child of file.children) Walker.#walkNode(child, renderer, output, 1);
        renderer.end(file, output);
    }

    /**
     * @param {SuiteNode | TestNode} node
     * @param {IRenderer} renderer
     * @param {IOutput} output
     * @param {number} depth
     */
    static #walkNode(node, renderer, output, depth) {
        if (node.type === 'suite') {
            renderer.visitSuite(node, depth, output);
            for (const child of node.children) Walker.#walkNode(child, renderer, output, depth + 1);
        } else {
            renderer.visitTest(node, depth, output);
            if (node.state === 'failed') {
                for (const trace of node.traces) Walker.#walkTrace(trace, renderer, output, depth + 1);
            }
        }
    }

    /**
     * @param {TraceNode} trace
     * @param {IRenderer} renderer
     * @param {IOutput} output
     * @param {number} depth
     */
    static #walkTrace(trace, renderer, output, depth) {
        renderer.visitTrace(trace, depth, output);
        for (const child of trace.children) Walker.#walkTrace(child, renderer, output, depth + 1);
    }
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * Принимает события от `MochaAdapter` и строит дерево `FileNode`.
 *
 * Инварианты:
 * - `#stack[0]` всегда `FileNode` пока run открыт.
 * - top стека соответствует текущему открытому узлу.
 * - ghost-тест (before/after hook failure) создаётся и закрывается в `onTestFail`,
 *   в стек не попадает.
 */
class ReporterController {

    /** @type {BodyNode | null} */
    #body = null;

    /** @type {(BodyNode | SuiteNode | TestNode)[]} */
    #stack = [];

    /** Открывает run. Повторный вызов без закрытия — abort. */
    onRunBegin() {

        // console.log(`onRunBegin`);

        if (this.#body !== null) abort('onRunBegin — run already open');
        // при создании — cast; к моменту возврата из onRunEnd поле всегда заполнено, 
        // контракт публичного FileNode не нарушен.
        this.#body = { type: 'body', children: [], stats: /** @type {any} */ (null) };
        this.#stack = [this.#body];
    }

    /**
     * 
     * @param {Mocha.Suite} suite — root suite игнорируется.
    */
    onSuiteBegin(suite) {

        // console.log(`onSuiteBegin: suite: ${suite.title}, pending: ${suite.pending}`);

        if (suite.root) return;
        const current = this.#peek('onSuiteBegin', ['body', 'suite']);
        /** @type {SuiteNode} */
        const node = { type: 'suite', title: suite.title, pending: suite.pending, children: [] };
        current.children.push(node);
        this.#stack.push(node);
    }

    /** 
     * Вызывается для `type === 'hook'` тоже (Mocha особенность).
     * @param {Mocha.Test | Mocha.Hook} testOrHook 
     * */
    onTestBegin(testOrHook) {

        // console.log(`onTestBegin: runner: ${testOrHook.title}, type: ${testOrHook.type}, state: ${testOrHook.state ?? '<no-state>'}`);

        const current = this.#peek('onTestBegin', ['body', 'suite']);
        /** @type {TestNode} */
        const node = { type: 'test', title: testOrHook.title, state: /** @type {any} */ (null), traces: [] };
        current.children.push(node);
        this.#stack.push(node);
    }

    /** 
     * Два сценария:
     * - `this.skip()` внутри тела → top уже `TestNode`, ничего не делаем.
     * - `it.skip` / `xit` → `TEST_BEGIN` не было, открываем `TestNode` сразу с `state='pending'`.
     * @param {Mocha.Test | Mocha.Hook} testOrHook
     * */
    onTestPending(testOrHook) {

        // console.log(`onTestPending: runner: ${testOrHook.title}, type: ${testOrHook.type}, state: ${testOrHook.state ?? '<no-state>'}`);

        const top = this.#stack[this.#stack.length - 1];
        if (top?.type === 'test') return; // this.skip() — блок уже открыт EVENT_TEST_BEGIN

        // it.skip / xit — EVENT_TEST_BEGIN не было
        const current = this.#peek('onTestPending', ['body', 'suite']);
        /** @type {TestNode} */
        const node = { type: 'test', title: testOrHook.title, state: 'pending', traces: [] };
        current.children.push(node);
        this.#stack.push(node);
    }

    /**
     * Три сценария:
     * - `type === 'test'` → прикрепляем трейс к открытому `TestNode`.
     * - hook + top `TestNode` (beforeEach/afterEach) → трейс + state='failed' + закрываем.
     * - hook + top не `TestNode` (before/after suite) → синтезируем ghost-тест, в стек не кладём.
     * @param {Mocha.Test | Mocha.Hook} testOrHook
     * @param {unknown} err
     */
    onTestFail(testOrHook, err) {

        // console.log(`onTestFail: runner: ${testOrHook.title}, type: ${testOrHook.type}, state: ${testOrHook.state ?? '<no-state>'}`);

        const top = this.#stack[this.#stack.length - 1];

        if (testOrHook.type === 'test') {
            if (top?.type !== 'test') abort(`onTestFail — expected test on stack, got ${top?.type}`);
            top.traces.push(this.#buildTrace(err, testOrHook.file));
            return;
        }

        if (top?.type === 'test') {
            // beforeEach упал — тест не запускался, закрываем его как pending.
            // Ghost хука добавляем следом в тот же родительский узел.
            top.state = 'blocked';
            this.#stack.pop();
            this.#createGhost(testOrHook, err, this.#peek('onTestFail(beforeEach)', ['body', 'suite']));
            return;
        }

        // before/after suite — TestNode на стеке не было.
        this.#createGhost(testOrHook, err, this.#peek('onTestFail(hook)', ['body', 'suite']));

    }

    /** 
     * Закрывает `TestNode`. Если `state` уже выставлен (beforeEach закрыл раньше) — не перезаписывает.
     * Для `type === 'hook'` и пустого стека — no-op (ghost уже закрыт).
     * @param {Mocha.Test | Mocha.Hook} testOrHook
     * */
    onTestEnd(testOrHook) {

        // console.log(`onTestEnd: runner: ${testOrHook.title}, type: ${testOrHook.type}, state: ${testOrHook.state ?? '<no-state>'}`);

        const top = this.#stack[this.#stack.length - 1];

        if (top?.type !== 'test') {
            // EVENT_TEST_END для хука — TestNode уже закрыт в onTestFail.
            if (testOrHook.type === 'hook') return;
            abort(`onTestEnd — expected test on stack, got ${top?.type} (title: "${testOrHook.title}")`);
        }

        if (testOrHook.type === 'test' && top.title !== testOrHook.title) {
            abort(`onTestEnd — title mismatch: expected "${top.title}", got "${testOrHook.title}"`);
        }

        if (top.state === null) {
            // ветка: beforeEach-hook уже выставил 'failed' и сошёл со стека раньше, 
            // поэтому сюда попасть с ненулевым state просто некуда.
            const state =
                testOrHook.pending ? 'pending' :
                    testOrHook.state === 'passed' ? 'passed' :
                        testOrHook.state === 'failed' ? 'failed' : null;

            if (state === null) {
                abort(`onTestEnd — unresolved state (pending=${testOrHook.pending}, state=${testOrHook.state}, title="${testOrHook.title}")`);
            }

            top.state = state;
        }

        this.#stack.pop();
    }

    /** @param {Mocha.Suite} suite */
    onSuiteEnd(suite) {

        // console.log(`onSuiteEnd: suite: ${suite.title}`);

        if (suite.root) return;
        const top = this.#stack[this.#stack.length - 1];
        if (top?.type !== 'suite') abort(`onSuiteEnd — expected suite on stack, got ${top?.type}`);
        this.#stack.pop();
    }

    /**
     * Финализирует `FileNode`, сбрасывает состояние.
     * @param {Mocha.Stats} stats
     * @returns {BodyNode} готовый к рендерингу граф
     */
    onRunEnd(stats) {

        // console.log(`onRunEnd`);

        if (this.#body === null) abort('onRunEnd — file is null');

        if (this.#stack.length !== 1 || this.#stack[0] !== this.#body) {
            abort(`onRunEnd — stack not clean (length=${this.#stack.length}, top=${this.#stack[this.#stack.length - 1]?.type})`);
        }

        this.#body.stats = stats;
        const body = this.#body;
        this.#body = null;
        this.#stack = [];
        return body;
    }

    /**
     * Синтезирует failed TestNode для хука без собственного узла в дереве.
     * Используется когда хук падает вне контекста конкретного теста (before/after suite)
     * или до его запуска (beforeEach).
     * @param {Mocha.Test | Mocha.Hook} hook
     * @param {unknown} err
     * @param {BodyNode | SuiteNode} parent
     */
    #createGhost(hook, err, parent) {
        /** @type {TestNode} */
        const ghost = { type: 'test', title: hook.title, isGhost: true, state: 'failed', traces: [this.#buildTrace(err, hook.file)] };
        parent.children.push(ghost);
    }

    /**
     * @param {string} ctx
     * @param {ReadonlyArray<'body'|'suite'|'test'>} allowed
     * @returns {BodyNode | SuiteNode}
     */
    #peek(ctx, allowed) {
        const top = this.#stack[this.#stack.length - 1];
        if (top == null) abort(`${ctx} — stack is empty`);
        if (!allowed.includes(/** @type {any} */(top.type))) abort(`${ctx} — unexpected top: ${top.type}`);
        return /** @type {BodyNode | SuiteNode} */ (top);
    }

    /**
     * @param {unknown} error
     * @param {string | undefined} file
     * @param {'trace'|'cause'} type
     * @returns {TraceNode}
     */
    #buildTrace(error, file, type = 'trace') {
        /** @type {TraceNode} */
        const node = { type, file, error, children: [] };
        if (error instanceof Error && error.cause != null) node.children.push(this.#buildTrace(error.cause, file, 'cause'));
        return node;
    }

}

// ---------------------------------------------------------------------------
// MochaAdapter
// ---------------------------------------------------------------------------
/**
 * Подписывается на события `Mocha.Runner` и транслирует их в вызовы `ReporterController`.
 * Все обработчики обёрнуты в try/catch → `abort` чтобы исключения не ломали Mocha.
 * Рендеринг запускается в `EVENT_RUN_END` после `controller.onRunEnd`.
 */
class MochaAdapter {

    /**
     * @param {Mocha.Runner} runner
     * @param {ReporterController} controller
     * @param { { renderer:IRenderer; output: IOutput }[] } renderers
     */
    constructor(runner, controller, renderers) {

        if (renderers.length < 1) {
            abort('MochaAdapter — No renderers are specified');
        }

        /** @param {string} event @param {Function} fn */
        const on = (event, fn) => {
            runner.on(event, (...args) => {
                try { fn(...args); }
                catch (e) {
                    abort(`Unhandled exception in ${event}: ${e instanceof Error ? e.stack : String(e)}`);
                }
            });
        };

        on(EVENT_RUN_BEGIN, () => controller.onRunBegin());
        on(EVENT_SUITE_BEGIN, (/** @type {Mocha.Suite} */ s) => controller.onSuiteBegin(s));
        on(EVENT_TEST_BEGIN, (/** @type {Mocha.Test | Mocha.Hook} */ t) => controller.onTestBegin(t));
        on(EVENT_TEST_PENDING, (/** @type {Mocha.Test | Mocha.Hook} */ t) => controller.onTestPending(t));
        on(EVENT_TEST_FAIL, (/** @type {Mocha.Test | Mocha.Hook} */ t, /** @type {unknown} */ e) => controller.onTestFail(t, e));
        on(EVENT_TEST_END, (/** @type {Mocha.Test | Mocha.Hook} */ t) => controller.onTestEnd(t));
        on(EVENT_SUITE_END, (/** @type {Mocha.Suite} */ s) => controller.onSuiteEnd(s));
        on(EVENT_RUN_END, () => {
            const stats = runner.stats;
            if (stats == null) abort('EVENT_RUN_END — stats is null');

            renderers.forEach(
                /** @this {BodyNode} */
                function ({ renderer, output }) {
                    Walker.walk(this, renderer, output);
                }, controller.onRunEnd(stats)
            );
        });
    }
}

// ---------------------------------------------------------------------------
// AnsiReporter  (точка входа — только сборка)
// ---------------------------------------------------------------------------

class AnsiReporter extends Mocha.reporters.Base {

    /**
     * @param {Mocha.Runner} runner
     * @param {Mocha.MochaOptions} options
     */
    constructor(runner, options) {
        super(runner, options);
        new MochaAdapter(
            runner,
            new ReporterController(),
            [
                { renderer: new AnsiRenderer(), output: new ConsoleOutput() },
                // @todo
                ...(REPORT_DIR ? [] : [])
            ]
        );
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @typedef {{ total: number, passed: number, failed: number, pending: number, blocked: number, hasHookErrors: boolean }} ReportStats
 */

/**
 * @param {BodyNode} file
 * @returns {ReportStats}
 */
function collectStats(file) {
    const stats = { total: 0, passed: 0, failed: 0, pending: 0, blocked: 0, hasHookErrors: false };
    for (const child of file.children) collectStatsNode(child, stats);
    return stats;
}

/**
 * @param {SuiteNode | TestNode} node
 * @param {ReportStats} stats
 */
function collectStatsNode(node, stats) {

    if (node.type === 'suite') {
        for (const child of node.children) collectStatsNode(child, stats);
        return;
    }

    if (node.isGhost) {
        stats.hasHookErrors = true;
        return;
    }

    stats.total++;
    stats[node.state]++;
    if (node.state === 'failed') stats.hasHookErrors = true;

}

/**
 * @param {string} msg
 * @returns {never}
 */
function abort(msg) {
    console.error(Chalk.red(`[Reporter] Internal error: ${msg}`));
    process.exit(172);
}

module.exports = AnsiReporter;