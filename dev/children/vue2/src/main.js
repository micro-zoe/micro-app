// import './public-path'
import Vue from 'vue'
import VueRouter from 'vue-router'
import routes from './router'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import './my-font/iconfont.css'
import './my-font/iconfont.js' // 引入不同类型iconfont
import App from './App.vue'

Vue.config.productionTip = false
Vue.use(ElementUI)

window.microApp?.addDataListener((data) => {
  console.log('顶层监听函数 addDataListener', data)
})

const router = new VueRouter({
  // vue-router在hash模式下不支持base，可以用一个根页面进行包裹
  // base: window.__MICRO_APP_BASE_ROUTE__ || '/',
  // mode: 'history',
  routes,
})

// router.beforeEach((to, from, next) => {
//   console.log('vue2 路由钩子 beforeEach', to, from, location.href)
//   next()
// })

// router.afterEach((to, from) => {
//   console.log('vue2 路由钩子 afterEach', to, from, location.href)
// })

let app = null

// -------------------分割线-默认模式------------------ //
// app = new Vue({
//   router,
//   render: h => h(App),
// }).$mount('#app')

// // 监听卸载
// window.unmount = () => {
//   app.$destroy()
//   app.$el.innerHTML = ''
//   app = null
//   console.log('微应用vue2卸载了 -- 默认模式')
// }


// -------------------分割线-umd模式------------------ //
// 👇 将渲染操作放入 mount 函数，子应用初始化时会自动执行
window.mount = () => {
  return new Promise((resolve) => {
    // setTimeout(() => {
      app = new Vue({
        router,
        render: h => h(App),
      }).$mount('#app')
      console.log("微应用vue2渲染了 -- UMD模式")
      resolve()
    // }, 3000)
  })
}

// 👇 将卸载操作放入 unmount 函数
window.unmount = () => {
  return new Promise((resolve) => {
    // setTimeout(() => {
      app.$destroy()
      app.$el.innerHTML = ''
      app = null
      console.log("微应用vue2卸载了 -- UMD模式")
      resolve()
    // }, 3000)
  })
}

// 如果不在微前端环境，则直接执行mount渲染
if (!window.__MICRO_APP_ENVIRONMENT__) {
  window.mount()
}

// -------------------分割线------------------ //

// window.location.href = 'http://localhost:4001/micro-app/vue2/#/page2'
// window.location.href = 'http://localhost:4001/micro-app/vue2/page2'

window.addEventListener('click', () => {
  console.log('___子应用vue2的全局click事件___')
})

/* ---------------------- Image --------------------- */
const newImg = new Image()
newImg.src = '/micro-app/vue2/img/micro-app-logo.29137522.jpeg'
document.body.appendChild(newImg)
newImg.setAttribute('width', '50px')

/* ---------------------- 获取script元素 --------------------- */
// console.log('script元素', document.getElementsByTagName('script'), document.getElementsByTagName('base'))

document.addEventListener('DOMContentLoaded', function (e) {
  console.log(`子应用 DOMContentLoaded`, document.readyState, e.type)
})

document.addEventListener('readystatechange', function () {
  console.log(`子应用 readystatechange`, document.readyState)
})

document.onreadystatechange = (e) => {
  console.log(`子应用 onreadystatechange`, document.readyState, e)
}
