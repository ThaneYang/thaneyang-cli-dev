#! /usr/bin/env node

console.log('运行成功', __filename)

const importLocal = require('import-local');

// importLocal优先执行本地命令
if (importLocal(__filename)) {
  // 比如在根目录npm install @yzw-cli-dev/core，则会执行到这里
  require('npmlog').info('cli', '正在使用 imooc-cli 本地版本');
} else {
  require('../lib')(process.argv.slice(2)); // 从第3位参数开始传
}
