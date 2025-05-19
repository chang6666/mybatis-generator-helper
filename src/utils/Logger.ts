import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    // 减少日志条目限制
    private static readonly maxLogSize = 50;
    // 使用循环缓冲区来存储日志
    private static logBuffer: string[] = [];
    private static currentIndex = 0;

    // Logger.ts
    private static logQueue: string[] = [];
    private static flushTimeout: NodeJS.Timeout | null = null;

    private static addLogEntry(entry: string) {
        this.logQueue.push(entry);

        if (!this.flushTimeout) {
            this.flushTimeout = setTimeout(() => {
                this.outputChannel.append(this.logQueue.join('\n') + '\n');
                this.logQueue = [];
                this.flushTimeout = null;
            }, 100); // 批量写入
        }
    }

    static {
        this.outputChannel = vscode.window.createOutputChannel('MyBatis Generator');
    }

    static info(message: string) {
        this.addLogEntry(`[INFO] ${message}`);
    }

    static error(error: Error | string) {
        const message = error instanceof Error ? error.message : error;
        this.addLogEntry(`[ERROR] ${message}`);
        if (error instanceof Error && error.stack) {
            // 只保存堆栈的前几行，避免过多内存使用
            const stackLines = error.stack.split('\n').slice(0, 2).join('\n');
            this.addLogEntry(stackLines);
        }
    }

    static clear() {
        this.logBuffer = [];
        this.currentIndex = 0;
        this.outputChannel.clear();
    }

    static dispose() {
        this.outputChannel.dispose();
        this.logBuffer = [];
    }
}
