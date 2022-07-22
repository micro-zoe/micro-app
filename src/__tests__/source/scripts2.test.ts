/* eslint-disable promise/param-names */
import { rawDocumentCreateElement, rawSetAttribute } from './support_module'
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import microApp from '../..'

describe('source scripts2', () => {
  let appCon: Element
  beforeAll(() => {
    // URL.createObjectURL is undefined in jest env
    global.URL.createObjectURL = jest.fn()
    commonStartEffect(ports.source_scripts2)
    microApp.start({
      plugins: {}
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    Document.prototype.createElement = rawDocumentCreateElement
    Element.prototype.setAttribute = rawSetAttribute
    return releaseAllEffect()
  })

  // 支持module的环境
  test('support module environment', async () => {
    const microAppElement1 = document.createElement('micro-app')
    microAppElement1.setAttribute('name', 'test-app1')
    microAppElement1.setAttribute('url', `http://127.0.0.1:${ports.source_scripts2}/common/`)

    appCon.appendChild(microAppElement1)
    await new Promise((resolve) => {
      setTimeout(() => {
        // module在jest环境无法执行，所以不会触发mounted事件，这里使用setTimeout代替
        setAppName('test-app1')
        // 动态创建script，noModulejs不会被执行
        const dynamicScript1 = document.createElement('script')
        dynamicScript1.setAttribute('src', '/common/script2.js')
        dynamicScript1.setAttribute('noModule', 'true')
        document.head.appendChild(dynamicScript1)

        // 模拟环境下，html自带nomodule不会触发setAttribute，所以会执行，此处为特殊情况
        expect(console.warn).toBeCalledWith('nomodule')

        // // 分支覆盖
        // const dynamicScript2 = document.createElement('script')
        // dynamicScript2.setAttribute('type', 'module')
        // dynamicScript2.setAttribute('src', '/common/global.js')
        // document.head.appendChild(dynamicScript2)

        // const dynamicScript3 = document.createElement('script')
        // dynamicScript3.setAttribute('type', 'module')
        // dynamicScript3.setAttribute('src', '/common/script3.js')
        // document.head.appendChild(dynamicScript3)
        resolve(true)
      }, 200)
    })
  })

  // 在inline模式下开启module
  test('use module in inline mode', async () => {
    const microAppElement2 = document.createElement('micro-app')
    microAppElement2.setAttribute('name', 'test-app2')
    microAppElement2.setAttribute('url', `http://127.0.0.1:${ports.source_scripts2}/dynamic/`)
    microAppElement2.setAttribute('inline', 'true')
    microAppElement2.setAttribute('disableSandbox', 'true')

    appCon.appendChild(microAppElement2)
    await new Promise((resolve) => {
      microAppElement2.addEventListener('mounted', () => {
        setAppName('test-app2')

        const dynamicScript1 = document.createElement('script')
        dynamicScript1.setAttribute('type', 'module')
        dynamicScript1.textContent = 'console.warn("inline module")'
        document.head.appendChild(dynamicScript1)

        const dynamicScript2 = document.createElement('script')
        dynamicScript2.setAttribute('src', '/common/module.js')
        dynamicScript2.setAttribute('type', 'module')
        document.head.appendChild(dynamicScript2)

        // 分支覆盖 -- 动态 module 为global数据下，dispatchOnLoadEvent不触发
        const dynamicScript3 = document.createElement('script')
        dynamicScript3.setAttribute('src', '/common/global.js')
        dynamicScript3.setAttribute('type', 'module')
        document.head.appendChild(dynamicScript3)

        // 分支覆盖 -- 动态 module 为已缓存数据下，dispatchOnLoadEvent不触发
        const dynamicScript4 = document.createElement('script')
        dynamicScript4.setAttribute('src', '/common/global.js')
        dynamicScript4.setAttribute('type', 'module')
        document.head.appendChild(dynamicScript4)

        // expect(console.warn).toBeCalledWith('inline module')
        resolve(true)
      }, false)
    })
  })

  // 测试currentScript是否正确注入
  test('test inject currentScript at runtime', async () => {
    const microAppElement3 = document.createElement('micro-app')
    microAppElement3.setAttribute('name', 'test-app3')
    microAppElement3.setAttribute('url', `http://127.0.0.1:${ports.source_scripts2}/dynamic`)

    appCon.appendChild(microAppElement3)
    await new Promise((resolve) => {
      microAppElement3.addEventListener('mounted', () => {
        setAppName('test-app3')
        const dynamicScript1 = document.createElement('script')
        dynamicScript1.id = 'dynamicScript1'
        dynamicScript1.textContent = 'console.warn("document.currentScript.id: " + document.currentScript.id);'
        document.head.appendChild(dynamicScript1)

        expect(console.warn).toHaveBeenLastCalledWith('document.currentScript.id: dynamicScript1')
        resolve(true)
      }, false)
    })
  })
})
