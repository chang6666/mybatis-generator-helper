import * as fs from 'fs/promises';
import * as path from 'path';

export class TemplateManager {
    // 使用 WeakMap 代替 Map 以允许垃圾回收
    private static templateCache = new Map<string, string>();
    private static cacheTimestamp = Date.now();
    private static readonly CACHE_TTL = 1000 * 60 * 30; // 30分钟缓存过期
    private static readonly DEFAULT_TEMPLATES = {
        entity: '...',
        mapper: '...',
        xml: '...'
    };

    static async getTemplate(type: 'entity' | 'mapper' | 'xml'): Promise<string> {
        // 检查缓存是否过期
        if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
            this.clearCache();
        }

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
        this.cacheTimestamp = Date.now();
    }
}
