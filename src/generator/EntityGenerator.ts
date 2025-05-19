import * as Handlebars from 'handlebars';
import { TableInfo, TableColumn } from '../service/DatabaseService';


export class EntityGenerator {
    private static template = `
package {{packageName}};

import lombok.Data;
{{#if hasDate}}
import java.util.Date;
{{/if}}
{{#if hasBigDecimal}}
import java.math.BigDecimal;
{{/if}}

/**
{{#if tableComment}}
 * {{tableComment}}
{{else}}
 * {{className}} entity
{{/if}}
 */
@Data
public class {{className}} {
    {{#each columns}}
    /**
    {{#if columnComment}}
     * {{columnComment}}
    {{else}}
     * {{columnName}}
    {{/if}}
    {{#if isPrimaryKey}}
     * @Primary Key
    {{/if}}
     */
    private {{javaType}} {{fieldName}};

    {{/each}}
}
`;

    private static typeMapping: { [key: string]: string } = {
        'varchar': 'String',
        'char': 'String',
        'text': 'String',
        'int': 'Integer',
        'bigint': 'Long',
        'tinyint': 'Integer',
        'datetime': 'Date',
        'timestamp': 'Date',
        'decimal': 'BigDecimal'
    };

    // 使用单例模式减少模板编译次数
    private static compiledTemplate: HandlebarsTemplateDelegate | null = null;

    static generateEntity(tableInfo: TableInfo, packageName: string, removePrefix: boolean = false, prefixes: string[] = []): string {
        // 只在第一次使用时编译模板
        if (!this.compiledTemplate) {
            this.compiledTemplate = Handlebars.compile(this.template);
        }
        
        const hasDate = tableInfo.columns.some(col => 
            ['datetime', 'timestamp'].includes(col.dataType.toLowerCase()));
        
        const hasBigDecimal = tableInfo.columns.some(col => 
            ['decimal'].includes(col.dataType.toLowerCase()));

        // 重用类型映射，避免重复创建对象
        return this.compiledTemplate({
            packageName,
            className: this.toClassName(tableInfo.tableName, removePrefix, prefixes),
            tableComment: tableInfo.tableComment?.trim(),
            hasDate,
            hasBigDecimal,
            columns: tableInfo.columns.map(col => ({
                columnName: col.columnName,
                columnComment: col.columnComment?.trim(),
                javaType: this.typeMapping[col.dataType.toLowerCase()] || 'String',
                fieldName: this.toCamelCase(col.columnName),
                isPrimaryKey: col.isPrimaryKey
            }))
        });
    }

    static toClassName(tableName: string, removePrefix: boolean, prefixes: string[]): string {
        let className = tableName;
        
        // 调试信息
        console.log(`处理表名: ${tableName}, 移除前缀: ${removePrefix}, 前缀列表: ${prefixes.join(', ')}`);
        
        // 移除前缀
        if (removePrefix && prefixes.length > 0) {
            for (const prefix of prefixes) {
                if (tableName.startsWith(prefix)) {
                    className = tableName.substring(prefix.length);
                    console.log(`匹配到前缀 ${prefix}, 移除后: ${className}`);
                    break;
                }
            }
        }
        
        // 确保处理后的名称不为空
        if (className.length === 0) {
            className = tableName;
        }
        
        // 转换为PascalCase
        const result = className
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');
        
        console.log(`最终类名: ${result}`);
        return result;
    }

    private static toCamelCase(columnName: string): string {
        const parts = columnName.toLowerCase().split('_');
        return parts[0] + parts.slice(1)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }
}
