import * as vscode from 'vscode';
import { DatabaseConfig } from '../config/DatabaseConfig';

export class DatabaseConfigPanel {
    public static currentPanel: DatabaseConfigPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _resolveCallback: ((value: DatabaseConfig | undefined) => void) | undefined;

    private constructor(panel: vscode.WebviewPanel, resolve: (value: DatabaseConfig | undefined) => void) {
        this._panel = panel;
        this._resolveCallback = resolve;
        this._panel.webview.html = this._getHtmlContent();
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static createOrShow(): Promise<DatabaseConfig | undefined> {
        return new Promise((resolve) => {
            const columnToShowIn = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn
                : undefined;

            if (DatabaseConfigPanel.currentPanel) {
                DatabaseConfigPanel.currentPanel._panel.reveal(columnToShowIn);
            } else {
                const panel = vscode.window.createWebviewPanel(
                    'databaseConfig',
                    'Database Configuration',
                    columnToShowIn || vscode.ViewColumn.One,
                    {
                        enableScripts: true
                    }
                );

                DatabaseConfigPanel.currentPanel = new DatabaseConfigPanel(panel, resolve);
            }

            DatabaseConfigPanel.currentPanel._panel.onDidDispose(
                () => {
                    DatabaseConfigPanel.currentPanel = undefined;
                },
                null,
                DatabaseConfigPanel.currentPanel._disposables
            );
        });
    }

    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                }
                input {
                    width: 100%;
                    padding: 5px;
                    border: 1px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }
                .button-group {
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                }
                button {
                    padding: 8px 16px;
                    border: none;
                    color: var(--vscode-button-foreground);
                    background: var(--vscode-button-background);
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <form id="configForm">
                <div class="form-group">
                    <label for="host">Host:</label>
                    <input type="text" id="host" value="localhost" required>
                </div>
                <div class="form-group">
                    <label for="port">Port:</label>
                    <input type="number" id="port" value="3306" required>
                </div>
                <div class="form-group">
                    <label for="user">Username:</label>
                    <input type="text" id="user" value="root" required>
                </div>
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" required>
                </div>
                <div class="form-group">
                    <label for="database">Database:</label>
                    <input type="text" id="database" required>
                </div>
                <div class="button-group">
                    <button type="submit">Connect</button>
                    <button type="button" onclick="cancel()">Cancel</button>
                </div>
            </form>
            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('configForm').addEventListener('submit', (e) => {
                    e.preventDefault();
                    const config = {
                        host: document.getElementById('host').value,
                        port: parseInt(document.getElementById('port').value),
                        user: document.getElementById('user').value,
                        password: document.getElementById('password').value,
                        database: document.getElementById('database').value
                    };
                    vscode.postMessage({ command: 'submit', config });
                });

                function cancel() {
                    vscode.postMessage({ command: 'cancel' });
                }
            </script>
        </body>
        </html>`;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async message => {
                console.log('Received message:', message); // 添加日志
                switch (message.command) {
                    case 'submit':
                        console.log('Processing submit with config:', message.config); // 添加日志
                        // 验证配置
                        if (!message.config || !message.config.host || !message.config.port || 
                            !message.config.user || !message.config.password || !message.config.database) {
                            vscode.window.showErrorMessage('Please fill in all database configuration fields');
                            return;
                        }
                        if (this._resolveCallback) {
                            this._resolveCallback(message.config);
                        }
                        this.dispose();
                        break;
                    case 'cancel':
                        console.log('Processing cancel'); // 添加日志
                        if (this._resolveCallback) {
                            this._resolveCallback(undefined);
                        }
                        this.dispose();
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    public dispose() {
        DatabaseConfigPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
