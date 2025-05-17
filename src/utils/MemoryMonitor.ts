import * as vscode from 'vscode';

export class MemoryMonitor {
    private static interval: NodeJS.Timeout | null = null;
    private static readonly MEMORY_THRESHOLD_MB = 100; // 内存阈值，单位MB
    
    static startMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        
        this.interval = setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            
            if (heapUsedMB > this.MEMORY_THRESHOLD_MB) {
                console.warn(`[Memory Warning] High memory usage: ${heapUsedMB}MB`);
                // 可以在这里添加内存优化逻辑，如清理缓存等
                global.gc && global.gc(); // 如果启用了 --expose-gc
            }
        }, 60000); // 每分钟检查一次
    }
    
    static stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}