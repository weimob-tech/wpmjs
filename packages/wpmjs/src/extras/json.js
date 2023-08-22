
import _global from "global"
import { registerLoader } from "../moduleResolve"


export const fileName = "dist/index.json"

registerLoader({
  moduleType: "json",
  resolveUrl,
  resolveContainer,
  resolveEntry
})

/**
 * 返回请求url
 * @param {*} param0 
 * @returns 
 */
export function resolveUrl({name, version, query, entry, filename, baseUrl}) {
  if (/https?:\/\/(localhost|(\d+\.){2})/.test(baseUrl)) {
    return `${baseUrl}/${filename}`
  }
  query = query ? "?" + query : ""
  fileName = filename ? "/" + filename : ""
  version = version ? "@" + version : ""
  return `${baseUrl}/${name}${version}${filename}${query}`
}

/**
 * 返回包模块（未解析入口）
 * @returns 
 */
export function resolveContainer(url) {
  let __json_maps_cache__ = _global.__json_maps_cache__ || {};
  return __json_maps_cache__[url] || _global.fetch(url).then(res => {
    return res.json()
  }).then(res => {
    __json_maps_cache__[url] = res;
    _global.__json_maps_cache__ = __json_maps_cache__;
    return res
  })
}

/**
 * 解析入口
 */
export function resolveEntry(container, entry) {
  if (!entry) return container
  return container[entry]
}
