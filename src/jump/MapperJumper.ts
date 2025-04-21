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
    static async jumpToMethod() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const position = editor.selection.active;
        const line = document.lineAt(position.line);
        const lineText = line.text;

        // 如果是 Java 文件，查找 XML 中对应的方法定义
        if (document.languageId === 'java') {
            // 提取方法名的新正则表达式
            const methodMatch = lineText.match(/\s*(?:public|private|protected)?\s*(?:[\w\s<>,]+)\s+(\w+)\s*\([^)]*\)/);
            if (!methodMatch) {
                return;
            }
            const methodName = methodMatch[1]; // 获取方法名

            const xmlFile = await this.findCorrespondingXml(document.fileName);
            if (xmlFile) {
                const xmlDocument = await vscode.workspace.openTextDocument(xmlFile);
                const xmlText = xmlDocument.getText();
                const xmlMethodMatch = xmlText.match(new RegExp(`id="${methodName}"[^>]*>`));
                if (xmlMethodMatch) {
                    const pos = xmlDocument.positionAt(xmlMethodMatch.index!);
                    const newEditor = await vscode.window.showTextDocument(xmlDocument);
                    newEditor.selection = new vscode.Selection(pos, pos);
                    newEditor.revealRange(new vscode.Range(pos, pos));
                }
            }
        }
        // XML 部分保持不变
        else if (document.languageId === 'xml') {
            const idMatch = lineText.match(/id="([^"]+)"/);
            if (!idMatch) {
                return;
            }
            const methodName = idMatch[1];

            const javaFile = await this.findCorrespondingJava(document.fileName);
            if (javaFile) {
                const javaDocument = await vscode.workspace.openTextDocument(javaFile);
                const javaText = javaDocument.getText();
                // 更新方法匹配正则表达式
                const methodPattern = new RegExp(`\\s*(?:public|private|protected)?\\s*(?:[\\w\\s<>,]+)\\s+${methodName}\\s*\\(`);
                const methodMatch = javaText.match(methodPattern);
                if (methodMatch) {
                    const pos = javaDocument.positionAt(methodMatch.index!);
                    const newEditor = await vscode.window.showTextDocument(javaDocument);
                    newEditor.selection = new vscode.Selection(pos, pos);
                    newEditor.revealRange(new vscode.Range(pos, pos));
                }
            }
        }
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
