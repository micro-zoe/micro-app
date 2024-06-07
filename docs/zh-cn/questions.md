## 1、我需要用到微前端吗？ :id=1
在此之前建议你先阅读[Why Not Iframe](https://www.yuque.com/kuitos/gky7yw/gesexv)。

相比于iframe，微前端拥有更好的用户体验，同时它也要求开发者对于前端框架和路由原理具有一定的理解。

微前端的本质是将两个不相关的页面强行合并为一，这其中不可避免会出现各种冲突，虽然微前端框架解决了几乎所有的冲突，但偶尔也会有特殊情况出现，这需要开发者具有处理特殊情况的能力和心态。

微前端不是万能的，它的实现原理注定无法像iframe一样简单稳定。

如果你不知道自己是否需要用微前端，那么大概率是不需要。

## 2、子应用一定要支持跨域吗？ :id=2
是的！

micro-app从主应用通过fetch加载子应用的静态资源，由于主应用与子应用的域名不一定相同，所以子应用必须支持跨域。

## 3、兼容性如何 :id=3
micro-app依赖于CustomElements和Proxy两个较新的API。

对于不支持CustomElements的浏览器，可以通过引入polyfill进行兼容，详情可参考：[webcomponents/polyfills](https://github.com/webcomponents/polyfills/tree/master/packages/custom-elements)。

但是Proxy暂时没有做兼容，所以对于不支持Proxy的浏览器无法运行micro-app。

浏览器兼容性可以查看：[Can I Use](https://caniuse.com/?search=Proxy)

总体如下：
- PC端：除了IE浏览器，其它浏览器基本兼容。
- 移动端：ios10+、android5+


## 4、micro-app 报错 an app named xx already exists :id=4
这是`name`名称冲突导致的，请确保每个子应用的`name`值是唯一的。

## 5、主应用的样式影响到子应用 :id=5
虽然我们将子应用的样式进行隔离，但主应用的样式依然会影响到子应用，如果发生冲突，推荐通过约定前缀或CSS Modules方式解决。

如果你使用的是`ant-design`等组件库，一般会提供添加前缀进行样式隔离的功能。

## 6、子应用如何获取到真实window、document :id=6
子应用通过：`window.rawWindow`、`window.rawDocument` 可以获取真实的window、document

## 7、子应用抛出错误信息：xxx 未定义 :id=7
**包括：**
- `xxx is not defined`
- `xxx is not a function`
- `Cannot read properties of undefined`

**常见场景：**
  - 1、webpack DllPlugin 拆分的独立文件
  - 2、通过script引入的第三方js文件

**原因：**

在沙箱环境中，顶层变量不会泄漏为全局变量。

例如：在正常情况下，通过 var name 或 function name () {} 定义的顶层变量会泄漏为全局变量，通过window.name或name就可以全局访问，但是在沙箱环境下这些顶层变量无法泄漏为全局变量，window.name或name的值为undefined，导致出现问题。

**解决方式**：

##### 方式一：修改webpack配置

子应用webpack的[output.library.type](https://webpack.docschina.org/configuration/output/#outputlibrarytype)设置为`window`，这种方式适合DllPlugin拆分的独立文件。
```js
// webpack.dll.config.js
module.exports = {
  // ...
  output: {
    library: {
      type: 'window',
    },
  },
}
```
##### 方式二：手动修改

将 var name 或 function name () {} 修改为 window.name = xx

##### 方式三：通过插件系统修改子应用代码

通过插件系统，将 var name 或 function name () {} 修改为 window.name = xx，不同项目的代码形式并不统一，根据实际情况调整。

```js
microApp.start({
  plugins: {
    modules: {
      应用名称: [{
        loader(code, url) {
          if (url === 'xxx.js') {
            // 根据实际情况调整
            code = code.replace('var xxx=', 'window.xxx=')
          }
          return code
        }
      }]
    }
  }
})
```

## 8、jsonp请求如何处理？ :id=8
  参考[ignore](/zh-cn/configure?id=ignore忽略元素)


## 9、子应用通过a标签下载文件失败 :id=9
  **原因：**当跨域时(主应用和文件在不同域名下)，无法通过a标签的download属性实现下载。

  **解决方式：**

  **方式1：**转换为blob形式下载
  ```html
  <a href='xxx.png' download="filename.png" @click='downloadFile'>下载</a>
  ```
  ```js
  // 通过blob下载文件
  function downloadFile (e) {
    // 微前端环境下转换为blob下载，子应用单独运行时依然使用a标签下载
    if (window.__MICRO_APP_ENVIRONMENT__) {
      e.preventDefault()
      // 注意href必须是绝对地址
      fetch(e.target.href).then((res) => {
        res.blob().then((blob) => {
          const blobUrl = window.URL.createObjectURL(blob)
          // 转化为blobURL后再通过a标签下载
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = 'filename.png'
          a.click()
          window.URL.revokeObjectURL(blobUrl)
        })
      })
    }
  }
  ```

  **方式2：**将文件放到主应用域名下，判断微前端环境下a标签href属性设置为主应用的文件地址

## 10、iconfont 图标冲突了如何处理？ :id=10

| 产生原因                                        | 解决方案                                                     |
| ----------------------------------------------- | ------------------------------------------------------------ |
| 主应用和子应用 unicode 使用同一编码导致图标冲突 | 选择冲突图标，在iconfont中修改对应的unicode编码并重新生成文件进行替换 |
| 主应用和子应用 class/fontFamily 冲突            | 修改冲突应用下使用iconfont的的相关类名和对应的font-face下fontFamily |

**主应用和子应用 class/fontFamily 冲突 解决示例**

```css
@font-face {
-  font-family: "iconfont";
+  font-family: "iconfont1";
   src: url('iconfont.woff2?t=1704871404008') format('woff2'),
       url('iconfont.woff?t=1704871404008') format('woff'),
       url('iconfont.ttf?t=1704871404008') format('truetype');
}

-.iconfont {
+.iconfont1 {
  font-family: "iconfont" !important;
  font-size: 16px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.right:before {
  content: "\e7eb";
}
```

```html
- <i className="iconfont right"></i>
+ <i className="iconfont1 right"></i>
```

## 11、Vue主应用接入微前端时循环刷新（页面闪烁） :id=11

**解决方式：**将主应用中`<router-view>`或包含`<micro-app>`元素的上层组件中`:key="route.fullPath"`或者`:key="route.path"`改为`:key="route.name"`

**例如：**

```html
<!-- bad 😭 -->
<router-view v-slot="{ Component, route }">
  <transition name="fade">
    <component :is="Component" :key="route.fullPath" />
  </transition>
</router-view>

<!-- good 😊 -->
<router-view v-slot="{ Component, route }">
  <transition name="fade">
    <component :is="Component" :key="route.path" />
  </transition>
</router-view>
```

```html
<!-- bad 😭 -->
<router-view :key="$route.fullPath"></router-view>

<!-- good 😊 -->
<router-view :key="$route.path"></router-view>
```

## 12、iframe沙箱加载了主应用的资源 :id=12

**解决方式：**如果主应用不会作为iframe嵌入，可以在主应用head最前面插入下面js
```html
<script>if(window.parent !== window) {window.stop()}</script>
```

## 13、子应用script元素被注释、消失 :id=13
默认情况下，子应用的js会被提取并在后台运行，script元素原位置会留下注释：`<!--script with src='xxx' extract by micro-app-->`

如果想要保留script元素，可以开启inline模式，配置方式参考：[inline](/zh-cn/configure?id=inline)


## 14、子应用使用`Module Federation`模块联邦时报错 :id=14
**原因：**同上述`常见问题7`相同，都是由于在沙箱环境中，顶层变量不会泄漏为全局变量导致的。

**解决方式：**将`ModuleFederationPlugin`插件中`library.type`设置为`window`。

```js
new ModuleFederationPlugin({
  // ...
  name: "app1",
  library: { 
    type: "window",
    name: "app1",
  },
})
```

## 15、子应用`DllPlugin`拆分的文件加载失败 :id=15

**原因：**参考`常见问题7`，在沙箱环境中，顶层变量不会泄漏为全局变量导致的。

**解决方式：**修改子应用webpack dll配置

子应用webpack dll配置文件中[output.library.type](https://webpack.docschina.org/configuration/output/#outputlibrarytype)设置为`window`。
```js
// webpack.dll.config.js
module.exports = {
  // ...
  output: {
    library: {
      type: 'window',
    },
  },
}
```

## 16、tinymce 编辑器使用 iframe 沙箱 + keep-alive，在主应用切回子应用的时候，富文本编辑器原本显示的东西没了，内容也无法输入了

**原因：**设置 keep-alive 的子应用会对页面元素进行缓存，等到展示时再进行回显，但是 tinymce 是用 iframe 作为编辑区域的，在回显时可能没有办法做到完全回显

**解决方式：**使用组件 key 机制，在子应用渲染时强渲染富文本组件

组件代码，仅供参考
```html
<script setup lang="ts">
import { ref } from 'vue';
import RichText from '@/components/RichText/RichText.vue';
const value = ref('');
const forceRefreshComp = ref(0);
window.__MICRO_APP_ENVIRONMENT__ &&
  window.addEventListener('appstate-change', (e: any) => {
    if (e.detail.appState === 'beforeshow') {
      forceRefreshComp.value++;
    }
  });
</script>
<template>
  <rich-text v-model="value" :key="forceRefreshComp"></rich-text>
</template>
```

