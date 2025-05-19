import * as mysql from 'mysql2/promise';
import { DatabaseConfig } from '../config/DatabaseConfig';


export interface TableColumn {
    columnName: string;
    dataType: string;
    columnComment: string;
    isPrimaryKey: boolean;
}

export interface TableInfo {
    tableName: string;
    tableComment: string;
    columns: TableColumn[];
}

export class DatabaseService {
    private static pool: mysql.Pool | null = null;
    private connection: mysql.PoolConnection | null = null;

    static async initializePool(config: DatabaseConfig): Promise<void> {
        if (this.pool) await this.pool.end(); // 确保关闭旧连接池
        this.pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            connectionLimit: 1, // 减少到 1
            maxIdle: 0,         // 空闲连接数为 0
            idleTimeout: 3000,  // 更短的空闲超时时间
            enableKeepAlive: false, // 关闭保持连接
            queueLimit: 1       // 最大排队请求减少
        });
    }

    async connect(): Promise<void> {
        if (!DatabaseService.pool) {
            throw new Error('Pool not initialized. Please provide database configuration.');
        }
        
        if (this.connection) {
            await this.disconnect();
        }
        
        this.connection = await DatabaseService.pool.getConnection();
    }

    async getTableInfo(tableName: string): Promise<TableInfo> {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        // 获取表信息
        const [tableInfoRows] = await this.connection.execute(
            'SELECT TABLE_COMMENT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
            [this.connection.config.database, tableName]
        );

        // 获取列信息，包括主键信息
        const [columnsRows] = await this.connection.execute(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                COLUMN_COMMENT,
                COLUMN_KEY
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION`,
            [this.connection.config.database, tableName]
        );

        return {
            tableName,
            tableComment: (tableInfoRows as any[])[0]?.TABLE_COMMENT || '',
            columns: (columnsRows as any[]).map(row => ({
                columnName: row.COLUMN_NAME,
                dataType: row.DATA_TYPE,
                columnComment: row.COLUMN_COMMENT,
                isPrimaryKey: row.COLUMN_KEY === 'PRI'
            }))
        };
    }

    async getAllTables(): Promise<string[]> {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        const [rows] = await this.connection.execute(
            'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
            [this.connection.config.database]
        );

        return (rows as any[]).map(row => row.TABLE_NAME);
    }

    async disconnect(): Promise<void> {
        if (this.connection) {
            this.connection.release();
            this.connection = null;
        }
    }

    static async closePool(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}
