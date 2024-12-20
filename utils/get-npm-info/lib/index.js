'use strict';

const axios = require('axios');
const urlJoin = require('url-join');
const semver = require('semver');

function getNpmInfo(npmName, registry) {
  if (!npmName) {
    return null;
  }
  const registryUrl = registry || getDefaultRegistry();
  const npmInfoUrl = urlJoin(registryUrl, npmName);
  // console.log('npmInfoUrl', npmInfoUrl)
  return axios.get(npmInfoUrl).then(function (response) {
    try {
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      console.log('error', error)
      return Promise.reject(error);
    }
  });
  // return axios.get(npmInfoUrl).then(response => {
  //   if (response.status === 200) {
  //     return response.data;
  //   }
  //   return null;
  // }).catch(err => {
  //   return Promise.reject(err);
  // });
}

function getDefaultRegistry(isOriginal = false) {
  return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npmmirror.com/';
}

async function getNpmVersions(npmName, registry) {
  const data = await getNpmInfo(npmName, registry);
  if (data) {
    return Object.keys(data.versions);
  } else {
    return [];
  }
}

function getSemverVersions(baseVersion, versions) {
  return versions
    .filter(version => semver.satisfies(version, `>${baseVersion}`))
    .sort((a, b) => semver.gt(b, a) ? 1 : -1);
}

async function getNpmSemverVersion(baseVersion, npmName, registry) {
  const versions = await getNpmVersions(npmName, registry);
  // console.log('versions', versions)
  const newVersions = getSemverVersions(baseVersion, versions);
  // console.log('newVersions', newVersions)
  if (newVersions && newVersions.length > 0) {
    return newVersions[0];
  }
  return null;
}

async function getNpmLatestVersion(npmName, registry) {
  let versions = await getNpmVersions(npmName, registry);
  // console.log('versions', versions)
  if (versions) {
    let newV = versions.sort((a, b) => semver.gt(b, a))
    // console.log('***ver', newV)
    // console.log('***ver', newV[versions.length - 1])
    // return newV[0];
    return newV[versions.length - 1];
  }
  return null;
}

module.exports = {
  getNpmInfo,
  getNpmVersions,
  getNpmSemverVersion,
  getDefaultRegistry,
  getNpmLatestVersion,
};
