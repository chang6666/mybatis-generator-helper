import * as vscode from 'vscode';

/**
 * 数据库配置
 */
export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export class DatabaseConfigManager {
    static async promptConfig(): Promise<DatabaseConfig | undefined> {
        const host = await vscode.window.showInputBox({
            prompt: 'Enter MySQL host',
            value: 'localhost'
        });
        if (!host) return undefined;

        const port = await vscode.window.showInputBox({
            prompt: 'Enter MySQL port',
            value: '3306'
        });
        if (!port) return undefined;

        const user = await vscode.window.showInputBox({
            prompt: 'Enter MySQL username',
            value: 'root'
        });
        if (!user) return undefined;

        const password = await vscode.window.showInputBox({
            prompt: 'Enter MySQL password',
            password: true
        });
        if (!password) return undefined;

        const database = await vscode.window.showInputBox({
            prompt: 'Enter database name'
        });
        if (!database) return undefined;

        return {
            host,
            port: parseInt(port),
            user,
            password,
            database
        };
    }
}