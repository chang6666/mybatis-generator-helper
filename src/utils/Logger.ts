import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    static init(context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('MyBatis Generator');
        context.subscriptions.push(this.outputChannel);
    }

    static info(message: string) {
        this.outputChannel.appendLine(`[INFO] ${message}`);
    }

    static error(error: Error | string) {
        const message = error instanceof Error ? error.message : error;
        this.outputChannel.appendLine(`[ERROR] ${message}`);
        if (error instanceof Error && error.stack) {
            this.outputChannel.appendLine(error.stack);
        }
        vscode.window.showErrorMessage(message);
    }
}
