import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TemplateManager {
    private static templateCache: Map<string, string> = new Map();
    private static readonly DEFAULT_TEMPLATES = {
        entity: '...',
        mapper: '...',
        xml: '...'
    };

    static async getTemplate(type: 'entity' | 'mapper' | 'xml'): Promise<string> {
        // 检查缓存
        const cacheKey = `template_${type}`;
        if (this.templateCache.has(cacheKey)) {
            return this.templateCache.get(cacheKey)!;
        }

        const config = await (await import('../config/ExtensionConfig.js')).ConfigManager.getConfig();
        let template: string;

        if (config.templatePath) {
            try {
                const templatePath = path.join(config.templatePath, `${type}.hbs`);
                template = await fs.readFile(templatePath, 'utf-8');
            } catch (error) {
                console.warn(`Failed to load custom template: ${error}`);
                template = this.DEFAULT_TEMPLATES[type];
            }
        } else {
            template = this.DEFAULT_TEMPLATES[type];
        }

        // 缓存模板
        this.templateCache.set(cacheKey, template);
        return template;
    }

    static clearCache(): void {
        this.templateCache.clear();
    }
}
