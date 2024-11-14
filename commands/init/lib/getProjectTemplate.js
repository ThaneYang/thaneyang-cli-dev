const request = require('@yzw-cli-dev/request');

module.exports = function () {
  // return request({
  //   url: '/project/template',
  // });
  // 因为没有服务器，临时改为代码写死
  return Promise.resolve([
    {
      name: "vue2标准模版",
      npmName: "yzw-cli-vue2-standard-template",
      version: "1.0.0",
      type: "normal",
      installCommand: "cnpm install",
      startCommand: "npm run serve",
      tag: [
        "project"
      ],
      ignore: [
        "**/public/**"
      ]
    },
    {
      name: "vue3标准模版",
      npmName: "yzw-cli-vue3-standard-template",
      version: "1.0.1",
      type: "normal",
      installCommand: "cnpm install",
      startCommand: "npm run serve",
      tag: [
        "project"
      ],
      ignore: [
        "**/public/**"
      ]
    },
    {
      name: "自定义模版",
      npmName: "yzw-cli-custom-template",
      version: "1.0.2",
      type: "custom",
      installCommand: "cnpm install",
      startCommand: "npm run serve",
      tag: [
        "project"
      ],
      ignore: [
        "**/public/**"
      ]
    }
  ])
};
