`micro-app`提供了一套灵活的数据通信机制，方便主应用和子应用之间的数据传输。

主应用和子应用之间的通信是绑定的，主应用只能向指定的子应用发送数据，子应用只能向主应用发送数据，这种方式可以有效的避免数据污染，防止多个子应用之间相互影响。

同时我们也提供了全局通信，方便跨应用之间的数据通信。


> [!NOTE]
> 如果需要保留 0.x 的数据通信行为，我们提供了全局配置 
> ```js
> import microApp from '@micro-zoe/micro-app'
> microApp.start({
>   'event-center-legacy': true, // 全局配置 0.x 数据通信行为，默认为false
> })
> ```
> [0.x 数据通信文档](https://micro-zoe.github.io/micro-app/0.x/#/zh-cn/data)


## 一、子应用获取来自主应用的数据

有两种方式获取来自主应用的数据：

#### 方式1：直接获取数据
```js
const data = window.microApp.getData() // 返回主应用下发的data数据
```

#### 方式2：绑定监听函数
```js
/**
 * 绑定监听函数，监听函数只有在数据变化时才会触发
 * dataListener: 绑定函数
 * autoTrigger: 在初次绑定监听函数时如果有缓存数据，是否需要主动触发一次，默认为false
 * !!!重要说明: 因为子应用是异步渲染的，而主应用发送数据是同步的，
 * 如果在子应用渲染结束前主应用发送数据，则在绑定监听函数前数据已经发送，在初始化后不会触发绑定函数，
 * 但这个数据会放入缓存中，此时可以设置autoTrigger为true主动触发一次监听函数来获取数据。
 */
window.microApp.addDataListener(dataListener: (data: Object) => any, autoTrigger?: boolean)

// 解绑监听函数
window.microApp.removeDataListener(dataListener: (data: Object) => any)

// 清空当前子应用的所有绑定函数(全局数据函数除外)
window.microApp.clearDataListener()
```

**使用方式：**
```js
// 监听函数
function dataListener (data) {
  console.log('来自主应用的数据', data)
}

// 监听数据变化
window.microApp.addDataListener(dataListener)

// 监听数据变化，初始化时如果有数据则主动触发一次
window.microApp.addDataListener(dataListener, true)

// 解绑监听函数
window.microApp.removeDataListener(dataListener)

// 清空当前子应用的所有绑定函数(全局数据函数除外)
window.microApp.clearDataListener()
```


## 二、子应用向主应用发送数据
```js
// dispatch只接受对象作为参数
window.microApp.dispatch({type: '子应用发送给主应用的数据'})
```

dispatch只接受对象作为参数，它发送的数据都会被缓存下来。

micro-app会遍历新旧值中的每个key判断值是否有变化，如果所有数据都相同则不会发送（注意：只会遍历第一层key），如果数据有变化则将**新旧值进行合并**后发送。

例如：
```js
// 第一次发送数据，记入缓存值 {name: 'jack'}，然后发送 
window.microApp.dispatch({name: 'jack'})
```

```js
// 第二次发送数据，将新旧值合并为 {name: 'jack', age: 20}，记入缓存值，然后发送 
window.microApp.dispatch({age: 20})
```

```js
// 第三次发送数据，新旧值合并为 {name: 'jack', age: 20}，与缓存值相同，不再发送
window.microApp.dispatch({age: 20})
```

##### dispatch是异步执行的，多个dispatch会在下一帧合并为一次执行

例如：
```js
window.microApp.dispatch({name: 'jack'})
window.microApp.dispatch({age: 20})

// 上面的数据会在下一帧合并为对象{name: 'jack', age: 20}一次性发送给主应用
```

##### dispatch第二个参数为回调函数，它会在数据发送结束后执行

例如：
```js
window.microApp.dispatch({city: 'HK'}, () => {
  console.log('数据已经发送完成')
})
```

##### 当数据监听函数有返回值时，会作为dispatch回调函数的入参

例如：

*主应用：*
```js
import microApp from '@micro-zoe/micro-app'

microApp.addDataListener('my-app', (data) => {
  console.log('来自子应用my-app的数据', data)

  return '返回值1'
})

microApp.addDataListener('my-app', (data) => {
  console.log('来自子应用my-app的数据', data)

  return '返回值2'
})
```

*子应用：*
```js
// 返回值会放入数组中传递给dispatch的回调函数
window.microApp.dispatch({city: 'HK'}, (res: any[]) => {
  console.log(res) // ['返回值1', '返回值2']
})
```


##### forceDispatch：强制发送

forceDispatch方法拥有和dispatch一样的参数和行为，唯一不同的是forceDispatch会强制发送数据，无论数据是否变化。

例如：
```js
// 强制发送数据，无论缓存中是否已经存在 name: 'jack' 的值
window.microApp.forceDispatch({name: 'jack'}, () => {
  console.log('数据已经发送完成')
})
```


## 三、主应用向子应用发送数据
主应用向子应用发送数据有两种方式：

#### 方式1: 通过data属性发送数据

<!-- tabs:start -->

#### ** React **
在React中我们需要引入一个polyfill。

在`<micro-app>`元素所在的文件顶部添加polyfill`(注释也要复制)`。
```js
/** @jsxRuntime classic */
/** @jsx jsxCustomEvent */
import jsxCustomEvent from '@micro-zoe/micro-app/polyfill/jsx-custom-event'
```

**开始使用**
```js
<micro-app
  name='my-app'
  url='xx'
  data={this.state.dataForChild} // data只接受对象类型，采用严格对比(===)，当传入新的data对象时会重新发送
/>
```

#### ** Vue **
vue中和绑定普通属性方式一致。
```js
<template>
  <micro-app
    name='my-app'
    url='xx'
    :data='dataForChild' // data只接受对象类型，数据变化时会重新发送
  />
</template>

<script>
export default {
  data () {
    return {
      dataForChild: {type: '发送给子应用的数据'}
    }
  }
}
</script>
```
<!-- tabs:end -->

#### 方式2: 手动发送数据

手动发送数据需要通过`name`指定接受数据的子应用，此值和`<micro-app>`元素中的`name`一致。
```js
import microApp from '@micro-zoe/micro-app'

// 发送数据给子应用 my-app，setData第二个参数只接受对象类型
microApp.setData('my-app', {type: '新的数据'})
```

setData第一个参数为子应用名称，第二个参数为传递的数据，它发送的数据都会被缓存下来。

micro-app会遍历新旧值中的每个key判断值是否有变化，如果所有数据都相同则不会发送（注意：只会遍历第一层key），如果数据有变化则将**新旧值进行合并**后发送。

例如：
```js
// 第一次发送数据，记入缓存值 {name: 'jack'}，然后发送 
microApp.setData('my-app', {name: 'jack'})
```

```js
// 第二次发送数据，将新旧值合并为 {name: 'jack', age: 20}，记入缓存值，然后发送 
microApp.setData('my-app', {age: 20})
```

```js
// 第三次发送数据，新旧值合并为 {name: 'jack', age: 20}，与缓存值相同，不再发送
microApp.setData('my-app', {age: 20})
```

##### setData是异步执行的，多个setData会在下一帧合并为一次执行

例如：
```js
microApp.setData('my-app', {name: 'jack'})
microApp.setData('my-app', {age: 20})

// 上面的数据会在下一帧合并为对象{name: 'jack', age: 20}一次性发送给子应用my-app
```

##### setData第三个参数为回调函数，它会在数据发送结束后执行

例如：
```js
microApp.setData('my-app', {city: 'HK'}, () => {
  console.log('数据已经发送完成')
})
```

##### 当数据监听函数有返回值时，会作为setData回调函数的入参

例如：

*子应用：*
```js
window.microApp.addDataListener((data) => {
  console.log('来自主应用的数据', data)

  return '返回值1'
})

window.microApp.addDataListener((data) => {
  console.log('来自主应用的数据', data)

  return '返回值2'
})
```

*主应用：*
```js
// 返回值会放入数组中传递给setData的回调函数
microApp.setData('my-app', {city: 'HK'}, (res: any[]) => {
  console.log(res) // ['返回值1', '返回值2']
})
```

##### forceSetData：强制发送

forceSetData方法拥有和setData一样的参数和行为，唯一不同的是forceSetData会强制发送数据，无论数据是否变化。

例如：
```js
// 强制发送数据，无论缓存中是否已经存在 name: 'jack' 的值
microApp.forceSetData('my-app', {name: 'jack'}, () => {
  console.log('数据已经发送完成')
})
```


## 四、主应用获取来自子应用的数据
主应用获取来自子应用的数据有三种方式：

#### 方式1：直接获取数据
```js
import microApp from '@micro-zoe/micro-app'

const childData = microApp.getData(appName) // 返回子应用的data数据
```

#### 方式2: 监听自定义事件 (datachange)

<!-- tabs:start -->

#### ** React **
在React中我们需要引入一个polyfill。

在`<micro-app>`元素所在的文件顶部添加polyfill`(注释也要复制)`。
```js
/** @jsxRuntime classic */
/** @jsx jsxCustomEvent */
import jsxCustomEvent from '@micro-zoe/micro-app/polyfill/jsx-custom-event'
```

**开始使用**
```js
<micro-app
  name='my-app'
  url='xx'
  // 数据在event.detail.data字段中，子应用每次发送数据都会触发datachange
  onDataChange={(e) => console.log('来自子应用的数据：', e.detail.data)}
/>
```

#### ** Vue **
vue中监听方式和普通事件一致。
```js
<template>
  <micro-app
    name='my-app'
    url='xx'
    // 数据在事件对象的detail.data字段中，子应用每次发送数据都会触发datachange
    @datachange='handleDataChange'
  />
</template>

<script>
export default {
  methods: {
    handleDataChange (e) {
      console.log('来自子应用的数据：', e.detail.data)
    }
  }
}
</script>
```
<!-- tabs:end -->

注意：`datachange`绑定函数的返回值不会作为子应用dispatch回调函数的入参，它的返回值没有任何作用。

#### 方式3: 绑定监听函数

绑定监听函数需要通过`name`指定子应用，此值和`<micro-app>`元素中的`name`一致。
```js
import microApp from '@micro-zoe/micro-app'

/**
 * 绑定监听函数
 * appName: 应用名称
 * dataListener: 绑定函数
 * autoTrigger: 在初次绑定监听函数时如果有缓存数据，是否需要主动触发一次，默认为false
 */
microApp.addDataListener(appName: string, dataListener: (data: Object) => any, autoTrigger?: boolean)

// 解绑监听指定子应用的函数
microApp.removeDataListener(appName: string, dataListener: (data: Object) => any)

// 清空所有监听指定子应用的函数
microApp.clearDataListener(appName: string)
```

**使用方式：**
```js
import microApp from '@micro-zoe/micro-app'

// 监听函数
function dataListener (data) {
  console.log('来自子应用my-app的数据', data)
}

// 监听来自子应用my-app的数据
microApp.addDataListener('my-app', dataListener)

// 解绑监听my-app子应用的函数
microApp.removeDataListener('my-app', dataListener)

// 清空所有监听my-app子应用的函数
microApp.clearDataListener('my-app')
```

## 五、清空数据
由于通信的数据会被缓存，即便子应用被卸载也不会清空，这可能会导致一些困扰，此时可以主动清空缓存数据来解决。

<!-- tabs:start -->
#### ** 主应用 **

#### 方式一：配置项 - clear-data
- 使用方式: `<micro-app clear-data></micro-app>`

当设置了`clear-data`，子应用卸载时会同时清空主应用发送给当前子应用，和当前子应用发送给主应用的数据。

[destroy](/zh-cn/configure?id=destroy)也有同样的效果。

#### 方式二：手动清空 - clearData
```js
import microApp from '@micro-zoe/micro-app'

// 清空主应用发送给子应用 my-app 的数据
microApp.clearData('my-app')
```

#### ** 子应用 **

#### 方式一：手动清空 - clearData
```js
// 清空当前子应用发送给主应用的数据
window.microApp.clearData()
```
<!-- tabs:end -->

## 全局数据通信
全局数据通信会向主应用和所有子应用发送数据，在跨应用通信的场景中适用。

#### 发送全局数据

<!-- tabs:start -->
#### ** 主应用 **
```js
import microApp from '@micro-zoe/micro-app'

// setGlobalData只接受对象作为参数
microApp.setGlobalData({type: '全局数据'})
```

#### ** 子应用 **

```js
// setGlobalData只接受对象作为参数
window.microApp.setGlobalData({type: '全局数据'})
```
<!-- tabs:end -->


setGlobalData只接受对象作为参数，它发送的数据都会被缓存下来。

micro-app会遍历新旧值中的每个key判断值是否有变化，如果所有数据都相同则不会发送（注意：只会遍历第一层key），如果数据有变化则将**新旧值进行合并**后发送。

例如：

<!-- tabs:start -->
#### ** 主应用 **
```js
// 第一次发送数据，记入缓存值 {name: 'jack'}，然后发送 
microApp.setGlobalData({name: 'jack'})
```

```js
// 第二次发送数据，将新旧值合并为 {name: 'jack', age: 20}，记入缓存值，然后发送 
microApp.setGlobalData({age: 20})
```

```js
// 第三次发送数据，新旧值合并为 {name: 'jack', age: 20}，与缓存值相同，不再发送
microApp.setGlobalData({age: 20})
```

#### ** 子应用 **

```js
// 第一次发送数据，记入缓存值 {name: 'jack'}，然后发送 
window.microApp.setGlobalData({name: 'jack'})
```

```js
// 第二次发送数据，将新旧值合并为 {name: 'jack', age: 20}，记入缓存值，然后发送 
window.microApp.setGlobalData({age: 20})
```

```js
// 第三次发送数据，新旧值合并为 {name: 'jack', age: 20}，与缓存值相同，不再发送
window.microApp.setGlobalData({age: 20})
```
<!-- tabs:end -->


##### setGlobalData是异步执行的，多个setGlobalData会在下一帧合并为一次执行

例如：
<!-- tabs:start -->
#### ** 主应用 **
```js
microApp.setGlobalData({name: 'jack'})
microApp.setGlobalData({age: 20})

// 上面的数据会在下一帧合并为对象{name: 'jack', age: 20}一次性发送给主应用
```

#### ** 子应用 **

```js
window.microApp.setGlobalData({name: 'jack'})
window.microApp.setGlobalData({age: 20})

// 上面的数据会在下一帧合并为对象{name: 'jack', age: 20}一次性发送给主应用
```
<!-- tabs:end -->


##### setGlobalData第二个参数为回调函数，它会在数据发送结束后执行

例如：
<!-- tabs:start -->
#### ** 主应用 **
```js
microApp.setGlobalData({city: 'HK'}, () => {
  console.log('数据已经发送完成')
})
```

#### ** 子应用 **

```js
window.microApp.setGlobalData({city: 'HK'}, () => {
  console.log('数据已经发送完成')
})
```
<!-- tabs:end -->

##### 当全局数据的监听函数有返回值时，会作为setGlobalData回调函数的入参

例如：
<!-- tabs:start -->
#### ** 主应用 **
```js
microApp.addGlobalDataListener((data) => {
  console.log('全局数据', data)

  return '返回值1'
})

microApp.addGlobalDataListener((data) => {
  console.log('全局数据', data)

  return '返回值2'
})
```

```js
// 返回值会放入数组中传递给setGlobalData的回调函数
microApp.setGlobalData({city: 'HK'}, (res: any[]) => {
  console.log(res) // ['返回值1', '返回值2']
})
```

#### ** 子应用 **
```js
window.microApp.addGlobalDataListener((data) => {
  console.log('全局数据', data)

  return '返回值1'
})

window.microApp.addGlobalDataListener((data) => {
  console.log('全局数据', data)

  return '返回值2'
})
```

```js
// 返回值会放入数组中传递给setGlobalData的回调函数
window.microApp.setGlobalData({city: 'HK'}, (res: any[]) => {
  console.log(res) // ['返回值1', '返回值2']
})
```
<!-- tabs:end -->


##### forceSetGlobalData：强制发送

forceSetGlobalData方法拥有和setGlobalData一样的参数和行为，唯一不同的是forceSetGlobalData会强制发送数据，无论数据是否变化。

例如：
<!-- tabs:start -->
#### ** 主应用 **
```js
// 强制发送数据，无论缓存中是否已经存在 name: 'jack' 的值
microApp.forceSetGlobalData({name: 'jack'}, () => {
  console.log('数据已经发送完成')
})
```

#### ** 子应用 **

```js
// 强制发送数据，无论缓存中是否已经存在 name: 'jack' 的值
window.microApp.forceSetGlobalData({name: 'jack'}, () => {
  console.log('数据已经发送完成')
})
```
<!-- tabs:end -->



#### 获取全局数据

<!-- tabs:start -->

#### ** 主应用 **
```js
import microApp from '@micro-zoe/micro-app'

// 直接获取数据
const globalData = microApp.getGlobalData() // 返回全局数据

function dataListener (data) {
  console.log('全局数据', data)
}

/**
 * 绑定监听函数
 * dataListener: 绑定函数
 * autoTrigger: 在初次绑定监听函数时如果有缓存数据，是否需要主动触发一次，默认为false
 */
microApp.addGlobalDataListener(dataListener: (data: Object) => any, autoTrigger?: boolean)

// 解绑监听函数
microApp.removeGlobalDataListener(dataListener: (data: Object) => any)

// 清空主应用绑定的所有全局数据监听函数
microApp.clearGlobalDataListener()
```

#### ** 子应用 **

```js
// 直接获取数据
const globalData = window.microApp.getGlobalData() // 返回全局数据

function dataListener (data) {
  console.log('全局数据', data)
}

/**
 * 绑定监听函数
 * dataListener: 绑定函数
 * autoTrigger: 在初次绑定监听函数时如果有缓存数据，是否需要主动触发一次，默认为false
 */
window.microApp.addGlobalDataListener(dataListener: (data: Object) => any, autoTrigger?: boolean)

// 解绑监听函数
window.microApp.removeGlobalDataListener(dataListener: (data: Object) => any)

// 清空当前子应用绑定的所有全局数据监听函数
window.microApp.clearGlobalDataListener()
```
<!-- tabs:end -->

#### 清空全局数据
<!-- tabs:start -->
#### ** 主应用 **
```js
import microApp from '@micro-zoe/micro-app'

// 清空全局数据
microApp.clearGlobalData()
```

#### ** 子应用 **

```js
// 清空全局数据
window.microApp.clearGlobalData()
```
<!-- tabs:end -->

## 关闭沙箱后的通信方式
沙箱关闭后，子应用默认的通信功能失效，此时可以通过手动注册通信对象实现一致的功能。

**注册方式：在主应用中为子应用初始化通信对象**

```js
import { EventCenterForMicroApp } from '@micro-zoe/micro-app'

// 注意：每个子应用根据appName单独分配一个通信对象
window.eventCenterForAppxx = new EventCenterForMicroApp(appName)
```

子应用就可以通过注册的`eventCenterForAppxx`对象进行通信，其api和`window.microApp`一致，*主应用通信方式没有任何变化。*

**子应用通信方式：**
```js
// 直接获取数据
const data = window.eventCenterForAppxx.getData() // 返回data数据

function dataListener (data) {
  console.log('来自主应用的数据', data)
}

/**
 * 绑定监听函数
 * dataListener: 绑定函数
 * autoTrigger: 在初次绑定监听函数时如果有缓存数据，是否需要主动触发一次，默认为false
 */
window.eventCenterForAppxx.addDataListener(dataListener: (data: Object) => any, autoTrigger?: boolean)

// 解绑监听函数
window.eventCenterForAppxx.removeDataListener(dataListener: (data: Object) => any)

// 清空当前子应用的所有绑定函数(全局数据函数除外)
window.eventCenterForAppxx.clearDataListener()

// 子应用向主应用发送数据，只接受对象作为参数
window.eventCenterForAppxx.dispatch({type: '子应用发送的数据'})
```
