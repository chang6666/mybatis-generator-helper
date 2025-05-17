import * as vscode from 'vscode';
import { SqlFormatter } from './SqlFormatter';

export class SqlConsoleViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'mybatis.sqlConsole';
    private _view?: vscode.WebviewView;
    private _clipboardMonitorInterval: NodeJS.Timeout | null = null;
    private _autoStopTimer: NodeJS.Timeout | null = null;
    private _lastClipboardContent: string = '';
    private static _instance: SqlConsoleViewProvider | null = null;
    
    constructor(private readonly _extensionUri: vscode.Uri) {
        SqlConsoleViewProvider._instance = this;
    }
    
    public static getInstance(): SqlConsoleViewProvider | null {
        return this._instance;
    }
    
    // 添加 dispose 方法
    public dispose() {
        this.stopMonitoringClipboard();
        this._view = undefined;
        SqlConsoleViewProvider._instance = null;
    }
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 处理来自 webview 的消息
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'formatSql':
                    await this.formatSqlFromDebugConsole();
                    break;
                case 'startMonitoring':
                    this.startMonitoringClipboard();
                    break;
                case 'stopMonitoring':
                    this.stopMonitoringClipboard();
                    break;
                case 'clearResults':
                    this._view?.webview.postMessage({ 
                        command: 'clearResults'
                    });
                    break;
            }
        });

        // 当视图关闭时停止监控
        webviewView.onDidDispose(() => {
            this.stopMonitoringClipboard();
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    padding: 0;
                    margin: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                }
                .button-row {
                    display: flex;
                    width: 90%;
                    justify-content: space-between;
                    margin: 10px;
                }
                button {
                    padding: 8px 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .full-width {
                    width: 100%;
                }
                .half-width {
                    width: 48%;
                }
                #monitorButton {
                    background-color: var(--vscode-debugIcon.startForeground);
                }
                #monitorButton.monitoring {
                    background-color: var(--vscode-debugIcon.stopForeground);
                }
                #sqlResults {
                    width: 90%;
                    margin: 10px;
                    padding: 0;
                    max-height: 300px;
                    overflow: auto;
                }
                .sql-result {
                    margin-bottom: 10px;
                    padding: 10px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    white-space: pre-wrap;
                    word-break: break-all;
                    position: relative;
                }
                .sql-result .copy-button {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    padding: 2px 5px;
                    font-size: 0.8em;
                    opacity: 0.7;
                }
                .sql-result .copy-button:hover {
                    opacity: 1;
                }
                .sql-result .timestamp {
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 5px;
                }
                .status-bar {
                    width: 90%;
                    margin: 5px 10px;
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div class="button-row">
                <button id="formatButton" class="half-width">格式化调试控制台 SQL</button>
                <button id="monitorButton" class="half-width">开始监控剪贴板</button>
            </div>
            <div class="button-row">
                <button id="clearButton" class="full-width">清空结果</button>
            </div>
            <div class="status-bar" id="statusBar">状态: 就绪</div>
            <div id="sqlResults"></div>
            
            <script>
                const vscode = acquireVsCodeApi();
                const formatButton = document.getElementById('formatButton');
                const monitorButton = document.getElementById('monitorButton');
                const clearButton = document.getElementById('clearButton');
                const sqlResults = document.getElementById('sqlResults');
                const statusBar = document.getElementById('statusBar');
                
                let isMonitoring = false;
                
                formatButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'formatSql' });
                    statusBar.textContent = '状态: 正在格式化 SQL...';
                });
                
                monitorButton.addEventListener('click', () => {
                    if (isMonitoring) {
                        vscode.postMessage({ command: 'stopMonitoring' });
                        monitorButton.textContent = '开始监控剪贴板';
                        monitorButton.classList.remove('monitoring');
                        statusBar.textContent = '状态: 已停止监控';
                    } else {
                        vscode.postMessage({ command: 'startMonitoring' });
                        monitorButton.textContent = '停止监控剪贴板';
                        monitorButton.classList.add('monitoring');
                        statusBar.textContent = '状态: 正在监控剪贴板...';
                    }
                    isMonitoring = !isMonitoring;
                });
                
                clearButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'clearResults' });
                    sqlResults.innerHTML = '';
                    statusBar.textContent = '状态: 已清空结果';
                });
                
                function addSqlResult(sql, timestamp = new Date()) {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'sql-result';
                    
                    const timeDiv = document.createElement('div');
                    timeDiv.className = 'timestamp';
                    timeDiv.textContent = timestamp.toLocaleTimeString();
                    resultDiv.appendChild(timeDiv);
                    
                    const sqlContent = document.createElement('div');
                    sqlContent.textContent = sql;
                    resultDiv.appendChild(sqlContent);
                    
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-button';
                    copyButton.textContent = '复制';
                    copyButton.onclick = () => {
                        navigator.clipboard.writeText(sql).then(() => {
                            copyButton.textContent = '已复制';
                            setTimeout(() => {
                                copyButton.textContent = '复制';
                            }, 2000);
                        });
                    };
                    resultDiv.appendChild(copyButton);
                    
                    sqlResults.insertBefore(resultDiv, sqlResults.firstChild);
                }
                
                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showSql':
                            addSqlResult(message.sql);
                            statusBar.textContent = '状态: SQL 已格式化';
                            break;
                        case 'clearResults':
                            sqlResults.innerHTML = '';
                            break;
                        case 'updateStatus':
                            statusBar.textContent = '状态: ' + message.status;
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    // 开始监控剪贴板
    private startMonitoringClipboard() {
        this.stopMonitoringClipboard(); // 确保先停止之前的监控
        
        // 减少检查频率，每3秒检查一次
        this._clipboardMonitorInterval = setInterval(async () => {
            try {
                const clipboardContent = await vscode.env.clipboard.readText();
                
                // 如果剪贴板内容变化且包含 MyBatis SQL 日志特征
                if (clipboardContent !== this._lastClipboardContent && 
                    (clipboardContent.includes('Preparing:') || clipboardContent.includes('Parameters:'))) {
                    
                    this._lastClipboardContent = clipboardContent;
                    
                    // 限制处理的SQL语句数量
                    const sqlStatements = this.extractMultipleSqlStatements(clipboardContent).slice(0, 3);
                    
                    if (sqlStatements.length > 0) {
                        // 清除之前的结果，避免累积
                        if (sqlStatements.length > 1) {
                            this._view?.webview.postMessage({ 
                                command: 'clearResults'
                            });
                        }
                        
                        for (const sql of sqlStatements) {
                            const formattedSql = SqlFormatter.formatSql(sql);
                            this._view?.webview.postMessage({ 
                                command: 'showSql', 
                                sql: formattedSql 
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('监控剪贴板时出错:', error);
            }
        }, 3000); // 增加间隔到3秒
        
        this._view?.webview.postMessage({ 
            command: 'updateStatus', 
            status: '正在监控剪贴板...' 
        });
        
        // 设置自动停止监控的定时器（1小时后）
        this._autoStopTimer = setTimeout(() => {
            this.stopMonitoringClipboard();
            this._view?.webview.postMessage({ 
                command: 'updateStatus', 
                status: '监控已自动停止（1小时超时）' 
            });
        }, 1 * 60 * 60 * 1000);
    }
    
    // 停止监控剪贴板
    private stopMonitoringClipboard() {
        if (this._clipboardMonitorInterval) {
            clearInterval(this._clipboardMonitorInterval);
            this._clipboardMonitorInterval = null;
        }
        
        if (this._autoStopTimer) {
            clearTimeout(this._autoStopTimer);
            this._autoStopTimer = null;
        }
        
        this._view?.webview.postMessage({ 
            command: 'updateStatus', 
            status: '已停止监控' 
        });
    }
    
    // 提取多条 SQL 语句
    private extractMultipleSqlStatements(text: string): string[] {
        const sqlStatements: string[] = [];
        
        // 按行分割
        const lines = text.split('\n');
        
        let currentSql = '';
        let collectingStatement = false;
        
        for (const line of lines) {
            // 如果找到新的 SQL 语句开始
            if (line.includes('Preparing:')) {
                // 如果已经在收集一条语句，先保存它
                if (collectingStatement && currentSql) {
                    sqlStatements.push(currentSql);
                }
                
                // 开始收集新语句
                currentSql = line;
                collectingStatement = true;
            } 
            // 如果是参数行，且正在收集语句
            else if (collectingStatement && line.includes('Parameters:')) {
                currentSql += '\n' + line;
                
                // 参数行通常是一条 SQL 的结束，保存并重置
                sqlStatements.push(currentSql);
                currentSql = '';
                collectingStatement = false;
            }
            // 如果正在收集语句，添加当前行
            else if (collectingStatement) {
                currentSql += '\n' + line;
            }
        }
        
        // 如果最后还有未保存的语句
        if (collectingStatement && currentSql) {
            sqlStatements.push(currentSql);
        }
        
        return sqlStatements;
    }

    // 从调试控制台获取 SQL 并格式化
    private async formatSqlFromDebugConsole() {
        try {
            // 获取调试控制台的输出
            // 注意：VS Code API 不直接支持读取调试控制台内容
            // 我们需要使用一个变通方法
            
            // 方法1：尝试从活动终端获取最近的输出
            let sqlLog = '';
            
            // 如果有活动的终端，尝试从终端获取
            const terminal = vscode.window.activeTerminal;
            if (terminal) {
                // 由于 VS Code API 限制，我们无法直接读取终端内容
                // 提示用户复制内容
                await vscode.window.showInformationMessage(
                    '请从调试控制台复制 SQL 日志',
                    '已复制'
                );
                
                // 从剪贴板读取
                sqlLog = await vscode.env.clipboard.readText();
            } else {
                // 如果没有活动终端，提示用户手动复制
                await vscode.window.showInformationMessage(
                    '请从调试控制台复制 SQL 日志到剪贴板',
                    '已复制'
                );
                sqlLog = await vscode.env.clipboard.readText();
            }
            
            if (!sqlLog) {
                this._view?.webview.postMessage({ 
                    command: 'showSql', 
                    sql: '未找到 SQL 日志，请确保已复制 MyBatis 日志到剪贴板' 
                });
                return;
            }
            
            // 尝试提取多条 SQL 语句
            const sqlStatements = this.extractMultipleSqlStatements(sqlLog);
            
            if (sqlStatements.length > 0) {
                for (const sql of sqlStatements) {
                    const formattedSql = SqlFormatter.formatSql(sql);
                    this._view?.webview.postMessage({ 
                        command: 'showSql', 
                        sql: formattedSql 
                    });
                }
                
                // 复制最后一条格式化的 SQL 到剪贴板
                const lastFormattedSql = SqlFormatter.formatSql(sqlStatements[sqlStatements.length - 1]);
                await vscode.env.clipboard.writeText(lastFormattedSql);
                
                if (sqlStatements.length > 1) {
                    vscode.window.showInformationMessage(`已格式化 ${sqlStatements.length} 条 SQL 语句，最后一条已复制到剪贴板`);
                } else {
                    vscode.window.showInformationMessage('SQL 已格式化并复制到剪贴板');
                }
            } else {
                // 尝试作为单条 SQL 处理
                const formattedSql = SqlFormatter.formatSql(sqlLog);
                this._view?.webview.postMessage({ 
                    command: 'showSql', 
                    sql: formattedSql 
                });
                
                // 复制到剪贴板
                await vscode.env.clipboard.writeText(formattedSql);
                vscode.window.showInformationMessage('SQL 已格式化并复制到剪贴板');
            }
        } catch (error) {
            this._view?.webview.postMessage({ 
                command: 'showSql', 
                sql: `格式化 SQL 失败: ${(error as Error).message}` 
            });
        }
    }
}
