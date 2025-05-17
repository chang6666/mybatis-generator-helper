import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class MapperJumper {
    static async jump() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const currentFile = document.fileName;
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a workspace first');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // 如果当前是 Java 文件
        if (document.languageId === 'java') {
            const content = document.getText();
            // 获取接口名称
            const matches = content.match(/public\s+interface\s+(\w+)/);
            if (!matches) {
                return;
            }

            const interfaceName = matches[1];
            // 搜索对应的 XML 文件
            const xmlFile = await this.findFile(workspaceRoot, `${interfaceName}.xml`);
            if (xmlFile) {
                const xmlDocument = await vscode.workspace.openTextDocument(xmlFile);
                await vscode.window.showTextDocument(xmlDocument);
            } else {
                vscode.window.showInformationMessage('Corresponding XML file not found');
            }
        }
        // 如果当前是 XML 文件
        else if (document.languageId === 'xml') {
            const content = document.getText();
            // 获取 namespace
            const matches = content.match(/namespace="([^"]+)"/);
            if (!matches) {
                return;
            }

            const namespace = matches[1];
            const className = namespace.split('.').pop();
            if (!className) {
                return;
            }

            // 搜索对应的 Java 接口文件
            const javaFile = await this.findFile(workspaceRoot, `${className}.java`);
            if (javaFile) {
                const javaDocument = await vscode.workspace.openTextDocument(javaFile);
                await vscode.window.showTextDocument(javaDocument);
            } else {
                vscode.window.showInformationMessage('Corresponding Java interface not found');
            }
        }
    }

    private static async findFile(rootPath: string, targetFileName: string): Promise<string | undefined> {
        const files = await vscode.workspace.findFiles('**/' + targetFileName);
        return files.length > 0 ? files[0].fsPath : undefined;
    }

    // 方法跳转功能
    static async jumpToMethod(methodNameArg?: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const position = editor.selection.active;
        const line = document.lineAt(position.line);
        const lineText = line.text;
        
        // 优先使用传入的方法名参数（来自 CodeLens）
        let methodName = methodNameArg;

        // 如果是 Java 文件，查找 XML 中对应的方法定义
        if (document.languageId === 'java') {
            // 如果没有传入方法名，从当前行提取
            if (!methodName) {
                const methodMatch = lineText.match(/\s*(?:public|private|protected)?\s*(?:[\w\s<>,]+)\s+(\w+)\s*\([^)]*\)/);
                if (methodMatch) {
                    methodName = methodMatch[1]; // 获取方法名
                } else {
                    // 尝试从上下文中查找方法名
                    methodName = this.findMethodNameFromContext(document, position);
                    if (!methodName) {
                        vscode.window.showInformationMessage('Cannot determine method name from current position');
                        return;
                    }
                }
            }

            const xmlFile = await this.findCorrespondingXml(document.fileName);
            if (xmlFile) {
                const xmlDocument = await vscode.workspace.openTextDocument(xmlFile);
                const xmlText = xmlDocument.getText();
                
                // 使用更精确的正则表达式匹配 XML 中的方法 ID
                const xmlMethodRegex = new RegExp(`<(select|insert|update|delete)\\s+id="${methodName}"[^>]*>`, 'i');
                const xmlMethodMatch = xmlText.match(xmlMethodRegex);
                
                if (xmlMethodMatch) {
                    const pos = xmlDocument.positionAt(xmlMethodMatch.index!);
                    const newEditor = await vscode.window.showTextDocument(xmlDocument);
                    newEditor.selection = new vscode.Selection(pos, pos);
                    newEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                } else {
                    vscode.window.showInformationMessage(`Method '${methodName}' implementation not found in XML`);
                }
            } else {
                vscode.window.showInformationMessage('Corresponding XML file not found');
            }
        }
        // 如果是 XML 文件，查找 Java 接口中对应的方法定义
        else if (document.languageId === 'xml') {
            // 如果没有传入方法名，从当前行提取
            if (!methodName) {
                const idMatch = lineText.match(/id="([^"]+)"/);
                if (idMatch) {
                    methodName = idMatch[1];
                } else {
                    // 尝试从上下文中查找方法 ID
                    methodName = this.findMethodIdFromContext(document, position);
                    if (!methodName) {
                        vscode.window.showInformationMessage('Cannot determine method ID from current position');
                        return;
                    }
                }
            }

            const javaFile = await this.findCorrespondingJava(document.fileName);
            if (javaFile) {
                const javaDocument = await vscode.workspace.openTextDocument(javaFile);
                const javaText = javaDocument.getText();
                
                // 更新方法匹配正则表达式，更精确地匹配 Java 方法定义
                const methodPattern = new RegExp(`\\s*(?:public|private|protected)?\\s*(?:[\\w\\s<>,]+)\\s+${methodName}\\s*\\([^)]*\\)`, 'i');
                const methodMatch = javaText.match(methodPattern);
                
                if (methodMatch) {
                    const pos = javaDocument.positionAt(methodMatch.index!);
                    const newEditor = await vscode.window.showTextDocument(javaDocument);
                    newEditor.selection = new vscode.Selection(pos, pos);
                    newEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                } else {
                    vscode.window.showInformationMessage(`Method '${methodName}' not found in interface`);
                }
            } else {
                vscode.window.showInformationMessage('Corresponding Java interface not found');
            }
        }
    }

    // 从上下文中查找方法名（当光标不在方法声明行时使用）
    private static findMethodNameFromContext(document: vscode.TextDocument, position: vscode.Position): string | undefined {
        // 向上搜索最近的方法声明
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text.trim();
            const methodMatch = line.match(/\s*(?:public|private|protected)?\s*(?:[\w\s<>,]+)\s+(\w+)\s*\([^)]*\)/);
            if (methodMatch) {
                return methodMatch[1];
            }
        }
        return undefined;
    }

    // 从上下文中查找方法 ID（当光标不在 id 属性行时使用）
    private static findMethodIdFromContext(document: vscode.TextDocument, position: vscode.Position): string | undefined {
        // 向上搜索最近的方法 ID
        const text = document.getText();
        const lines = text.split('\n');
        
        // 查找当前位置所在的 XML 标签块
        let openTagCount = 0;
        let startLine = position.line;
        
        // 向上搜索开始标签
        while (startLine >= 0) {
            const line = lines[startLine].trim();
            if (line.match(/<(select|insert|update|delete)\s+/i)) {
                const idMatch = line.match(/id="([^"]+)"/);
                if (idMatch) {
                    return idMatch[1];
                }
            }
            startLine--;
        }
        
        return undefined;
    }

    private static async findCorrespondingXml(javaPath: string): Promise<string | undefined> {
        const fileName = path.basename(javaPath, '.java');
        return this.findFile(vscode.workspace.workspaceFolders![0].uri.fsPath, `${fileName}.xml`);
    }

    private static async findCorrespondingJava(xmlPath: string): Promise<string | undefined> {
        const fileName = path.basename(xmlPath, '.xml');
        return this.findFile(vscode.workspace.workspaceFolders![0].uri.fsPath, `${fileName}.java`);
    }
}
