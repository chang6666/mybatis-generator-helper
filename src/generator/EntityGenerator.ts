import * as Handlebars from 'handlebars';
import { TableInfo, TableColumn } from '../service/DatabaseService';

export class EntityGenerator {
    private static template = `
package {{packageName}};

import lombok.Data;
{{#if hasDate}}
import java.util.Date;
{{/if}}

/**
 * {{tableComment}}
 */
@Data
public class {{className}} {
    {{#each columns}}
    /**
     * {{columnComment}}
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

        return compiled({
            packageName,
            className: this.toClassName(tableInfo.tableName),
            hasDate,
            columns: tableInfo.columns.map(col => ({
                columnComment: col.columnComment || col.columnName,
                javaType: this.typeMapping[col.dataType.toLowerCase()] || 'String',
                fieldName: this.toCamelCase(col.columnName)
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