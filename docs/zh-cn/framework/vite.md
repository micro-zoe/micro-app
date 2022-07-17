本篇介绍了`vite 2`的接入方式，vite1暂不支持。

## 作为基座应用
vite作为基座应用时没有特殊之处，具体方式参考各框架接入文档。

## 作为子应用

当子应用是vite应用时需要做特别的适配，适配vite的代价是巨大的，我们必须关闭沙箱功能，因为沙箱在`module script`下不支持，这导致大部分功能失效，包括：环境变量、样式隔离、元素隔离、资源路径补全、baseroute 等。

在嵌入vite子应用时，`micro-app`的功能只负责渲染，其它的行为由应用自行决定，这包括如何防止样式、JS变量、元素的冲突。

在module模式下，引入的资源大多为相对地址，兼容主要做的事情就是将地址补全。

### 👇 子应用的修改

**1、修改vite.config.js**
```js
import { join } from 'path'
import { writeFileSync } from 'fs'

// vite.config.js
export default defineConfig({
  base: `${process.env.NODE_ENV === 'production' ? 'http://my-site.com' : ''}/basename/`,
  plugins: [
    // 自定义插件
    (function () {
      let basePath = ''
      return {
        // name即子应用的name值
        name: "basename",
        apply: 'build',
        configResolved(config) {
          basePath = `${config.base}${config.build.assetsDir}/`
        },
        writeBundle (options, bundle) {
          for (const chunkName in bundle) {
            if (Object.prototype.hasOwnProperty.call(bundle, chunkName)) {
              const chunk = bundle[chunkName]
              if (chunk.fileName && chunk.fileName.endsWith('.js')) {
                chunk.code = chunk.code.replace(/(from|import\()(\s*['"])(\.\.?\/)/g, (all, $1, $2, $3) => {
                  return all.replace($3, new URL($3, basePath))
                })
                const fullPath = join(options.dir, chunk.fileName)
                writeFileSync(fullPath, chunk.code)
              }
            }
          }
        },
      }
    })(),
  ],
})
```

>  **注意：** 子应用中 `name` 需与基座应用中 `name` 保持一致。

**2、修改容器元素id**

因为vite子应用没有元素隔离的保护，建议修改容器元素的id值，以确保与其它元素不冲突。

*1、修改index.html中容器元素的id值*

```html
<!-- index.html -->
<body>
  <div id="my-vite-app"></div>
</body>
```

*2、使用新的id渲染*
```js
// main.js
createApp(App).mount('#my-vite-app')
```

当多个vite子应用同时渲染时，必须修改容器元素的id值，确保每个子应用容器元素id的唯一性，否则无法正常渲染。

**3、路由**

推荐基座使用history路由，vite子应用使用hash路由，避免一些可能出现的问题。

子应用如果是vue3，在初始化时路由时，createWebHashHistory不要传入参数，如下：

```js
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
```

**4、静态资源**

图片等静态资源需要使用绝对地址，可以使用 `new URL('../assets/logo.png', import.meta.url).href` 等方式获取资源的全链接地址。

### 👇 基座应用的修改
注意这里的基座应用是指嵌入了vite子应用的基座，它可以是任何框架，和上面`作为基座应用`一节无关。

**1、关闭沙箱并使用内联script模式**
```js
<micro-app
   // name即子应用 vite.config.js 中name值
  name='basename'
  url='http://localhost:3001/basename/'
  inline // 使用内联script模式
  disableSandbox // 关闭沙箱
>
```

**2、处理子应用静态资源**

写一个简易的插件，对开发环境的子应用进行处理，补全静态资源路径。

```js
import microApp from '@micro-zoe/micro-app'

microApp.start({
  plugins: {
    modules: {
      // name即子应用 vite.config.js 中name值
      name: [{
        loader(code) {
          if (process.env.NODE_ENV === 'development') {
            // 这里 basename 需要和子应用vite.config.js中base的配置保持一致
            code = code.replace(/(from|import)(\s*['"])(\/basename\/)/g, all => {
              return all.replace('/basename/', '子应用域名/basename/')
            })
          }

          return code
        }
      }]
    }
  }
})
```

### 👇 数据通信
沙箱关闭后，子应用默认的通信功能失效，此时可以通过手动注册通信对象实现一致的功能。

**注册方式：在基座应用中为子应用初始化通信对象**

```js
import { EventCenterForMicroApp } from '@micro-zoe/micro-app'

// 注意：每个vite子应用根据appName单独分配一个通信对象
window.eventCenterForViteApp1 = new EventCenterForMicroApp(appName)
```

vite子应用就可以通过注册的`eventCenterForViteApp1`对象进行通信，其api和`window.microApp`一致，*基座通信方式没有任何变化。*

**子应用通信方式：**
```js
/**
 * 绑定监听函数
 * dataListener: 绑定函数
 * autoTrigger: 在初次绑定监听函数时有缓存数据，是否需要主动触发一次，默认为false
 */
window.eventCenterForViteApp1.addDataListener(dataListener: (data: Object) => void, autoTrigger?: boolean)

// 解绑指定函数
window.eventCenterForViteApp1.removeDataListener(dataListener)

// 清空当前子应用的所有绑定函数(全局数据函数除外)
window.eventCenterForViteApp1.clearDataListener()

// 主动获取数据
window.eventCenterForViteApp1.getData()

// 子应用向基座应用发送数据
window.eventCenterForViteApp1.dispatch({type: '子应用发送的数据'})
```

> [!WARNING]
> 1、请确保vite版本>=2.5.0
>
> 2、适配vite本质上是适配module脚本，其它非vite构建的module脚本也可以采用相同的思路处理。


## 实战案例
以上介绍了vite如何接入微前端，但在实际使用中会涉及更多功能，如数据通信、路由跳转、打包部署，为此我们提供了一套案例，用于展示vite作为基座嵌入(或作为子应用被嵌入) react、vue、angular、vite、nextjs、nuxtjs等框架，在案例中我们使用尽可能少的代码实现尽可能多的功能。

案例地址：https://github.com/micro-zoe/micro-app-demo
