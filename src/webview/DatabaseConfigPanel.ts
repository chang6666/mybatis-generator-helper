import * as vscode from 'vscode';
import { DatabaseConfig } from '../config/DatabaseConfig';
import { DatabaseService } from '../service/DatabaseService';

export class DatabaseConfigPanel {
    private static readonly viewType = 'databaseConfig';
    private static currentPanel: DatabaseConfigPanel | undefined;
    
    // 使用 WeakMap 存储面板实例数据
    private static readonly panelData = new WeakMap<vscode.WebviewPanel, any>();

    private readonly _panel: vscode.WebviewPanel;
    private readonly _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;
        this._panel.webview.html = DatabaseConfigPanel.getHtmlContent();  // 修改这里，使用静态方法引用
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'testConnection':
                        await this.testConnection(message.config);
                        break;
                    case 'submit':
                        await this.handleSubmit(message.config);
                        break;
                    case 'cancel':
                        this._panel.dispose();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static async createOrShow(): Promise<DatabaseConfig | undefined> {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        if (DatabaseConfigPanel.currentPanel) {
            DatabaseConfigPanel.currentPanel._panel.reveal(column);
            return;
        }

        // 创建新面板时立即注册清理逻辑
        const panel = vscode.window.createWebviewPanel(
            this.viewType,
            'Database Configuration',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: false, // 隐藏时释放内存
                localResourceRoots: [vscode.Uri.joinPath(vscode.Uri.file(__dirname), '..', 'resources')] // 限制资源访问范围
            }
        );

        DatabaseConfigPanel.currentPanel = new DatabaseConfigPanel(panel);
        
        return new Promise((resolve) => {
            panel.onDidDispose(() => {
                DatabaseConfigPanel.currentPanel = undefined;
                const config = DatabaseConfigPanel.panelData.get(panel);
                DatabaseConfigPanel.panelData.delete(panel); // 清理映射
                resolve(config);
            });
        });
    }

    public static getCurrentPanel(): DatabaseConfigPanel | undefined {
        return DatabaseConfigPanel.currentPanel;
    }

    public static disposePanel(): void {
        if (DatabaseConfigPanel.currentPanel) {
            DatabaseConfigPanel.currentPanel.dispose();
            DatabaseConfigPanel.currentPanel = undefined;
        }
    }

    private static getHtmlContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Database Configuration</title>
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
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
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
                #testResult {
                    margin-top: 10px;
                    padding: 10px;
                    display: none;
                }
                .success {
                    background: #2ea043;
                    color: white;
                }
                .error {
                    background: #f85149;
                    color: white;
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
                <div id="testResult"></div>
                <div class="button-group">
                    <button type="button" onclick="testConnection()">Test Connection</button>
                    <button type="submit">Connect</button>
                    <button type="button" onclick="cancel()">Cancel</button>
                </div>
            </form>
            <script>
                const vscode = acquireVsCodeApi();
                
                async function testConnection() {
                    const config = {
                        host: document.getElementById('host').value,
                        port: parseInt(document.getElementById('port').value),
                        user: document.getElementById('user').value,
                        password: document.getElementById('password').value,
                        database: document.getElementById('database').value
                    };
                    
                    const resultDiv = document.getElementById('testResult');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = 'Testing connection...';
                    resultDiv.className = '';
                    
                    vscode.postMessage({ command: 'testConnection', config });
                }
                
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

                window.addEventListener('message', event => {
                    const message = event.data;
                    const resultDiv = document.getElementById('testResult');
                    
                    if (message.command === 'testResult') {
                        resultDiv.style.display = 'block';
                        if (message.success) {
                            resultDiv.className = 'success';
                            resultDiv.textContent = 'Connection successful!';
                        } else {
                            resultDiv.className = 'error';
                            resultDiv.textContent = 'Connection failed: ' + message.error;
                        }
                    }
                });
            </script>
        </body>
        </html>`;
    }

    private async testConnection(config: DatabaseConfig) {
        try {
            await DatabaseService.initializePool(config);
            const dbService = new DatabaseService();
            await dbService.connect();
            
            await this._panel.webview.postMessage({
                command: 'testResult',
                success: true
            });
            
            await dbService.disconnect();
        } catch (error) {
            await this._panel.webview.postMessage({
                command: 'testResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            await DatabaseService.closePool();
        }
    }

    private async handleSubmit(config: DatabaseConfig) {
        try {
            // 初始化连接池
            await DatabaseService.initializePool(config);
            
            // 测试连接
            const dbService = new DatabaseService();
            await dbService.connect();
            await dbService.disconnect();

            // 如果连接成功，发送配置并关闭面板
            DatabaseConfigPanel.panelData.set(this._panel, config);
            this._panel.dispose();
        } catch (error) {
            await this._panel.webview.postMessage({
                command: 'testResult',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            await DatabaseService.closePool();
        }
    }

// DatabaseConfigPanel.ts
public dispose() {
    this._panel.dispose();
    while (this._disposables.length) {
        const disposable = this._disposables.pop();
        if (disposable) disposable.dispose();
    }
}
}
