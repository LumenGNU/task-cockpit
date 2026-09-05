import { LogLevel, window, type LogOutputChannel as VscLogOutputChannel, type Event } from 'vscode';

interface LogOutputChannel {
    readonly name: string;
    readonly append: (value: string) => void;
    readonly appendLine: (value: string) => void;
    readonly replace: (value: string) => void;
    readonly clear: () => void;
    readonly show: (preserveFocus?: boolean | undefined) => void;
    readonly hide: () => void;
    readonly dispose: () => void;
    readonly logLevel: LogLevel;
    readonly onDidChangeLogLevel: Event<LogLevel> | null;
    readonly trace: (message: string, ...args: any[]) => void;
    readonly debug: (message: string, ...args: any[]) => void;
    readonly info: (message: string, ...args: any[]) => void;
    readonly warn: (message: string, ...args: any[]) => void;
    readonly error: (error: string | Error, ...args: any[]) => void;
}

function createLogger(channelName: string) {

    let channel: VscLogOutputChannel | null = window.createOutputChannel(channelName, { log: true });

    return {
        get name(): string { return channel?.name ?? '«closed channel»'; },
        append(value: string): void { channel?.append(value); },
        appendLine(value: string): void { channel?.appendLine(value); },
        replace(value: string): void { channel?.replace(value); },
        clear(): void { channel?.clear(); },
        show(preserveFocus?: boolean): void { channel?.show(preserveFocus); },
        hide(): void { channel?.hide(); },
        dispose(): void { channel?.dispose(); channel = null; },
        get logLevel(): LogLevel { return channel?.logLevel ?? LogLevel.Off; },
        get onDidChangeLogLevel(): Event<LogLevel> | null { return channel?.onDidChangeLogLevel ?? null; },
        trace(message: string, ...args: any[]): void { channel?.trace(message, ...args); },
        debug(message: string, ...args: any[]): void { channel?.debug(message, ...args); },
        info(message: string, ...args: any[]): void { channel?.info(message, ...args); },
        warn(message: string, ...args: any[]): void { channel?.warn(message, ...args); },
        error(error: string | Error, ...args: any[]): void { channel?.error(error, ...args); }
    } as const;
}

const LogOutputChannel = {
    createLogger
};

export default LogOutputChannel;
