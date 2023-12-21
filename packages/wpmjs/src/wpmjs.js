/**
 * 几点代码中的概念:
 * request 是一个字符串 `@[scope]/[name]@[version]/[entry]?[query]`
 * container 是一个包, 可以通过 await container.$getEntry("entryKey") 来获取包暴露的入口模块
 */

// 待办todo: 如有需要, 将^18.0.2改为18.999.999, 将18.2改为18.2.999
// 待办todo: 多例register
// todo: 优化baseUrl 非/结尾
// todo: 文档怎么找包路径 截图 https://unpkg.com/antd@4.24.14/dist/antd.min.js
// todo: addImap package不必填优化
// todo: hmr
// todo: 每一个app的shared注册完成后, 
// todo: shared优先级提高来做热更新
// todo: !!! wpm插件用来等待mfRemotes
// todo: 文档补充自定义加载行为
const _global = require("global")
const { default: Config } = require('./config');
const { resolveUrl, resolveEntry, formatContainer, resolveContainer, registerLoader } = require('./moduleResolve');
const {setShared, getShared} = require("module-shared-pool");
const { default: parseRequest } = require('package-request-parse');
const CacheUtil = require("./utils/CacheUtil");
const { debug, debugMode, getDebugImportMap } = require("./debugMode");

function resolveRequest(request, config, pkgConfig) {
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

/**
 * 1. 将defaultImportMap补进importMap（不覆盖）
 * 2. 将debugImportMap覆盖近importMap
 * 3. 获取最终的importMap配置对象
 * @param {*} name 
 * @param {*} config 
 * @returns 
 */
function getPkgConfig(name, config) {
  // if (!config.importMap[name]) {
    const defaultConfig = config.defaultImportMap(name)
    if (defaultConfig) {
      const config = config.importMap[name]
      Object.keys(defaultConfig).forEach(key => {
        if (config[key] === undefined) {
          config[key] = defaultConfig[key]
        }
      })
    }
  // }
  if (debugMode && getDebugImportMap(name)) {
    // todo: readme说明debugImportMap
    config.addImportMap({
      [name]: getDebugImportMap(name)
    })
  }
  const pkgConfig = config.importMap[name]
  return pkgConfig
}

function wimportWrapper(request) {
  return this.cacheUtil.setCache(request, () => {
    if (typeof request !== 'string') {
      throw new Error('包名不是字符串!');
    }
    // if (/^https?:\/\//.test(request)) {
    //   return _global.System.import(request)
    // }
    // 每次返回一个新的promise, 避免使用处未处理promise链式返回值导致的bug
    return Promise.resolve(this.config._sleepPromiseAll).then(async _ => {
      return wimport.call(this, request)
    })
  })
}

/**
 * 1. getPkgConfig // importMap
 * 2. findShared 或 resolveContainer
 * @param {*} request 
 * @returns 
 */
async function wimport(request) {
  const useConfig = getPkgConfig(parseRequest(request).name, this.config) || this.config.requestFormatConfig.call(this, request)
  let requestObj = resolveRequest(request, this.config, useConfig)

  const {
    entry,
    name,
    version,
    query,
  } = requestObj
  const moduleType = useConfig?.moduleType || this.config.defaultModuleType(name)
  let container = null
  try {
    container = getShared({
      name,
      shareScope: useConfig?.shareScope || "default",
      requiredVersion: version || "*",
      strictVersion: useConfig?.strictVersion
    })
  } catch(e) {}
  if (!container && !useConfig) {
    throw new Error(`config scope ${this.name}: ${name} not found in both importMap and shareScopes`)
  }
  if (!container) {
    const globalKey = useConfig.global || this.config.defaultGlobal(requestObj)
    container = (globalKey && _global[globalKey])
    if (!container) {
      if (!useConfig.url && !useConfig.debugUrl && !this.config.baseUrl) throw new Error("required wpmjs.setConfig({baseUrl})")
      let url = ""
      
      if (useConfig.url) {
        url = useConfig.url
      } else if (useConfig.debugUrl) {
        url = useConfig.debugUrl + "/" + useConfig.packageFilename.split("/").pop()
      } else {
        url = resolveUrl(moduleType, requestObj, this.loaderMap);
      }
      container = resolveContainer(moduleType, url, {
        request,
        requestObj,
        pkgConfig: useConfig
      }, this.loaderMap)
    }
    setShared({
      name,
      shareScope: useConfig.shareScope || "default",
      version,
      loaded: 1,
      from: this.config.name,
      get() {
        return container
      }
    })
  }
  formatContainer(container, moduleType, this.loaderMap)
  if (!entry) {
    // 无需解析入口
    return container
  }
  const entryRes = resolveEntry(moduleType, await container, entry, this.loaderMap)
  return entryRes
}


function Wpmjs({name} = {}) {
  this.config = new Config({name})
  this.cacheUtil = new CacheUtil()
  this.loaderMap = {
    // "moduleType": {moduleType, resolveUrl, resolveContainer, resolveEntry}
  }
  require("./extras/umdAndSystem").default(this)
  require("./extras/mf").default(this)
  require("./extras/json").default(this)
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
proto.registerLoader = function(obj) {registerLoader(obj, this.loaderMap)}
proto.getConfig = function() {
  return this.config
}
proto.debug = debug
proto.import = wimportWrapper
proto.get = wimportSync
proto.setShared = setShared
proto.getShared = getShared

module.exports = Wpmjs;
