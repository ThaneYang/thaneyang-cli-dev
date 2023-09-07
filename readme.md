通过lerna创建package
lerna create utils
修改packages.json里的name为"name": "@thaneyang-cli-dev/core"
lerna create core
修改packages.json里的name为"name": "@thaneyang-cli-dev/utils"

在npm上要创建@thaneyang-cli-dev组织







npm login
登录npm 账号

npm publish
发布包

npm i -g thaneyang-cli-dev
全局安装包

thaneyang-cli-dev
运行包

## 全局的node_modules在哪里
在/usr/local/lib/node_modules/下

which thaneyang-cli-dev
-> /usr/local/bin/thaneyang-cli-dev

ll /usr/local/bin/thaneyang-cli-dev
-> /usr/local/bin/thaneyang-cli-dev -> ../lib/node_modules/thaneyang-cli-dev/packages/core/bin/index.js

安装到了lib目录下node_modules
cd /usr/local/bin
cd ..
cd lib

移除脚手架
npm remove -g thaneyang-cli-dev



## 创建本地脚手架调试模式
进入本地目录，执行npm link

/usr/local/bin/thaneyang-cli-dev -> /usr/local/lib/node_modules/thaneyang-cli-dev/packages/core/bin/index.js
就会在本地node bin中创建一个命令thaneyang-cli-dev，这个命令指向后面的地址，因为项目中package.json中设置了bin参数

/usr/local/lib/node_modules/thaneyang-cli-dev -> /Users/yzw/test-projects2023/thaneyang-cli-dev
而node_modules中的thaneyang-cli-dev又指向了我们实际的项目地址

## 本地项目thaneyang-cli-dev引用本地另外的包thaneyang-cli-dev-other
假设有另一个包thaneyang-cli-dev-other
先进入thaneyang-cli-dev-other项目
package.json
{
  "main": "lib/index.js" // 指定到执行的库文件
}
执行npm link
将这个包安装到全局

再进入要引用这个包的本地项目
执行npm link thaneyang-cli-dev-other
-->返回
/Users/yzw/test-projects2023/thaneyang-cli-dev/node_modules/thaneyang-cli-dev-other -> /usr/local/lib/node_modules/thaneyang-cli-dev-other -> /Users/yzw/test-projects2023/thaneyang-cli-dev-other
最终node_modules里的包，指向了我本地的这个项目

ll node_modules
也是返回同样的结果


### 如果thaneyang-cli-dev-other项目要发布到npm
先进入本项目thaneyang-cli-dev中
执行npm unlink thaneyang-cli-dev-other
将thaneyang-cli-dev-other从本项目中的node_modules中去除
但是这个可能会报错，如果先把thaneyang-cli-dev-other从全局中移除了，则会报错
此时，需要执行rm -rf node_modules

再进入thaneyang-cli-dev-other中
npm unlink
将thaneyang-cli-dev-other从全局node_modules中去除

再进入本项目thaneyang-cli-dev中执行
npm i -S thaneyang-cli-dev-other
来安装这个包


