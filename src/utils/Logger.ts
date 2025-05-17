import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    // 减少日志条目限制
    private static readonly maxLogSize = 50;
    // 使用循环缓冲区来存储日志
    private static logBuffer: string[] = [];
    private static currentIndex = 0;

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

    private static addLogEntry(entry: string) {
        // 使用循环缓冲区
        this.logBuffer[this.currentIndex] = entry;
        this.currentIndex = (this.currentIndex + 1) % this.maxLogSize;
        this.outputChannel.appendLine(entry);

        // 当日志量较大时，清理输出通道
        if (this.currentIndex % 25 === 0) {
            this.outputChannel.clear();
            // 只显示最近的日志
            const recentLogs = [];
            for (let i = 0; i < this.maxLogSize; i++) {
                const idx = (this.currentIndex + i) % this.maxLogSize;
                if (this.logBuffer[idx]) {
                    recentLogs.push(this.logBuffer[idx]);
                }
            }
            recentLogs.forEach(line => {
                if (line) this.outputChannel.appendLine(line);
            });
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
