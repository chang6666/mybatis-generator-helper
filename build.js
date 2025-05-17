const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// TypeScript 编译器路径
const tscPath = path.join(__dirname, 'node_modules', '.bin', 'tsc');

try {
  // 检查 tsc 是否存在
  fs.accessSync(tscPath, fs.constants.X_OK);
  console.log('找到 TypeScript 编译器:', tscPath);
  
  // 运行 TypeScript 编译器
  console.log('正在编译 TypeScript...');
  execSync(`"${tscPath}" -p ./`, { stdio: 'inherit' });
  
  console.log('编译成功!');
} catch (error) {
  console.error('编译过程中出错:', error.message);
  process.exit(1);
}