// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DatabaseConfigManager } from './config/DatabaseConfig';
import { DatabaseService } from './service/DatabaseService';
import { EntityGenerator } from './generator/EntityGenerator';
import { DatabaseConfigPanel } from './webview/DatabaseConfigPanel';
import { MapperGenerator } from './generator/MapperGenerator';
import { MapperJumper } from './jump/MapperJumper';
import { MapperDecorationProvider } from './decoration/MapperDecorationProvider';
import { Logger } from './utils/Logger';
import { TemplateManager } from './generator/TemplateManager';
import { SqlFormatter } from './sql/SqlFormatter';
import { SqlConsoleViewProvider } from './sql/SqlConsoleViewProvider';
import { MemoryMonitor } from './utils/MemoryMonitor';

async function ensureDirectory(uri: vscode.Uri): Promise<void> {
    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        await vscode.workspace.fs.createDirectory(uri);
    }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// 启动内存监控，设置极低的阈值
	MemoryMonitor.startMonitoring(30); // 设置30MB阈值

	// 添加更频繁的内存优化
	const memoryOptimizationInterval = setInterval(() => {
		MemoryMonitor.optimizeMemory(true); // 使用激进优化
	}, 5 * 60 * 1000); // 每5分钟优化一次
	
	// 将定时器添加到订阅中以便正确清理
	context.subscriptions.push({ dispose: () => clearInterval(memoryOptimizationInterval) });
	
	// 添加内存警告通知
	const memoryWarningInterval = setInterval(() => {
		const memoryInfo = MemoryMonitor.getMemoryUsage();
		if (memoryInfo.current > 100) { // 如果内存超过100MB，显示警告
			vscode.window.showWarningMessage(
				`高内存使用警告: ${memoryInfo.current}MB，点击优化内存`,
				'优化内存'
			).then(selection => {
				if (selection === '优化内存') {
					MemoryMonitor.optimizeMemory(true);
				}
			});
		}
	}, 10 * 60 * 1000); // 每10分钟检查一次
	
	context.subscriptions.push({ dispose: () => clearInterval(memoryWarningInterval) });
	
	let generateDisposable = vscode.commands.registerCommand('mybatis.generate', async () => {
		// 使用 Webview 获取数据库配置
		const config = await DatabaseConfigPanel.createOrShow();
		if (!config) {
			return;
		}

		// 初始化连接池
		try {
			await DatabaseService.initializePool(config);
			
			// 检查工作区
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				vscode.window.showErrorMessage('Please open a workspace first');
				return;
			}

			// 连接数据库
			const dbService = new DatabaseService();
			await dbService.connect();
			
			try {
				// 获取所有表
				const tables = await dbService.getAllTables();
				if (tables.length === 0) {
					vscode.window.showInformationMessage('No tables found in the database.');
					return;
				}

				// 选择生成模式
				const generateMode = await vscode.window.showQuickPick(
					['Generate All Tables', 'Select Tables'],
					{ placeHolder: 'Choose generation mode' }
				);

				if (!generateMode) {
					return;
				}

				let selectedTables: string[] = [];
				if (generateMode === 'Generate All Tables') {
					selectedTables = tables;
				} else {
					// 多选表名
					const selected = await vscode.window.showQuickPick(tables, {
						canPickMany: true,
						placeHolder: 'Select tables to generate entities'
					});
					if (!selected || selected.length === 0) {
						return;
					}
					selectedTables = selected;
				}

				// 获取包名
				const packageName = await vscode.window.showInputBox({
					prompt: 'Enter package name',
					value: 'com.example'
				});
				if (!packageName) {
					return;
				}

				// 获取保存路径
				const defaultPath = workspaceFolders[0].uri.fsPath;
				const targetFolder = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(defaultPath),
					openLabel: 'Select Output Directory'
				});

				if (!targetFolder || targetFolder.length === 0) {
					return;
				}

				const rootPath = targetFolder[0].fsPath;

				// Create base directories if they don't exist
				const javaBasePath = `${rootPath}/src/main/java/${packageName.replace(/\./g, '/')}`;
				const resourcesPath = `${rootPath}/src/main/resources`;
				
				// Ensure main directories exist
				await ensureDirectory(vscode.Uri.file(`${javaBasePath}/entity`));
				await ensureDirectory(vscode.Uri.file(`${javaBasePath}/mapper`));
				await ensureDirectory(vscode.Uri.file(`${resourcesPath}/mapper`));

				// 获取配置
				const extensionConfig = await (await import('./config/ExtensionConfig.js')).ConfigManager.getConfig();
				
				// 处理表前缀
				let removePrefix = false;
				let prefixes = extensionConfig.tablePrefix;
				
				// 强制显示前缀处理选项
				vscode.window.showInformationMessage(`处理表前缀。配置设置: ${extensionConfig.tablePrefixHandling}, 前缀列表: ${prefixes.join(', ')}`);
				
				// 无论配置如何，始终显示选项让用户选择
				const prefixChoice = await vscode.window.showQuickPick(
					['保留表前缀（如sys_、biz_）', '移除表前缀（如sys_、biz_）'],
					{ 
						placeHolder: `如何处理表前缀？(例如: sys_, biz_, tb_)`,
						ignoreFocusOut: true
					}
				);
				
				if (!prefixChoice) {
					// 用户取消了选择，默认保留前缀
					vscode.window.showInformationMessage('前缀处理已取消。默认保留前缀。');
					removePrefix = false;
				} else {
					removePrefix = prefixChoice === '移除表前缀（如sys_、biz_）';
					vscode.window.showInformationMessage(`已选择${removePrefix ? '移除' : '保留'}表前缀。`);
				}
				
				// 如果用户选择了移除前缀，但没有配置前缀，提示用户添加前缀
				if (removePrefix && prefixes.length === 0) {
					const inputPrefix = await vscode.window.showInputBox({
						prompt: '请输入要移除的表前缀，多个前缀用逗号分隔（例如：sys_,biz_,tb_）',
						placeHolder: 'sys_,biz_,tb_'
					});
					
					if (inputPrefix) {
						prefixes = inputPrefix.split(',').map(p => p.trim());
						vscode.window.showInformationMessage(`已添加前缀: ${prefixes.join(', ')}`);
					}
				}
				
				// 批量生成文件，减少I/O操作
				async function generateFiles(selectedTables: string[], dbService: DatabaseService, 
											javaBasePath: string, resourcesPath: string, 
											packageName: string, removePrefix: boolean, prefixes: string[]) {
					// 准备所有文件操作
					const fileOperations: Array<{uri: vscode.Uri, content: Buffer}> = [];
					
					for (const tableName of selectedTables) {
						try {
							// 获取表信息
							const tableInfo = await dbService.getTableInfo(tableName);
							
							// 根据前缀设置生成类名
							const className = EntityGenerator.toClassName(tableName, removePrefix, prefixes);
							
							// 创建实体类文件
							const entityPath = vscode.Uri.file(`${javaBasePath}/entity/${className}.java`);
							const entityCode = EntityGenerator.generateEntity(tableInfo, `${packageName}.entity`, removePrefix, prefixes);
							fileOperations.push({uri: entityPath, content: Buffer.from(entityCode)});

							// 生成 Mapper 接口和 XML
							const mapperCode = MapperGenerator.generateMapper(tableInfo, packageName, removePrefix, prefixes);
							
							// 创建 Mapper 接口文件
							const mapperPath = vscode.Uri.file(`${javaBasePath}/mapper/${className}Mapper.java`);
							fileOperations.push({uri: mapperPath, content: Buffer.from(mapperCode.interface)});

							// 创建 Mapper XML 文件
							const xmlPath = vscode.Uri.file(`${resourcesPath}/mapper/${className}Mapper.xml`);
							fileOperations.push({uri: xmlPath, content: Buffer.from(mapperCode.xml)});
						} catch (error: unknown) {
							vscode.window.showErrorMessage(`Error generating code for table ${tableName}: ${(error as Error).message}`);
						}
					}
					
					// 批量执行文件写入操作
					for (const op of fileOperations) {
						await vscode.workspace.fs.writeFile(op.uri, op.content);
					}
				}

				// 生成选中的所有表
				await generateFiles(selectedTables, dbService, javaBasePath, resourcesPath, packageName, removePrefix, prefixes);

				// 在所有文件生成完成后显示一个总结消息
				vscode.window.showInformationMessage(
					`Successfully generated files for ${selectedTables.length} table(s) in ${packageName}`,
					'Show in Explorer'
				).then(selection => {
					if (selection === 'Show in Explorer') {
						vscode.commands.executeCommand('revealFileInOS', targetFolder[0]);
					}
				});
			} finally {
				await dbService.disconnect();
			}
		} catch (error: unknown) {
			vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
		} finally {
			await DatabaseService.closePool();
		}
	});

	let jumpDisposable = vscode.commands.registerCommand('mybatis.jump', async () => {
		await MapperJumper.jump();
	});

	let jumpToMethodDisposable = vscode.commands.registerCommand('mybatis.jumpToMethod', async (methodName?: string) => {
		await MapperJumper.jumpToMethod(methodName);
	});

	// 注册创建XML实现的命令
	let createImplementationDisposable = vscode.commands.registerCommand('mybatis.createImplementation', async (methodName: string, interfaceName: string) => {
		// 如果没有活动编辑器，尝试通过接口名称查找文件
		let document: vscode.TextDocument;
		let text: string;
		
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			document = editor.document;
			text = document.getText();
		} else {
			// 通过接口名称查找Java文件
			const files = await vscode.workspace.findFiles(`**/${interfaceName}.java`);
			if (files.length === 0) {
				vscode.window.showErrorMessage(`Interface file ${interfaceName} not found.`);
				return;
			}
			document = await vscode.workspace.openTextDocument(files[0]);
			text = document.getText();
		}

		// 查找对应的XML文件
		const xmlFiles = await vscode.workspace.findFiles(`**/${interfaceName}.xml`);
		if (xmlFiles.length === 0) {
			vscode.window.showErrorMessage(`XML file for ${interfaceName} not found.`);
			return;
		}

		// 打开XML文件
		const xmlDocument = await vscode.workspace.openTextDocument(xmlFiles[0]);
		const xmlEditor = await vscode.window.showTextDocument(xmlDocument);

		// 在Java文件中查找方法定义
		const methodRegex = new RegExp(`\\s*(\\w+[\\s\\w<>,]*?)\\s+${methodName}\\s*\\(([^)]*)\\)\\s*;`);
		const methodMatch = text.match(methodRegex);
		if (!methodMatch) {
			vscode.window.showErrorMessage(`Method ${methodName} not found in interface.`);
			return;
		}

		const returnType = methodMatch[1].trim();
		const parameters = methodMatch[2].trim();

		// 查找插入位置
		const xmlContent = xmlDocument.getText();
		let insertPosition: vscode.Position;
		
		// 首先尝试查找最后一个SQL语句
		const lastSqlMatch = xmlContent.match(/<\/(select|insert|update|delete)>[^<]*$/m);
		
		if (lastSqlMatch) {
			// 如果找到最后一个SQL语句，在其后插入
			insertPosition = xmlDocument.positionAt(lastSqlMatch.index! + lastSqlMatch[0].length);
		} else {
			// 如果没有找到SQL语句，查找</mapper>标签
			const mapperEndMatch = xmlContent.match(/<\/mapper>\s*$/);
			if (!mapperEndMatch) {
				vscode.window.showErrorMessage('Invalid XML file: missing </mapper> tag');
				return;
			}
			// 在</mapper>标签前插入
			insertPosition = xmlDocument.positionAt(mapperEndMatch.index!);
		}

		const baseIndent = '    ';
		const sqlIndent = '        ';
		
		// 根据方法名和返回类型决定SQL类型
		let xmlTemplate = '\n';
		xmlTemplate += `${baseIndent}<!-- ${methodName} -->\n`;

		// 判断SQL类型
		if (methodName.startsWith('insert') || methodName.startsWith('save') || methodName.startsWith('add')) {
			xmlTemplate += `${baseIndent}<insert id="${methodName}"${parameters ? `\n${sqlIndent}parameterType="${parameters.split(' ')[0]}"` : ''}>\n`;
			xmlTemplate += `${sqlIndent}INSERT INTO your_table_name\n`;
			xmlTemplate += `${sqlIndent}(\n`;
			xmlTemplate += `${sqlIndent}    your_column1, your_column2\n`;
			xmlTemplate += `${sqlIndent})\n`;
			xmlTemplate += `${sqlIndent}VALUES\n`;
			xmlTemplate += `${sqlIndent}(\n`;
			xmlTemplate += `${sqlIndent}    #{yourValue1}, #{yourValue2}\n`;
			xmlTemplate += `${sqlIndent})\n`;
			xmlTemplate += `${baseIndent}</insert>\n`;
		} else if (methodName.startsWith('update') || methodName.startsWith('modify')) {
			xmlTemplate += `${baseIndent}<update id="${methodName}"${parameters ? `\n${sqlIndent}parameterType="${parameters.split(' ')[0]}"` : ''}>\n`;
			xmlTemplate += `${sqlIndent}UPDATE your_table_name\n`;
			xmlTemplate += `${sqlIndent}SET your_column = #{yourValue}\n`;
			xmlTemplate += `${sqlIndent}WHERE your_condition = #{yourParameter}\n`;
			xmlTemplate += `${baseIndent}</update>\n`;
		} else if (methodName.startsWith('delete') || methodName.startsWith('remove')) {
			xmlTemplate += `${baseIndent}<delete id="${methodName}"${parameters ? `\n${sqlIndent}parameterType="${parameters.split(' ')[0]}"` : ''}>\n`;
			xmlTemplate += `${sqlIndent}DELETE FROM your_table_name\n`;
			xmlTemplate += `${sqlIndent}WHERE your_condition = #{yourParameter}\n`;
			xmlTemplate += `${baseIndent}</delete>\n`;
		} else if (returnType.includes('List')) {
			xmlTemplate += `${baseIndent}<select id="${methodName}"${parameters ? `\n${sqlIndent}parameterType="${parameters.split(' ')[0]}"` : ''}\n${sqlIndent}resultMap="BaseResultMap">\n`;
			xmlTemplate += `${sqlIndent}SELECT\n`;
			xmlTemplate += `${sqlIndent}<include refid="Base_Column_List" />\n`;
			xmlTemplate += `${sqlIndent}FROM your_table_name\n`;
			xmlTemplate += `${sqlIndent}WHERE your_condition = #{yourParameter}\n`;
			xmlTemplate += `${baseIndent}</select>\n`;
		} else {
			xmlTemplate += `${baseIndent}<select id="${methodName}"${parameters ? `\n${sqlIndent}parameterType="${parameters.split(' ')[0]}"` : ''}\n${sqlIndent}resultMap="BaseResultMap">\n`;
			xmlTemplate += `${sqlIndent}SELECT\n`;
			xmlTemplate += `${sqlIndent}<include refid="Base_Column_List" />\n`;
			xmlTemplate += `${sqlIndent}FROM your_table_name\n`;
			xmlTemplate += `${sqlIndent}WHERE your_condition = #{yourParameter}\n`;
			xmlTemplate += `${baseIndent}</select>\n`;
		}

		// 插入新的SQL
		await xmlEditor.edit(editBuilder => {
			editBuilder.insert(insertPosition, xmlTemplate);
		});

		vscode.window.showInformationMessage(`Created XML implementation for ${methodName}`);
	});

	// 注册装饰器提供程序
	MapperDecorationProvider.register(context);

	// 注册工作区关闭事件处理
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(async () => {
			await DatabaseService.closePool();
			Logger.clear();
			TemplateManager.clearCache();
		})
	);

	// 添加配置变化监听
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e.affectsConfiguration('mybatisGeneratorHelper')) {
				TemplateManager.clearCache();
				await DatabaseService.closePool();
			}
		})
	);

	let formatSqlDisposable = vscode.commands.registerCommand('mybatis.formatSql', async () => {
		await SqlFormatter.formatSqlFromClipboard();
	});

	// 注册 SQL 控制台视图提供者
	const sqlConsoleViewProvider = new SqlConsoleViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SqlConsoleViewProvider.viewType,
			sqlConsoleViewProvider
		)
	);

	let showMemoryUsageDisposable = vscode.commands.registerCommand('mybatis.showMemoryUsage', async () => {
		const memoryInfo = MemoryMonitor.getMemoryUsage();
		vscode.window.showInformationMessage(
			`内存使用情况: 当前 ${memoryInfo.current}MB, 平均 ${memoryInfo.average}MB, 最大 ${memoryInfo.max}MB`,
			'优化内存'
		).then(selection => {
			if (selection === '优化内存') {
				MemoryMonitor.optimizeMemory();
				vscode.window.showInformationMessage('已尝试优化内存使用');
			}
		});
	});

	context.subscriptions.push(generateDisposable);
	context.subscriptions.push(jumpDisposable);
	context.subscriptions.push(jumpToMethodDisposable);
	context.subscriptions.push(createImplementationDisposable);
	context.subscriptions.push(formatSqlDisposable);
	context.subscriptions.push(showMemoryUsageDisposable);
}

// This method is called when your extension is deactivated
export async function deactivate() {
	// 停止内存监控
	MemoryMonitor.stopMonitoring();

	// 清理所有资源
	await DatabaseService.closePool();
	Logger.dispose();
	TemplateManager.clearCache();
	
	// 清理任何可能的定时器
	const sqlConsoleProvider = SqlConsoleViewProvider.getInstance();
	if (sqlConsoleProvider) {
		sqlConsoleProvider.dispose();
	}
	
	// 清理任何可能的 WebView
	if (DatabaseConfigPanel.getCurrentPanel()) {
		DatabaseConfigPanel.disposePanel();
	}
}
