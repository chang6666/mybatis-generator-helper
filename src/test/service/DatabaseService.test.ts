import * as assert from 'assert';
import { DatabaseService } from '../../service/DatabaseService';
import { DatabaseConfig } from '../../config/DatabaseConfig';

suite('DatabaseService Test Suite', () => {
    const testConfig: DatabaseConfig = {
        host: 'localhost',
        port: 3306,
        user: 'test_user',
        password: 'test_password',
        database: 'test_db'
    };

    let service: DatabaseService;

    setup(() => {
        service = new DatabaseService();
    });

    test('Connection Success Test', async () => {
        try {
            await service.connect(testConfig);
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

        try {
            await service.connect(invalidConfig);
            assert.fail('Should throw error for invalid connection');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('connect'));
        }
    });

    test('Get All Tables Test', async () => {
        try {
            await service.connect(testConfig);
            const tables = await service.getAllTables();
            assert.ok(Array.isArray(tables));
        } finally {
            await service.disconnect();
        }
    });

    test('Get Table Info Test', async () => {
        try {
            await service.connect(testConfig);
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
        await service.connect(testConfig);
        await service.disconnect();
        // Try to execute a query after disconnect should throw error
        try {
            await service.getAllTables();
            assert.fail('Should throw error after disconnect');
        } catch (error) {
            assert.ok(error instanceof Error);
        }
    });
});