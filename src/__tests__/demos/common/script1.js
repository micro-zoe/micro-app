// 初始化子应用文档内容
const root = document.querySelector('#root')
root.innerHTML = `
  <div class='container'>
    <span class='test-color'>text1</span>
    <span class='test-font'>text2</span>
  </div>
`

// 动态创建js、css标签
const dynamicLink = document.createElement('link')
dynamicLink.setAttribute('rel', 'stylesheet')
dynamicLink.setAttribute('href', '/common/link2.css')
document.head.appendChild(dynamicLink)

const dynamicScript = document.createElement('script')
dynamicScript.setAttribute('src', './script2.js')
document.body.appendChild(dynamicScript)

console.log(`子应用 ${window.__MICRO_APP_NAME__} 打印的信息 - 1`)

/**
 * testBindFunction 为基座应用的全局变量，子应用访问时会兜底到基座应用
 * 这里测试 testBindFunction 绑定的this及原型属性是否正常
 */
testBindFunction()
testBindFunction() // test bind_function cacheMap
eval(`console.log("在${window.__MICRO_APP_NAME__} eval中执行")`)

// document 事件相关
;(() => {
  // 卸载一个不存在的事件
  document.removeEventListener('keydown', () => {})
  // document click 事件
  function onClickOfApp1 () {
    console.warn(`子应用${window.__MICRO_APP_NAME__}的onclick`)
  }
  document.onclick = onClickOfApp1

  const clickEvent = new CustomEvent('click')
  document.dispatchEvent(clickEvent)
  expect(console.warn).toHaveBeenLastCalledWith(`子应用${window.__MICRO_APP_NAME__}的onclick`)

  expect(document.onclick.name).toBe('bound ' + onClickOfApp1.name)

  // 主动卸载的document click
  function handleDocClick () {
    console.log('document click1')
  }
  document.addEventListener('click', handleDocClick, false)
  document.removeEventListener('click', handleDocClick)

  // 不主动卸载的document click
  function handleDocClick2 () {
    console.log('document click2')
  }
  document.addEventListener('click', handleDocClick2, false)

  // document click 其它事件
  document.addEventListener('other', () => {}, false)

  // 卸载一个不存在的事件，前后都卸载了一个不存在的事件，但处理逻辑是不同的
  document.removeEventListener('keydown', () => {})
})()

// window 事件相关
;(() => {
  // 主动卸载的window scroll
  function handleWinEvent () {
    console.log('window scroll1')
  }
  window.addEventListener('scroll', handleWinEvent, false)
  window.removeEventListener('scroll', handleWinEvent)

  // 不主动卸载的window scroll
  function handleWinEvent2 () {
    console.log('window scroll2')
  }
  window.addEventListener('scroll', handleWinEvent2, false)
  window.removeEventListener('keydown', () => {})
})()

// 定时器相关
;(() => {
  // 主动卸载的setTimeout
  const time1 = setTimeout(() => {}, 1000)
  clearTimeout(time1)

  // 不主动卸载的setTimeout
  setTimeout(() => {}, 100000)

  // 主动卸载的setInterval
  const time2 = setInterval(() => {}, 1000)
  clearInterval(time2)

  // 不主动卸载的setInterval
  setInterval(() => {}, 100000)
})()

window.addEventListener('unmount', () => {
  console.log(`addEventListener--unmount: ${window.__MICRO_APP_NAME__} 卸载了`)
})

// 发送事件，通知基座立即卸载自己 -- create-app测试独有
window.dispatchEvent(new CustomEvent('unmount-me'))

// 通过数据通信，异步卸载自己
Promise.resolve().then(() => {
  window.microApp && window.microApp.dispatch({ unmountMeAsync: true })
})

// 监听keep-alive模式下的app状态
window.addEventListener("appstate-change", function (e) {
  window.keepAliveListener && window.keepAliveListener(e.detail.appState)
})

// 20201.12.17 v0.6.1 new Image兼容测试
const newImg = new Image()
newImg.src = '/static/media/logo.6ce24c58.svg'
document.body.appendChild(newImg)
expect(newImg.__MICRO_APP_NAME__).toBe(window.__MICRO_APP_NAME__)

// 测试 cloneNode
var img2 = newImg.cloneNode(true)
document.body.appendChild(img2)
expect(img2.__MICRO_APP_NAME__).toBe(newImg.__MICRO_APP_NAME__)
