const request = require('@yzw-cli-dev/request');

module.exports = function () {
  return request({
    url: '/project/template',
  });
};
