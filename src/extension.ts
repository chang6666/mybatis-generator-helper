// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DatabaseConfigManager } from './config/DatabaseConfig';
import { DatabaseService } from './service/DatabaseService';
import { EntityGenerator } from './generator/EntityGenerator';
import { DatabaseConfigPanel } from './webview/DatabaseConfigPanel';
import { MapperGenerator } from './generator/MapperGenerator';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('mybatis-cnb.generateEntity', async () => {
		// 使用 Webview 获取数据库配置
		const config = await DatabaseConfigPanel.createOrShow();
		if (!config) {
			return;
		}

		// 检查工作区
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('Please open a workspace first');
			return;
		}

		// 连接数据库
		let dbService: DatabaseService | undefined;
		try {
			dbService = new DatabaseService();
			await dbService.connect(config);
			
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

			// 生成选中的所有表
			for (const tableName of selectedTables) {
				try {
					// 获取表信息
					const tableInfo = await dbService.getTableInfo(tableName);
					const className = tableName.split('_')
						.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
						.join('');
					
					// 创建实体类文件
					const entityPath = vscode.Uri.file(`${rootPath}/src/main/java/${packageName.replace(/\./g, '/')}/entity/${className}.java`);
					const entityCode = EntityGenerator.generateEntity(tableInfo, `${packageName}.entity`);
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(entityPath.fsPath.substring(0, entityPath.fsPath.lastIndexOf('/'))));
					await vscode.workspace.fs.writeFile(entityPath, Buffer.from(entityCode));
					const entityDoc = await vscode.workspace.openTextDocument(entityPath);
					await vscode.window.showTextDocument(entityDoc, { preview: false });

					// 生成 Mapper 接口和 XML
					const mapperCode = MapperGenerator.generateMapper(tableInfo, packageName);
					
					// 创建 Mapper 接口文件
					const mapperPath = vscode.Uri.file(`${rootPath}/src/main/java/${packageName.replace(/\./g, '/')}/mapper/${className}Mapper.java`);
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(mapperPath.fsPath.substring(0, mapperPath.fsPath.lastIndexOf('/'))));
					await vscode.workspace.fs.writeFile(mapperPath, Buffer.from(mapperCode.interface));
					const mapperDoc = await vscode.workspace.openTextDocument(mapperPath);
					await vscode.window.showTextDocument(mapperDoc, { preview: false });

					// 创建 Mapper XML 文件
					const xmlPath = vscode.Uri.file(`${rootPath}/src/main/resources/mapper/${className}Mapper.xml`);
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(xmlPath.fsPath.substring(0, xmlPath.fsPath.lastIndexOf('/'))));
					await vscode.workspace.fs.writeFile(xmlPath, Buffer.from(mapperCode.xml));
					const xmlDoc = await vscode.workspace.openTextDocument(xmlPath);
					await vscode.window.showTextDocument(xmlDoc, { preview: false });

					vscode.window.showInformationMessage(`Generated files for table ${tableName}`);
				} catch (error: unknown) {
					vscode.window.showErrorMessage(`Error generating code for table ${tableName}: ${(error as Error).message}`);
				}
			}

			vscode.window.showInformationMessage('Code generation completed!');
		} catch (error: unknown) {
			vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
		} finally {
			if (dbService) await dbService.disconnect();
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
