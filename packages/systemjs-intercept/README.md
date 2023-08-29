``` js
require("systemjs-intercept")(function (dep) {
  // 能够拦截system的请求, 包含依赖
  // 比如请求npm cdn的react-dom模块, 其依赖"react"
  if (dep === "react") {
    return window.System.import("https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.development.js")
  }
})
console.log(111, window.System.import("https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.development.js"))
```