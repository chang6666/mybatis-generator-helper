import * as vscode from 'vscode';

export class CodePreviewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };
    }

    async showPreview(code: string) {
        if (this.view) {
            this.view.webview.html = this.getPreviewHtml(code);
        }
    }

    private getPreviewHtml(code: string): string {
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        pre { padding: 16px; }
                    </style>
                </head>
                <body>
                    <pre><code>${code}</code></pre>
                </body>
            </html>
        `;
    }
}
