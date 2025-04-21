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
	let generateDisposable = vscode.commands.registerCommand('mybatis.generate', async () => {
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

			// Create base directories if they don't exist
			const javaBasePath = `${rootPath}/src/main/java/${packageName.replace(/\./g, '/')}`;
			const resourcesPath = `${rootPath}/src/main/resources`;
			
			// Ensure main directories exist
			await ensureDirectory(vscode.Uri.file(`${javaBasePath}/entity`));
			await ensureDirectory(vscode.Uri.file(`${javaBasePath}/mapper`));
			await ensureDirectory(vscode.Uri.file(`${resourcesPath}/mapper`));

			// 生成选中的所有表
			for (const tableName of selectedTables) {
				try {
					// 获取表信息
					const tableInfo = await dbService.getTableInfo(tableName);
					const className = tableName.split('_')
						.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
						.join('');
					
					// 创建实体类文件
					const entityPath = vscode.Uri.file(`${javaBasePath}/entity/${className}.java`);
					const entityCode = EntityGenerator.generateEntity(tableInfo, `${packageName}.entity`);
					await vscode.workspace.fs.writeFile(entityPath, Buffer.from(entityCode));
					const entityDoc = await vscode.workspace.openTextDocument(entityPath);
					await vscode.window.showTextDocument(entityDoc, { preview: false });

					// 生成 Mapper 接口和 XML
					const mapperCode = MapperGenerator.generateMapper(tableInfo, packageName);
					
					// 创建 Mapper 接口文件
					const mapperPath = vscode.Uri.file(`${javaBasePath}/mapper/${className}Mapper.java`);
					await vscode.workspace.fs.writeFile(mapperPath, Buffer.from(mapperCode.interface));
					const mapperDoc = await vscode.workspace.openTextDocument(mapperPath);
					await vscode.window.showTextDocument(mapperDoc, { preview: false });

					// 创建 Mapper XML 文件
					const xmlPath = vscode.Uri.file(`${resourcesPath}/mapper/${className}Mapper.xml`);
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

	let jumpDisposable = vscode.commands.registerCommand('mybatis.jump', async () => {
		await MapperJumper.jump();
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

	context.subscriptions.push(generateDisposable);
	context.subscriptions.push(jumpDisposable);
	context.subscriptions.push(createImplementationDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
