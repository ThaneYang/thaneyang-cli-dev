'use strict';

const path = require('path');
const Package = require('@yzw-cli-dev/package');
const log = require('@yzw-cli-dev/log');
const { exec: spawn } = require('@yzw-cli-dev/utils');

const SETTINGS = {
  init: '@yzw-cli-dev/init', // 当不传targetpath，则可以在这里配置，不同的命令下载不同的包
};

const CACHE_DIR = 'dependencies';

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH;
  const homePath = process.env.CLI_HOME_PATH;
  let storeDir = '';
  let pkg;
  log.verbose('targetPath1', targetPath);
  // log.verbose('homePath', homePath); // /Users/mac/.yzw-cli-dev

  const cmdObj = arguments[arguments.length - 1];
  // console.log('cmdObj', cmdObj)
  const cmdName = cmdObj.name();
  // console.log('cmdName', cmdName)
  const packageName = SETTINGS[cmdName];
  const packageVersion = 'latest';

  if (!targetPath) {
    // 传了说明是本地路径
    targetPath = path.resolve(homePath, CACHE_DIR); // 生成缓存路径
    storeDir = path.resolve(targetPath, 'node_modules');
    log.verbose('targetPath2', targetPath);
    log.verbose('storeDir', storeDir);
    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion,
    });
    // console.log('pkg', pkg)
    if (await pkg.exists()) {
      log.verbose('更新package');
      // 更新package
      await pkg.update();
    } else {
      // 安装package
      log.verbose('安装package');
      await pkg.install();
    }
  } else {
    log.verbose('targetPath3', targetPath);
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion,
    });
  }
  const rootFile = pkg.getRootFilePath();
  log.verbose('rootFile', rootFile);
  // log.verbose('arguments', arguments);
  if (rootFile) {
    try {
      // 在当前进程中调用

      // require(rootFile).call(null, Array.from(arguments));
      // 在node子进程中调用
      const args = Array.from(arguments);
      const cmd = args[args.length - 1];
      // log.verbose('cmd', cmd); // --force 可以拿到cmd.force
      // log.verbose('cmd name', cmd.name()); // 拿到命令名称
      const o = Object.create(null);
      Object.keys(cmd).forEach(key => {
        if (cmd.hasOwnProperty(key) &&
          !key.startsWith('_') &&
          key !== 'parent') {
          o[key] = cmd[key];
        }
      });
      args[args.length - 1] = o;
      // 通过targetPath传入的包地址，拿到可执行的入口文件index.js，通过require()的形式来执行
      const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`;
      console.log('code', code)
      const child = spawn('node', ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      child.on('error', e => {
        log.error(e.message);
        process.exit(1);
      });
      child.on('exit', e => {
        log.verbose('命令执行成功:' + e);
        process.exit(e);
      });
    } catch (e) {
      log.error(e.message);
    }
  }
}

module.exports = exec;
