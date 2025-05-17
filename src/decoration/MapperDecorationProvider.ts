import * as vscode from 'vscode';
import * as path from 'path';

export class MapperDecorationProvider {
    private static readonly _codelensProvider = new class implements vscode.CodeLensProvider {
        async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
            const codeLenses: vscode.CodeLens[] = [];
            
            if (document.languageId === 'java') {
                const text = document.getText();
                const interfaceMatch = text.match(/public\s+interface\s+(\w+)/);

                if (interfaceMatch) {
                    // 处理所有方法声明
                    const lines = text.split('\n');
                    const interfaceName = interfaceMatch[1];
                    const xmlContent = await MapperDecorationProvider.findAndReadXmlFile(interfaceName);
                    
                    if (xmlContent) {
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (MapperDecorationProvider.isMethodDeclaration(line)) {
                                // 提取方法名
                                const methodMatch = line.match(/\s*(?:[\w\s<>,]+)\s+(\w+)\s*\(/);
                                if (methodMatch) {
                                    const methodName = methodMatch[1];
                                    const range = new vscode.Range(i, 0, i, line.length);
                                    
                                    // 检查XML中是否存在对应的方法实现
                                    if (MapperDecorationProvider.hasMethodImplementation(xmlContent, methodName)) {
                                        codeLenses.push(new vscode.CodeLens(range, {
                                            title: "$(arrow-right) Go to XML implementation",
                                            command: 'mybatis.jump'
                                        }));
                                    } else {
                                        // 如果没有实现，显示创建建议
                                        codeLenses.push(new vscode.CodeLens(range, {
                                            title: "$(add) Create XML implementation",
                                            command: 'mybatis.createImplementation',
                                            arguments: [methodName, interfaceName] // 添加接口名称作为参数
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (document.languageId === 'xml') {
                // XML 部分的代码保持不变
                const text = document.getText();
                const namespaceMatch = text.match(/namespace="([^"]+)"/);
                if (namespaceMatch) {
                    const range = document.lineAt(document.positionAt(namespaceMatch.index!)).range;
                    codeLenses.push(new vscode.CodeLens(range, {
                        title: "$(arrow-left) Go to Interface",
                        command: 'mybatis.jump'
                    }));
                }

                const sqlRegex = /<(select|insert|update|delete)\s+id="([^"]+)"/g;
                let match;
                while ((match = sqlRegex.exec(text)) !== null) {
                    const range = document.lineAt(document.positionAt(match.index!)).range;
                    codeLenses.push(new vscode.CodeLens(range, {
                        title: "$(arrow-left) Go to Interface method",
                        command: 'mybatis.jump'
                    }));
                }
            }

            return codeLenses;
        }
    };

    private static readonly _decorationProvider = new class implements vscode.FileDecorationProvider {
        private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
        readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
        private decoratedFiles = new Set<string>();

        provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
            const path = uri.path;
            const isMapper = path.endsWith('Mapper.java') || path.endsWith('Mapper.xml');
            
            if (!isMapper) {
                // 如果之前装饰过但现在不需要，从集合中移除
                if (this.decoratedFiles.has(path)) {
                    this.decoratedFiles.delete(path);
                }
                return undefined;
            }

            // 添加到已装饰文件集合
            this.decoratedFiles.add(path);
            
            return {
                badge: '↔',
                tooltip: 'Click to jump to implementation/interface',
                propagate: true,
            };
        }
    };

    static register(context: vscode.ExtensionContext): void {
        // Register CodeLens provider
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                [{ language: 'java' }, { language: 'xml' }],
                this._codelensProvider
            )
        );

        // Register Decoration provider
        context.subscriptions.push(
            vscode.window.registerFileDecorationProvider(this._decorationProvider)
        );
    }

    private static async findAndReadXmlFile(interfaceName: string): Promise<string | undefined> {
        if (!interfaceName) return undefined;
        
        const files = await vscode.workspace.findFiles(`**/${interfaceName}.xml`);
        if (files.length === 0) return undefined;

        const xmlDocument = await vscode.workspace.openTextDocument(files[0]);
        return xmlDocument.getText();
    }

    private static hasMethodImplementation(xmlContent: string, methodName: string): boolean {
        const regex = new RegExp(`id="${methodName}"[^>]*>`);
        return regex.test(xmlContent);
    }

    private static isMethodDeclaration(line: string): boolean {
        const methodPattern = /^\s*(public|private|protected)?\s*([\w\s<>,]+)\s+\w+\s*\([^)]*\)\s*;/;
        return methodPattern.test(line);
    }
}
