'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const glob = require('glob');
const ejs = require('ejs');
const semver = require('semver');
const userHome = require('user-home');
const Command = require('@yzw-cli-dev/command');
const Package = require('@yzw-cli-dev/package');
const log = require('@yzw-cli-dev/log');
const { spinnerStart, sleep, execAsync } = require('@yzw-cli-dev/utils');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMAND = ['npm', 'cnpm'];

// 这里继承了@yzw-cli-dev/command，也就是models/command/index.js，所以会先执行init再执行exec
class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this._cmd.force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }

  async exec() {
    log.verbose('exec***');
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare();
      if (projectInfo) {
        // 2. 下载模板
        log.verbose('projectInfo', projectInfo);
        this.projectInfo = projectInfo;
        await this.downloadTemplate();
        // 3. 安装模板
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        // debugger模式下打印出错误
        console.log(e);
      }
    }
  }

  async installTemplate() {
    log.verbose('templateInfo', this.templateInfo);
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        // 标准安装
        await this.installNormalTemplate();
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装
        await this.installCustomTemplate();
      } else {
        throw new Error('无法识别项目模板类型！');
      }
    } else {
      throw new Error('项目模板信息不存在！');
    }
  }

  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd;
    }
    return null;
  }

  async execCommand(command, errMsg) {
    let ret;
    if (command) {
      const cmdArray = command.split(' ');
      const cmd = this.checkCommand(cmdArray[0]);
      if (!cmd) {
        throw new Error('命令不存在！命令：' + command);
      }
      const args = cmdArray.slice(1);
      // npm ['install']
      ret = await execAsync(cmd, args, {
        stdio: 'inherit', // 在子进程中执行，在主进程中打印
        cwd: process.cwd(),
      });
    }
    if (ret !== 0) {
      throw new Error(errMsg);
    }
    return ret;
  }

  async ejsRender(options) {
    const dir = process.cwd();
    const projectInfo = this.projectInfo;
    log.verbose('ejsRender projectInfo', projectInfo);
    log.verbose('ejsRender options', options);
    return new Promise((resolve, reject) => {
      // 通过glob获取所有文件
      glob('**', {
        cwd: dir,
        ignore: options.ignore || '',
        nodir: true, // 不包含文件夹，只返回文件
      }, function (err, files) {
        if (err) {
          reject(err);
        }

        // 使用glob找.env文件
        glob('./**/.env', {}, function (err, files2) {
          // 假设我们只有一个.env文件或者你知道确切的文件路径
          if (files2 && files2.length > 0) {
            const envFilePath = files2[0]; // 或者直接指定路径，例如 path.join(__dirname, '.env')
            log.verbose('Found .env file at:', envFilePath);
            log.verbose('files', files.length);
            files.push(envFilePath)
            log.verbose('files', files.length);
          } else {
            log.verbose('No .env file found.');
          }

          Promise.all(files.map(file => {
            const filePath = path.join(dir, file);
            return new Promise((resolve1, reject1) => {
              // 通过ejs进行渲染
              ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
                if (err) {
                  // console.log(1, file)
                  reject1(err);
                } else {
                  // console.log(2, file)
                  // 这一步很重要，还需要重新写入才生效
                  fse.writeFileSync(filePath, result);
                  resolve1(result);
                }
              });
            });
          })).then(() => {
            resolve();
          }).catch(err => {
            reject(err);
          });

        });
      });
    });
  }

  async installNormalTemplate() {
    log.verbose('templateNpm', this.templateNpm);
    // 拷贝模板代码至当前目录
    let spinner = spinnerStart('正在安装模板...');
    await sleep();
    try {
      const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
      log.verbose('templatePath', this.templatePath);
      const targetPath = process.cwd();
      log.verbose('targetPath', targetPath);
      fse.ensureDirSync(templatePath); // 确保目录存在
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
    } catch (e) {
      throw e;
    } finally {
      spinner.stop(true);
      log.success('模板安装成功');
    }
    const templateIgnore = this.templateInfo.ignore || [];
    const ignore = ['**/node_modules/**', ...templateIgnore];
    log.verbose('ignore', ignore)
    await this.ejsRender({ ignore });
    const { installCommand, startCommand } = this.templateInfo;
    // 依赖安装
    await this.execCommand(installCommand, '依赖安装失败！');
    // 启动命令执行
    await this.execCommand(startCommand, '启动执行命令失败！');
  }

  async installCustomTemplate() {
    // 查询自定义模板的入口文件
    if (await this.templateNpm.exists()) {
      // 入口文件
      const rootFile = this.templateNpm.getRootFilePath();
      if (fs.existsSync(rootFile)) {
        // 入口文件存在
        log.notice('开始执行自定义模板');
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: process.cwd(),
        };
        const code = `require('${rootFile}')(${JSON.stringify(options)})`;
        log.verbose('code', code);
        // 通过node -e来执行
        await execAsync('node', ['-e', code], { stdio: 'inherit', cwd: process.cwd() });
        log.success('自定义模板安装成功');
      } else {
        throw new Error('自定义模板入口文件不存在！');
      }
    }
  }

  async downloadTemplate() {
    const { projectTemplate } = this.projectInfo;
    const templateInfo = this.template.find(item => item.npmName === projectTemplate);
    const targetPath = path.resolve(userHome, '.yzw-cli-dev', 'template');
    const storeDir = path.resolve(userHome, '.yzw-cli-dev', 'template', 'node_modules');
    const { npmName, version } = templateInfo;
    this.templateInfo = templateInfo;
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version,
    });
    if (!await templateNpm.exists()) {
      const spinner = spinnerStart('正在下载模板...');
      await sleep();
      try {
        await templateNpm.install();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('下载模板成功');
          this.templateNpm = templateNpm;
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模板...');
      await sleep();
      try {
        await templateNpm.update();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('更新模板成功');
          this.templateNpm = templateNpm;
        }
      }
    }
  }

  async prepare() {
    // 0. 判断项目模板是否存在
    const template = await getProjectTemplate();
    log.verbose('template', template);
    if (!template || template.length === 0) {
      throw new Error('项目模板不存在');
    }
    this.template = template;
    // 1. 判断当前目录是否为空
    const localPath = process.cwd();
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false;
      if (!this.force) {
        // 询问是否继续创建
        ifContinue = (await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空，是否继续创建项目？',
        })).ifContinue;
        if (!ifContinue) {
          return;
        }
      }
      // 2. 是否启动强制更新
      if (ifContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？',
        });
        if (confirmDelete) {
          // 清空当前目录
          fse.emptyDirSync(localPath);
        }
      }
    }
    return this.getProjectInfo();
  }

  async getProjectInfo() {
    function isValidName(v) {
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v);
    }

    let projectInfo = {};
    let isProjectNameValid = false;
    if (isValidName(this.projectName)) {
      isProjectNameValid = true;
      projectInfo.projectName = this.projectName;
    }
    // 1. 选择创建项目或组件
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [{
        name: '项目',
        value: TYPE_PROJECT,
      }, {
        name: '组件',
        value: TYPE_COMPONENT,
      }],
    });
    log.verbose('type', type);
    this.template = this.template.filter(template =>
      template.tag.includes(type));
    const title = type === TYPE_PROJECT ? '项目' : '组件';
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function (v) {
        const done = this.async();
        setTimeout(function () {
          // 1.首字符必须为英文字符
          // 2.尾字符必须为英文或数字，不能为字符
          // 3.字符仅允许"-_"
          if (!isValidName(v)) {
            done(`请输入合法的${title}名称`);
            return;
          }
          done(null, true);
        }, 0);
      },
      filter: function (v) {
        return v;
      },
    };
    const projectPrompt = [];
    if (!isProjectNameValid) {
      projectPrompt.push(projectNamePrompt);
    }
    projectPrompt.push({
      type: 'input',
      name: 'projectVersion',
      message: `请输入${title}版本号`,
      default: '1.0.0',
      validate: function (v) {
        const done = this.async();
        setTimeout(function () {
          if (!(!!semver.valid(v))) {
            done('请输入合法的版本号');
            return;
          }
          done(null, true);
        }, 0);
      },
      filter: function (v) {
        if (!!semver.valid(v)) {
          return semver.valid(v);
        } else {
          return v;
        }
      },
    },
      {
        type: 'input',
        name: 'projectChineseName',
        message: `请输入${title}中文名称`,
        default: '后台管理系统',
        filter: function (v) {
          return v;
        },
      },
      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${title}模板`,
        choices: this.createTemplateChoice(),
      });
    if (type === TYPE_PROJECT) {
      // 2. 获取项目的基本信息
      const project = await inquirer.prompt(projectPrompt);
      projectInfo = {
        ...projectInfo,
        type,
        ...project,
      };
    } else if (type === TYPE_COMPONENT) {
      const descriptionPrompt = {
        type: 'input',
        name: 'componentDescription',
        message: '请输入组件描述信息',
        default: '',
        validate: function (v) {
          const done = this.async();
          setTimeout(function () {
            if (!v) {
              done('请输入组件描述信息');
              return;
            }
            done(null, true);
          }, 0);
        },
      };
      projectPrompt.push(descriptionPrompt);
      // 2. 获取组件的基本信息
      const component = await inquirer.prompt(projectPrompt);
      projectInfo = {
        ...projectInfo,
        type,
        ...component,
      };
    }
    // 生成classname
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName;
      // AbcDef -> abc-def
      projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '');
    }
    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion;
    }
    if (projectInfo.projectChineseName) {
      projectInfo.projectChineseName = projectInfo.projectChineseName;
    }
    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription;
    }
    return projectInfo;
  }

  /*************  ✨ Codeium Command ⭐  *************/
  /**
   * Checks if the specified directory is empty.
   * 
   * This function reads the contents of the directory at the given path,
   * filters out hidden files (files starting with a dot) and the 'node_modules' directory,
   * and then determines if there are any remaining files.
   * 
   * @param {string} localPath - The path to the directory to check.
   * @returns {boolean} - Returns true if the directory is empty (excluding hidden files and 'node_modules'); otherwise, false.
   */

  /******  66ea9845-089a-4273-80ca-3be11e8f0d25  *******/
  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath);
    // 文件过滤的逻辑
    fileList = fileList.filter(file => (
      !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
    ));
    return !fileList || fileList.length <= 0;
  }

  createTemplateChoice() {
    return this.template.map(item => ({
      value: item.npmName,
      name: item.name,
    }));
  }
}

function init(argv) {
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
