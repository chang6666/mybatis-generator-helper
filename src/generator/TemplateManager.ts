import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TemplateManager {
    private static readonly DEFAULT_TEMPLATES = {
        entity: '...',
        mapper: '...',
        xml: '...'
    };

    static async getTemplate(type: 'entity' | 'mapper' | 'xml'): Promise<string> {
        const config = await (await import('../config/ExtensionConfig.js')).ConfigManager.getConfig();
        if (config.templatePath) {
            try {
                const templatePath = path.join(config.templatePath, `${type}.hbs`);
                return await fs.readFile(templatePath, 'utf-8');
            } catch (error) {
                console.warn(`Failed to load custom template: ${error}`);
            }
        }
        return this.DEFAULT_TEMPLATES[type];
    }
}
