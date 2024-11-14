'use strict';

const path = require('path');
const fse = require('fs-extra');
const pkgDir = require('pkg-dir').sync;
const pathExists = require('path-exists').sync;
const npminstall = require('npminstall');
const { isObject } = require('@yzw-cli-dev/utils');
const formatPath = require('@yzw-cli-dev/format-path');
const { getDefaultRegistry, getNpmLatestVersion } = require('@yzw-cli-dev/get-npm-info');

class Package {
  constructor(options) {
    console.log('package options', options)
    if (!options) {
      throw new Error('Package类的options参数不能为空！');
    }
    if (!isObject(options)) {
      throw new Error('Package类的options参数必须为对象！');
    }
    // package的目标路径
    this.targetPath = options.targetPath;
    // 缓存package的路径
    this.storeDir = options.storeDir;
    // package的name
    this.packageName = options.packageName;
    // package的version
    this.packageVersion = options.packageVersion;
    // package的缓存目录前缀
    this.cacheFilePathPrefix = this.packageName.replace('/', '_');
  }

  async prepare() {
    if (this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirpSync(this.storeDir);
    }
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLatestVersion(this.packageName);
    }
  }

  get cacheFilePath() {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`);
  }

  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`);
  }

  // 判断当前Package是否存在
  async exists() {
    if (this.storeDir) {
      console.log('this.cacheFilePath', this.cacheFilePath)
      await this.prepare();
      return pathExists(this.cacheFilePath);
    } else {
      return pathExists(this.targetPath);
    }
  }

  // 安装Package
  async install() {
    await this.prepare();
    console.log('安装this.targetPath', this.targetPath)
    console.log('安装this.storeDir', this.storeDir)
    console.log('安装this.packageName', this.packageName)
    // this.packageVersion = '1.0.9' // init这个包有点奇怪，临时设置版本号
    console.log('安装this.packageVersion', this.packageVersion)
    return npminstall({
      root: this.targetPath, // 模块路径
      storeDir: this.storeDir,
      registry: getDefaultRegistry(true), // init这个包有点奇怪，所以改为临时从官方镜像源中下载
      // registry: getDefaultRegistry(),
      pkgs: [{
        name: this.packageName,
        version: this.packageVersion,
      }],
    });
  }

  // 更新Package
  async update() {
    await this.prepare();
    // 1. 获取最新的npm模块版本号
    const latestPackageVersion = await getNpmLatestVersion(this.packageName);
    console.log('latestPackageVersion', latestPackageVersion)
    // 2. 查询最新版本号对应的路径是否存在
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion);
    // 3. 如果不存在，则直接安装最新版本
    if (!pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(true),
        pkgs: [{
          name: this.packageName,
          version: latestPackageVersion,
        }],
      });
      this.packageVersion = latestPackageVersion;
    } else {
      this.packageVersion = latestPackageVersion;
    }
  }

  // 获取入口文件的路径
  getRootFilePath() {
    function _getRootFile(targetPath) {
      // 1. 获取package.json所在目录
      console.log('package targetPath**', targetPath)
      const dir = pkgDir(targetPath); // 获取package.json所在的目录
      console.log('dir', dir)
      if (dir) {
        // 2. 读取package.json
        const pkgFile = require(path.resolve(dir, 'package.json')); // require可以读取js json node
        console.log('pkgFile', pkgFile)
        // 3. 寻找main/lib
        if (pkgFile && pkgFile.main) {
          // 4. 路径的兼容(macOS/windows)
          return formatPath(path.resolve(dir, pkgFile.main));
        }
      }
      return null;
    }
    if (this.storeDir) {
      return _getRootFile(this.cacheFilePath);
    } else {
      return _getRootFile(this.targetPath);
    }
  }
}

module.exports = Package;
