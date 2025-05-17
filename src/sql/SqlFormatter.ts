import * as vscode from 'vscode';

export class SqlFormatter {
    /**
     * 将 MyBatis 日志中的 SQL 语句和参数拼接成完整的可执行 SQL
     * @param sqlLog MyBatis 日志文本
     * @returns 拼接后的完整 SQL
     */
    static formatSql(sqlLog: string): string {
        // 提取 SQL 语句部分
        const sqlMatch = sqlLog.match(/Preparing: (.+)/);
        if (!sqlMatch) {
            return "无法识别 SQL 语句，请确保日志包含 'Preparing:' 部分";
        }
        
        let sql = sqlMatch[1].trim();
        
        // 提取参数部分
        const paramsMatch = sqlLog.match(/Parameters: (.+)/);
        if (!paramsMatch) {
            return sql; // 没有参数，直接返回 SQL
        }
        
        const paramsText = paramsMatch[1].trim();
        const params = this.parseParameters(paramsText);
        
        // 替换 SQL 中的问号
        let paramIndex = 0;
        sql = sql.replace(/\?/g, () => {
            if (paramIndex < params.length) {
                return params[paramIndex++];
            }
            return "?";
        });
        
        return sql;
    }
    
    /**
     * 解析 MyBatis 日志中的参数部分
     * @param paramsText 参数文本，如 "1(Integer), 'test'(String), 2023-01-01(Date)"
     * @returns 格式化后的参数数组
     */
    private static parseParameters(paramsText: string): string[] {
        const params: string[] = [];
        let currentParam = "";
        let inQuote = false;
        let inParenthesis = 0;
        
        // 逐字符解析参数
        for (let i = 0; i < paramsText.length; i++) {
            const char = paramsText[i];
            
            if (char === "'" && (i === 0 || paramsText[i-1] !== '\\')) {
                inQuote = !inQuote;
                currentParam += char;
            } else if (char === '(') {
                inParenthesis++;
                currentParam += char;
            } else if (char === ')') {
                inParenthesis--;
                currentParam += char;
            } else if (char === ',' && !inQuote && inParenthesis === 0) {
                // 参数分隔符
                params.push(this.formatParameter(currentParam.trim()));
                currentParam = "";
            } else {
                currentParam += char;
            }
        }
        
        // 添加最后一个参数
        if (currentParam.trim()) {
            params.push(this.formatParameter(currentParam.trim()));
        }
        
        return params;
    }
    
    /**
     * 根据参数类型格式化参数
     * @param param 参数文本，如 "1(Integer)" 或 "'test'(String)"
     * @returns 格式化后的参数
     */
    private static formatParameter(param: string): string {
        // 提取参数值和类型
        const match = param.match(/^(.*?)(?:\((.*?)\))?$/);
        if (!match) return param;
        
        const value = match[1].trim();
        const type = match[2]?.toLowerCase();
        
        // 根据类型格式化参数
        if (type === 'string' || type === 'varchar' || type === 'char') {
            // 确保字符串有引号
            if (value.startsWith("'") && value.endsWith("'")) {
                return value;
            }
            return `'${value}'`;
        } else if (type === 'date' || type === 'timestamp') {
            // 日期类型
            if (value.startsWith("'") && value.endsWith("'")) {
                return value;
            }
            return `'${value}'`;
        } else if (type === 'null') {
            return 'NULL';
        }
        
        // 数字类型或其他类型直接返回值
        return value;
    }
    
    /**
     * 从剪贴板获取 SQL 日志并格式化
     */
    static async formatSqlFromClipboard(): Promise<void> {
        try {
            const text = await vscode.env.clipboard.readText();
            if (!text) {
                vscode.window.showWarningMessage('剪贴板为空');
                return;
            }
            
            const formattedSql = this.formatSql(text);
            
            // 创建新文档显示格式化后的 SQL
            const document = await vscode.workspace.openTextDocument({
                content: formattedSql,
                language: 'sql'
            });
            
            await vscode.window.showTextDocument(document);
            
            // 复制到剪贴板
            await vscode.env.clipboard.writeText(formattedSql);
            vscode.window.showInformationMessage('SQL 已格式化并复制到剪贴板');
        } catch (error) {
            vscode.window.showErrorMessage(`格式化 SQL 失败: ${(error as Error).message}`);
        }
    }
}