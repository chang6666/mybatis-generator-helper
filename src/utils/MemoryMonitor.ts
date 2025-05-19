import * as vscode from 'vscode';

export class MemoryMonitor {
    private static interval: NodeJS.Timeout | null = null;
    private static readonly MEMORY_THRESHOLD_MB = 100; // 提高默认阈值
    private static memoryUsageHistory: number[] = []; // 存储历史内存使用记录
    private static lastOptimizationTime = 0; // 上次优化时间
    private static readonly OPTIMIZATION_INTERVAL = 15 * 1000; // 15秒优化间隔
    private static readonly CRITICAL_THRESHOLD_MB = 200; // 提高临界阈值
    private static emergencyOptimizationCount = 0; // 紧急优化计数
    private static readonly MAX_MEMORY_ALLOWED = 300; // 提高最大允许内存
    private static readonly HEAP_DUMP_THRESHOLD = 500; // 触发堆转储的阈值
    private static heapDumpTaken = false; // 是否已经生成堆转储

    
    
    static startMonitoring(thresholdMB?: number) {
        if (this.interval) {
            clearInterval(this.interval);
        }
        
        // 允许自定义阈值
        const threshold = thresholdMB || this.MEMORY_THRESHOLD_MB;
        
        // 立即执行一次内存检查和优化
        this.checkAndOptimizeMemory(threshold);
        
        // 设置更频繁的检查
        this.interval = setInterval(() => {
            this.checkAndOptimizeMemory(threshold);
        }, 5000); // 每5秒检查一次
        
        // 定期强制执行优化，不管内存使用情况如何
        setInterval(() => {
            this.optimizeMemory(true);
        }, 60000); // 每分钟强制优化一次
    }
    
    private static checkAndOptimizeMemory(threshold: number) {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const rss = Math.round(memoryUsage.rss / 1024 / 1024);
        
        // 记录历史数据
        this.memoryUsageHistory.push(heapUsedMB);
        if (this.memoryUsageHistory.length > 10) { // 保留更多历史记录用于趋势分析
            this.memoryUsageHistory.shift();
        }
        
        // 检测内存增长趋势
        const isGrowing = this.detectMemoryGrowthTrend();
        
        // 如果内存使用超过最大允许值，尝试重启整个扩展
        if (heapUsedMB > this.MAX_MEMORY_ALLOWED) {
            console.error(`[Memory Critical] Memory usage exceeds maximum allowed: ${heapUsedMB}MB`);
            this.attemptExtensionRestart();
            return;
        }
        
        // 如果内存使用超过堆转储阈值且尚未生成堆转储，尝试生成堆转储（仅开发环境）
        if (heapUsedMB > this.HEAP_DUMP_THRESHOLD && !this.heapDumpTaken) {
            this.tryTakeHeapSnapshot();
        }
        
        // 紧急情况：内存使用超过临界值，立即执行紧急优化
        if (heapUsedMB > this.CRITICAL_THRESHOLD_MB) {
            console.warn(`[Memory Critical] Extremely high memory usage: ${heapUsedMB}MB (RSS: ${rss}MB)`);
            this.emergencyOptimization();
            this.emergencyOptimizationCount++;
            this.lastOptimizationTime = Date.now();
            return;
        }
        
        // 如果内存使用超过阈值或持续增长，自动优化
        if (heapUsedMB > threshold || (isGrowing && heapUsedMB > threshold * 0.5)) {
            console.warn(`[Memory Warning] High memory usage: ${heapUsedMB}MB (RSS: ${rss}MB), growth trend: ${isGrowing}`);
            
            // 避免过于频繁的优化
            const now = Date.now();
            if (now - this.lastOptimizationTime > this.OPTIMIZATION_INTERVAL) {
                // 根据内存使用情况决定优化级别
                const aggressive = heapUsedMB > threshold * 1.2;
                this.optimizeMemory(aggressive);
                this.lastOptimizationTime = now;
            }
        }
        
        // 如果连续进行了多次紧急优化，重启服务
        if (this.emergencyOptimizationCount >= 2) {
            this.restartServices();
            this.emergencyOptimizationCount = 0;
        }
    }
    
    // 尝试生成堆转储（仅在开发环境中有效）
    private static tryTakeHeapSnapshot() {
        try {
            console.warn('[Memory Debug] Attempting to take heap snapshot');
            // 在开发环境中，可以使用 v8-profiler 或类似工具生成堆转储
            // 这里只是记录一个标记，避免重复尝试
            this.heapDumpTaken = true;
        } catch (e) {
            console.error('Failed to take heap snapshot:', e);
        }
    }
    
    // 尝试重启扩展（不再重启整个窗口）
    private static attemptExtensionRestart() {
        try {
            console.warn('[Memory Critical] Memory usage exceeds maximum allowed, cleaning up resources');
            // 不再重启整个窗口，只清理资源
            this.emergencyOptimization();
            this.clearAllCaches();
            this.releaseUnusedResources();
        } catch (e) {
            console.error('Failed to clean up resources:', e);
        }
    }
    
    // 更精确地检测内存增长趋势
    private static detectMemoryGrowthTrend(): boolean {
        if (this.memoryUsageHistory.length < 5) return false;
        
        // 获取最近的5个样本
        const recent = this.memoryUsageHistory.slice(-5);
        
        // 计算线性回归斜率
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < recent.length; i++) {
            sumX += i;
            sumY += recent[i];
            sumXY += i * recent[i];
            sumX2 += i * i;
        }
        
        const n = recent.length;
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        
        // 如果斜率为正且足够大，则认为内存在增长
        return slope > 1.0;
    }
    
    static stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.memoryUsageHistory = [];
        this.emergencyOptimizationCount = 0;
        this.heapDumpTaken = false;
    }
    
    static optimizeMemory(aggressive = false) {
        console.log(`[Memory] Optimizing memory usage (aggressive: ${aggressive})`);
        
        // 尝试强制垃圾回收
        if (global.gc) {
            try {
                global.gc();
                // 对于严重的内存问题，执行多次GC
                if (aggressive) {
                    setTimeout(() => global.gc && global.gc(), 200);
                    setTimeout(() => global.gc && global.gc(), 400);
                    setTimeout(() => global.gc && global.gc(), 600);
                }
            } catch (e) {
                console.error('GC error:', e);
            }
        }
        
        // 清理各种缓存
        this.clearAllCaches();
        
        // 如果是激进优化，执行更多清理
        if (aggressive) {
            this.aggressiveOptimization();
        }
        
        return this.getMemoryUsage();
    }
    
    // 紧急内存优化 - 用于处理严重的内存问题
    private static emergencyOptimization() {
        console.warn('[Memory Emergency] Performing emergency memory optimization');
        
        // 执行所有可能的优化措施
        this.aggressiveOptimization();
        
        // 多次强制GC
        if (global.gc) {
            try {
                for (let i = 0; i < 10; i++) {
                    setTimeout(() => global.gc && global.gc(), i * 100);
                }
            } catch (e) {}
        }
        
        // 清理所有可能的缓存和大对象
        this.clearAllCaches();
        
        // 尝试释放更多内存
        this.releaseUnusedResources();
    }
    
    // 释放未使用的资源
    private static releaseUnusedResources() {
        try {
            // 关闭所有数据库连接
            try {
                const DatabaseService = require('../service/DatabaseService').DatabaseService;
                DatabaseService.closePool();
            } catch (e) {}
            
            // 不要关闭所有WebView，这可能导致循环重启
            // 只关闭明确由我们扩展创建的WebView
            try {
                const DatabaseConfigPanel = require('../webview/DatabaseConfigPanel').DatabaseConfigPanel;
                if (DatabaseConfigPanel.getCurrentPanel) {
                    DatabaseConfigPanel.disposePanel();
                }
                
                const SqlConsoleViewProvider = require('../sql/SqlConsoleViewProvider').SqlConsoleViewProvider;
                const provider = SqlConsoleViewProvider.getInstance && SqlConsoleViewProvider.getInstance();
                if (provider && provider.dispose) {
                    provider.dispose();
                }
            } catch (e) {}
            
            // 清理其他资源...
        } catch (e) {
            console.error('Error releasing resources:', e);
        }
    }
    
    // 清理所有可能的缓存
    private static clearAllCaches() {
        try {
            // 清理模板缓存
            try {
                const TemplateManager = require('../generator/TemplateManager').TemplateManager;
                TemplateManager.clearCache();
            } catch (e) {}
            
            // 清理日志
            try {
                const Logger = require('../utils/Logger').Logger;
                Logger.clear();
            } catch (e) {}
            
            // 清理数据库连接池
            try {
                const DatabaseService = require('../service/DatabaseService').DatabaseService;
                DatabaseService.closePool();
            } catch (e) {}
            
            // 清理WebView
            try {
                const DatabaseConfigPanel = require('../webview/DatabaseConfigPanel').DatabaseConfigPanel;
                if (DatabaseConfigPanel.getCurrentPanel) {
                    DatabaseConfigPanel.disposePanel();
                }
            } catch (e) {}
            
            // 清理SQL控制台
            try {
                const SqlConsoleViewProvider = require('../sql/SqlConsoleViewProvider').SqlConsoleViewProvider;
                const provider = SqlConsoleViewProvider.getInstance && SqlConsoleViewProvider.getInstance();
                if (provider && provider.dispose) {
                    provider.dispose();
                }
            } catch (e) {}
        } catch (e) {
            console.error('Error clearing caches:', e);
        }
    }
    
    private static aggressiveOptimization() {
        // 清理不必要的大对象引用
        try {
            // 尝试关闭数据库连接池
            try {
                const DatabaseService = require('../service/DatabaseService').DatabaseService;
                DatabaseService.closePool();
            } catch (e) {}
            
            // 清理可能的WebView实例
            try {
                const DatabaseConfigPanel = require('../webview/DatabaseConfigPanel').DatabaseConfigPanel;
                if (DatabaseConfigPanel.getCurrentPanel) {
                    DatabaseConfigPanel.disposePanel();
                }
            } catch (e) {}
            
            // 清理SQL控制台
            try {
                const SqlConsoleViewProvider = require('../sql/SqlConsoleViewProvider').SqlConsoleViewProvider;
                const provider = SqlConsoleViewProvider.getInstance && SqlConsoleViewProvider.getInstance();
                if (provider && provider.dispose) {
                    provider.dispose();
                }
            } catch (e) {}
            
            // 清理其他可能的缓存
            global.gc && global.gc();
        } catch (e) {
            console.error('Error during aggressive optimization:', e);
        }
    }
    
    // 重启关键服务
    private static restartServices() {
        console.warn('[Memory Critical] Restarting services due to persistent memory issues');
        
        try {
            // 关闭并重新初始化数据库服务
            try {
                const DatabaseService = require('../service/DatabaseService').DatabaseService;
                DatabaseService.closePool();
                // 数据库服务会在下次需要时重新初始化
            } catch (e) {}
            
            // 重置其他可能的服务状态
            try {
                const vscode = require('vscode');
                vscode.commands.executeCommand('workbench.action.closeAllEditors');
            } catch (e) {}
        } catch (e) {
            console.error('Error restarting services:', e);
        }
    }
    
    static getMemoryUsage(): {current: number, rss: number, average: number, max: number} {
        const memoryUsage = process.memoryUsage();
        const currentMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
        
        // 计算平均值和最大值
        const history = this.memoryUsageHistory.length > 0 ? this.memoryUsageHistory : [currentMB];
        const average = Math.round(history.reduce((sum, val) => sum + val, 0) / history.length);
        const max = Math.max(...history);
        
        return {current: currentMB, rss: rssMB, average, max};
    }
}
