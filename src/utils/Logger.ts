import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static readonly maxLogSize = 1000; // 限制日志条目数
    private static logEntries: string[] = [];

    static info(message: string) {
        this.addLogEntry(`[INFO] ${message}`);
    }

    static error(error: Error | string) {
        const message = error instanceof Error ? error.message : error;
        this.addLogEntry(`[ERROR] ${message}`);
        if (error instanceof Error && error.stack) {
            this.addLogEntry(error.stack);
        }
        vscode.window.showErrorMessage(message);
    }

    private static addLogEntry(entry: string) {
        this.logEntries.push(entry);
        if (this.logEntries.length > this.maxLogSize) {
            this.logEntries.shift(); // 移除最旧的日志
        }
        this.outputChannel.appendLine(entry);
    }

    static clear() {
        this.logEntries = [];
        this.outputChannel.clear();
    }
}
