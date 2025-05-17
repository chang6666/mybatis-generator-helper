import * as Handlebars from 'handlebars';
import { TableInfo, TableColumn } from '../service/DatabaseService';

export class MapperGenerator {
    // 修复后的接口模板
    private static interfaceTemplate = `
package {{packageName}}.mapper;

import {{packageName}}.entity.{{className}};
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface {{className}}Mapper {
    int insert({{className}} record);
    int deleteByPrimaryKey({{primaryKeyType}} {{primaryKeyField}});
    int updateByPrimaryKey({{className}} record);
    {{className}} selectByPrimaryKey({{primaryKeyType}} {{primaryKeyField}});
    List<{{className}}> selectAll();
}`;

    // 修正后的 XML 模板（修复 Handlebars 语法冲突）
    private static xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="{{packageName}}.mapper.{{className}}Mapper">
    <resultMap id="BaseResultMap" type="{{packageName}}.entity.{{className}}">
        {{#each columns}}
        {{#if isPrimaryKey}}
        <id column="{{columnName}}" property="{{fieldName}}" jdbcType="{{jdbcType}}" />
        {{else}}
        <result column="{{columnName}}" property="{{fieldName}}" jdbcType="{{jdbcType}}" />
        {{/if}}
        {{/each}}
    </resultMap>

    <sql id="Base_Column_List">
        {{columnList}}
    </sql>

    <insert id="insert" parameterType="{{packageName}}.entity.{{className}}">
        INSERT INTO {{tableName}} (
            {{columnList}}
        )
        VALUES (
            {{#each columns}}
            #{ {{fieldName}},jdbcType={{jdbcType}} }{{#unless @last}},{{/unless}}
            {{/each}}
        )
    </insert>

    <delete id="deleteByPrimaryKey">
        DELETE FROM {{tableName}}
        WHERE {{primaryKeyColumn}} = #{ {{primaryKeyField}},jdbcType={{primaryKeyJdbcType}} }
    </delete>

    <update id="updateByPrimaryKey" parameterType="{{packageName}}.entity.{{className}}">
        UPDATE {{tableName}}
        SET
            {{#each columns}}
            {{^isPrimaryKey}}
            {{columnName}} = #{ {{fieldName}},jdbcType={{jdbcType}} }{{#unless @last}},{{/unless}}
            {{/isPrimaryKey}}
            {{/each}}
        WHERE {{primaryKeyColumn}} = #{ {{primaryKeyField}},jdbcType={{primaryKeyJdbcType}} }
    </update>

    <select id="selectByPrimaryKey" resultMap="BaseResultMap">
        SELECT <include refid="Base_Column_List" />
        FROM {{tableName}}
        WHERE {{primaryKeyColumn}} = #{ {{primaryKeyField}},jdbcType={{primaryKeyJdbcType}} }
    </select>

    <select id="selectAll" resultMap="BaseResultMap">
        SELECT <include refid="Base_Column_List" />
        FROM {{tableName}}
    </select>
</mapper>`;

    // 类型映射配置
    private static jdbcTypeMapping: Record<string, string> = {
        'varchar': 'VARCHAR',
        'char': 'CHAR',
        'text': 'LONGVARCHAR',
        'int': 'INTEGER',
        'bigint': 'BIGINT',
        'tinyint': 'TINYINT',
        'datetime': 'TIMESTAMP',
        'timestamp': 'TIMESTAMP',
        'decimal': 'DECIMAL',
        'boolean': 'BOOLEAN',
        'float': 'FLOAT',
        'double': 'DOUBLE'
    };

    static generateMapper(tableInfo: TableInfo, packageName: string, removePrefix: boolean = false, prefixes: string[] = []): {
        interface: string;
        xml: string;
    } {
        const primaryKey = tableInfo.columns.find(col => col.isPrimaryKey) || tableInfo.columns[0];
        const columnList = tableInfo.columns.map(col => col.columnName).join(', ');
        const className = this.toClassName(tableInfo.tableName, removePrefix, prefixes);

        const templateData = {
            packageName,
            className,
            tableName: tableInfo.tableName,
            primaryKeyType: this.getJavaType(primaryKey.dataType),
            primaryKeyField: this.toCamelCase(primaryKey.columnName),
            primaryKeyColumn: primaryKey.columnName,
            primaryKeyJdbcType: this.jdbcTypeMapping[primaryKey.dataType.toLowerCase()],
            columns: tableInfo.columns.map(col => ({
                columnName: col.columnName,
                fieldName: this.toCamelCase(col.columnName),
                jdbcType: this.jdbcTypeMapping[col.dataType.toLowerCase()],
                isPrimaryKey: col.isPrimaryKey
            })),
            columnList
        };

        return {
            interface: Handlebars.compile(this.interfaceTemplate)(templateData),
            xml: Handlebars.compile(this.xmlTemplate)(templateData)
        };
    }

    static toClassName(tableName: string, removePrefix: boolean = false, prefixes: string[] = []): string {
        let processedName = tableName;
        
        // 调试信息
        console.log(`处理表名: ${tableName}, 移除前缀: ${removePrefix}, 前缀列表: ${prefixes.join(', ')}`);
        
        // 移除前缀
        if (removePrefix && prefixes.length > 0) {
            for (const prefix of prefixes) {
                if (tableName.startsWith(prefix)) {
                    processedName = tableName.substring(prefix.length);
                    console.log(`匹配到前缀 ${prefix}, 移除后: ${processedName}`);
                    break;
                }
            }
        }
        
        // 确保处理后的名称不为空
        if (processedName.length === 0) {
            processedName = tableName;
        }
        
        // 转换为PascalCase
        const result = processedName
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');
        
        console.log(`最终类名: ${result}`);
        return result;
    }

    private static toCamelCase(columnName: string): string {
        return columnName
            .toLowerCase()
            .split('_')
            .map((part, index) => index === 0 ? part : part[0].toUpperCase() + part.slice(1))
            .join('');
    }

    private static getJavaType(dataType: string): string {
        const typeMapping: Record<string, string> = {
            'varchar': 'String',
            'char': 'String',
            'text': 'String',
            'int': 'Integer',
            'bigint': 'Long',
            'tinyint': 'Integer',
            'datetime': 'Date',
            'timestamp': 'Date',
            'decimal': 'BigDecimal',
            'boolean': 'Boolean',
            'float': 'Float',
            'double': 'Double'
        };
        return typeMapping[dataType.toLowerCase()] || 'Object';
    }
}
