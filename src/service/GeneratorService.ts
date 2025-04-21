import { DatabaseConfig } from "../config/DatabaseConfig";
import * as vscode from 'vscode';
import { DatabaseService } from '../service/DatabaseService';

export class GeneratorService {
    static async generate(tables: string[], config: DatabaseConfig) {
        return (await import('vscode')).window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating MyBatis files",
            cancellable: true
        }, async (progress, token) => {
            const increment = 100 / tables.length;
            
            for (const table of tables) {
                if (token.isCancellationRequested) {
                    break;
                }
                
                progress.report({
                    message: `Processing table: ${table}`,
                    increment
                });
                
                await GeneratorService.generateForTable(table, config);
            }
        });
    }

    private static async generateForTable(table: string, config: DatabaseConfig) {
        const dbService = new DatabaseService();
        try {
            await dbService.connect(config);
            const tableInfo = await dbService.getTableInfo(table);
            // Add your generation logic here using EntityGenerator and MapperGenerator
        } finally {
            await dbService.disconnect();
        }
    }
}
