#! /usr/bin/env node

console.log('运行成功2', __filename)

// 先执行到全局的lerna里面
const importLocal = require('import-local');

// 如果本地存在脚手架命令，全局也存在同样的脚手架命令，importLocal能优先执行本地脚手架命令
// __filename就是which lerna，/Users/mac/.nvm/versions/node/v14.21.3/bin/lerna
// 也就是软链接的地址/Users/mac/.nvm/versions/node/v14.21.3/bin/lerna -> ../lib/node_modules/lerna/cli.js
// 最后会执行到这里
if (importLocal(__filename)) {
  require('npmlog').info('cli', '正在使用 thaneyang-cli-dev 本地版本');
} else {
  require('../lib')(process.argv.slice(2)); // 从第3位参数开始传
}
