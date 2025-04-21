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

    static generateEntity(tableInfo: TableInfo, packageName: string): string {
        const compiled = Handlebars.compile(this.template);
        
        const hasDate = tableInfo.columns.some(col => 
            ['datetime', 'timestamp'].includes(col.dataType.toLowerCase()));
        
        const hasBigDecimal = tableInfo.columns.some(col => 
            ['decimal'].includes(col.dataType.toLowerCase()));

        return compiled({
            packageName,
            className: this.toClassName(tableInfo.tableName),
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

    private static toClassName(tableName: string): string {
        return tableName.split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');
    }

    private static toCamelCase(columnName: string): string {
        const parts = columnName.toLowerCase().split('_');
        return parts[0] + parts.slice(1)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }
}
