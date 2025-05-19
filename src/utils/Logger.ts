import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    static {
        // 创建输出通道但不使用它
        this.outputChannel = vscode.window.createOutputChannel('MyBatis Generator');
    }

    // 空方法，不执行任何操作
    static info(message: string) {
        // 不记录任何信息
    }

    static error(error: Error | string) {
        // 不记录任何错误
    }

    static clear() {
        // 清空输出通道
        this.outputChannel.clear();
    }

    static dispose() {
        // 释放输出通道资源
        this.outputChannel.dispose();
    }
}
