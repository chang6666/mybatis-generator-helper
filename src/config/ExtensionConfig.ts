export interface ExtensionConfig {
    defaultPackageName: string;
    templatePath: string;
    indentSize: number;
    databaseConfigs: import('./DatabaseConfig').DatabaseConfig[];
    namingStrategy: 'camelCase' | 'snake_case';
}

export class ConfigManager {
    private static readonly CONFIG_KEY = 'mybatisGeneratorHelper';

    static async getConfig(): Promise<ExtensionConfig> {
        const config = (await import('vscode')).workspace.getConfiguration(this.CONFIG_KEY);
        return {
            defaultPackageName: config.get('defaultPackageName', 'com.example'),
            templatePath: config.get('templatePath', ''),
            indentSize: config.get('indentSize', 4),
            databaseConfigs: config.get('databaseConfigs', []),
            namingStrategy: config.get('namingStrategy', 'camelCase')
        };
    }
}
