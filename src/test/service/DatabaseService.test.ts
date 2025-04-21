import * as assert from 'assert';
import { DatabaseConfig } from '../../config/DatabaseConfig';
import { DatabaseService } from '../../service/DatabaseService';

suite('DatabaseService Test Suite', () => {
    const testConfig: DatabaseConfig = {
        host: 'localhost',
        port: 3306,
        user: 'test_user',
        password: 'test_password',
        database: 'test_db'
    };

    let service: DatabaseService;

    setup(async () => {
        service = new DatabaseService();
        await DatabaseService.initializePool(testConfig);
    });

    test('Connection Success Test', async () => {
        try {
            await service.connect();
            assert.ok(true, 'Connection should succeed');
        } catch (error) {
            assert.fail('Connection should not throw error');
        } finally {
            await service.disconnect();
        }
    });

    test('Invalid Connection Test', async () => {
        const invalidConfig: DatabaseConfig = {
            ...testConfig,
            host: 'invalid_host'
        };

        // Reset pool with invalid config
        await DatabaseService.closePool();
        await DatabaseService.initializePool(invalidConfig);

        try {
            await service.connect();
            assert.fail('Should throw error for invalid connection');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('connect'));
        } finally {
            // Reset pool back to valid config for other tests
            await DatabaseService.closePool();
            await DatabaseService.initializePool(testConfig);
        }
    });

    test('Get All Tables Test', async () => {
        try {
            await service.connect();
            const tables = await service.getAllTables();
            assert.ok(Array.isArray(tables));
        } finally {
            await service.disconnect();
        }
    });

    test('Get Table Info Test', async () => {
        try {
            await service.connect();
            const tableInfo = await service.getTableInfo('test_table');
            assert.ok(tableInfo);
            assert.ok(Array.isArray(tableInfo.columns));
            assert.equal(typeof tableInfo.tableName, 'string');
            assert.equal(typeof tableInfo.tableComment, 'string');
        } finally {
            await service.disconnect();
        }
    });

    test('Disconnect Test', async () => {
        await service.connect();
        await service.disconnect();
        // Try to execute a query after disconnect should throw error
        try {
            await service.getAllTables();
            assert.fail('Should throw error after disconnect');
        } catch (error) {
            assert.ok(error instanceof Error);
        }
    });

    test('Reconnect Test', async () => {
        try {
            await service.connect();
            await service.disconnect();
            await service.connect();
            const tables = await service.getAllTables();
            assert.ok(Array.isArray(tables), 'Reconnect should allow queries');
        } finally {
            await service.disconnect();
        }
    });

    test('Empty Database Test', async () => {
        const emptyDbConfig: DatabaseConfig = {
            ...testConfig,
            database: 'empty_db'
        };

        try {
            await service.connect();
            const tables = await service.getAllTables();
            assert.ok(Array.isArray(tables));
            assert.equal(tables.length, 0, 'Empty database should have no tables');
        } finally {
            await service.disconnect();
        }
    });

    test('Invalid Table Info Test', async () => {
        try {
            await service.connect();
            const tableInfo = await service.getTableInfo('non_existent_table');
            assert.ok(tableInfo);
            assert.equal(tableInfo.columns.length, 0, 'Non-existent table should have no columns');
        } finally {
            await service.disconnect();
        }
    });

    test('Multiple Connections Test', async () => {
        const anotherService = new DatabaseService();
        try {
            await service.connect();
            await anotherService.connect();
            const tables1 = await service.getAllTables();
            const tables2 = await anotherService.getAllTables();
            assert.deepStrictEqual(tables1, tables2, 'Both connections should return the same tables');
        } finally {
            await service.disconnect();
            await anotherService.disconnect();
        }
    });

    teardown(async () => {
        await DatabaseService.closePool();
    });
});
