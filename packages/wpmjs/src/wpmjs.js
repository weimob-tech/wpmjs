/**
 * 几点代码中的概念:
 * request 是一个字符串 `@[scope]/[name]@[version]/[entry]?[query]`
 * container 是一个包, 可以通过 await container.$getEntry("entry") 来获取包暴露的入口模块
 */

// 待办todo: local面板
// 待办todo: 如有需要, 将^18.0.2改为18.999.999, 将18.2改为18.2.999
// 待办todo: universal使用wpmjs
// 待办todo: 多例register
const _global = require("global")
const localStorage = require('./utils/getLocalStorage').default
const { default: Config } = require('./config');
const { resolveUrl, resolveEntry, formatContainer, resolveContainer, registerLoader } = require('./moduleResolve');
const {setShared, getShared} = require("module-shared-pool");
const { default: parseRequest } = require('package-request-parse');
const CacheUtil = require("./utils/CacheUtil")

function resolveRequest(request, config) {
  if (/^https?:\/\//.test(request)) {
    return request
  }
  var {
    name,
    version,
    entry = '',
    query
  } = parseRequest(request)
  if (!name) {
    throw new Error(`【'${request}】请求格式不正确（https://wpm.hsmob.com/assets/wpm-docs/API-SDK.html#wpmjs-import）`)
  }
  const pkgConfig = getPkgConfig(name, config)
  let requestObj = {
    name: pkgConfig.packageName || name,
    version: pkgConfig.packageVersion || version || config.defaultVersion(name),
    filename: pkgConfig.packageFilename || entry,
    entry,
    query: pkgConfig.packageQuery || query,
    baseUrl: config.baseUrl,
  }
  return requestObj
}

function wimportSync(request) {
  return this.cacheUtil.getCacheSync(request)
}

function getPkgConfig(name, config) {
  if (!config.importMap[name]?.packageName || !config.importMap[name]?.moduleType) {
    config.addImportMap({
      [name]: config.defaultImportMap(name)
    })
  }
  const pkgConfig = config.importMap[name]
  if (!pkgConfig) {
    throw new Error(`${name} not found in importMap`)
  }
  return pkgConfig
}

function wimport(request) {
  return this.cacheUtil.setCache(request, () => {
    if (typeof request !== 'string') {
      throw new Error('包名不是字符串!');
    }
    // if (/^https?:\/\//.test(request)) {
    //   return _global.System.import(request)
    // }
    // 每次返回一个新的promise, 避免使用处未处理promise链式返回值导致的bug
    return Promise.resolve().then(async _ => {
      await this.config._sleepPromiseAll
      const pkgConfig = getPkgConfig(parseRequest(request).name, this.config)
      let requestObj = resolveRequest(request, this.config)
      const {
        entry,
        name,
        version,
        query,
      } = requestObj
      const moduleType = pkgConfig.moduleType
      let url = pkgConfig.url
      if (url) {
        url += "/" + pkgConfig.packageFilename
      } else {
        url = resolveUrl(moduleType, requestObj);
      }
      let container = null
      try {
        container = getShared({
          name,
          requiredVersion: version || "*",
          strictVersion: pkgConfig.strictVersion
        })
      } catch(e) {}
      if (!container) {
        const globalKey = pkgConfig.global || this.config.defaultGlobal(requestObj)
        container = (globalKey && _global[globalKey]) || 
          resolveContainer(moduleType, url, {
            request,
            requestObj,
            pkgConfig
          })
        setShared({
          name,
          version,
          loaded: 1,
          get() {
            return container
          }
        })
      }
      formatContainer(container, moduleType)
      if (!entry) {
        // 无需解析入口
        return container
      }
      const entryRes = resolveEntry(moduleType, await container, entry)
      return entryRes
    })
  })
}

function Wpmjs() {
  this.config = new Config()
  this.cacheUtil = new CacheUtil()
  return this
}
const proto = Wpmjs.prototype
proto.sleep = function(promise) {
  return this.config.sleep(promise)
}
proto.setConfig = function(config) {
  return this.config.setConfig(config)
}
proto.addImportMap = function(config) {
  return this.config.addImportMap(config)
}
proto.registerLoader = registerLoader
proto.getConfig = function() {
  return this.config
}
proto.import = wimport
proto.get = wimportSync

module.exports = Wpmjs;
