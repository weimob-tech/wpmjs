const path = require("path")
const fs = require("fs")

function getModulePath(dep, context, extensions) {
  if (dep.request) {
    // 绝对路径直接返回, 相对路径拼上context
    const request = /^(.:|\/)/.test(dep.request) ? dep.request : path.join(context, dep.request)
    for (var extension of [""].concat(extensions)) {
      if (fs.existsSync(request + extension)) {
        return request + extension
      }
    }
    return request
  }
}

/**
 * 获取依赖的路径
 * @param {*} dep 
 * @param {*} context 
 */
 module.exports = function getEntrysPath(dep, context, extensions = []) {
  if (dep.exposes instanceof Array) {
    // 只需要注入 initial entry
    return []
    var paths = []
    dep.exposes.forEach(expo => {
      expo[1].import.forEach(path => {
        paths.push(getModulePath({
          request: path
        }, context, extensions))
      })
    })
    return paths
  }
  return [getModulePath(dep, context, extensions)]
  // return dep.dependencies
  //   // .filter(dep => dep.constructor.name.indexOf("EntryDependency") > -1)
  // .map(dep => getEntrysPath(dep, context, extensions)[0])
}
