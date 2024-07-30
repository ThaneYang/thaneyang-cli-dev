#! /usr/bin/env node

console.log('运行成功', __filename)

const importLocal = require('import-local');

if (importLocal(__filename)) {
  require('npmlog').info('cli', '正在使用 imooc-cli 本地版本');
} else {
  require('../lib')(process.argv.slice(2));
}
