/* eslint-disable promise/param-names, no-extend-native */
import { commonStartEffect, releaseAllEffect, ports, setAppName, clearAppName } from '../common/initial'
import { useProxyDocument, rawDocumentCreateElement } from '../common/proxy_document'
import { appInstanceMap } from '../../create_app'
import microApp from '../..'

describe('source patch', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.source_patch)
    microApp.start({
      plugins: {
        global: [
          {
            excludeChecker: (url) => ['link7.css', 'script9.js'].some(item => url.endsWith(item))
          }
        ],
        modules: {
          'test-app1': [
            {
              excludeChecker: (url) => ['link8.css', 'script10.js'].some(item => url.endsWith(item))
            }
          ]
        }
      }
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  useProxyDocument()

  // 子应用中操作元素的行为需要被拦截和处理
  test('element query', async () => {
    const microAppElement1 = document.createElement('micro-app')
    microAppElement1.setAttribute('name', 'test-app1')
    microAppElement1.setAttribute('url', `http://127.0.0.1:${ports.source_patch}/ssr-render/`)

    appCon.appendChild(microAppElement1)
    await new Promise((resolve) => {
      microAppElement1.addEventListener('mounted', () => {
        const app1 = appInstanceMap.get('test-app1')!
        const saveContainer = app1.container!
        const microAppBody = app1.container!.querySelector('micro-app-body')!
        const microAppHead = app1.container!.querySelector('micro-app-head')!
        /**
         * getElementsByName
         */
        setAppName('test-app1')
        // getElementsByName in micro env
        expect(document.getElementsByName('ssr-html-name')[0] instanceof HTMLDivElement).toBeTruthy()
        // coverage of special name
        expect(document.getElementsByName('1-name')[0]).toBeUndefined()
        clearAppName()
        // getElementsByName in base app
        expect(document.getElementsByName('base-app-name')[0]).toBeUndefined()

        /**
         * getElementsByClassName
         */
        setAppName('test-app1')
        // getElementsByClassName in micro env
        expect(document.getElementsByClassName('ssr-html-class')[0] instanceof HTMLDivElement).toBeTruthy()
        // coverage of special class
        expect(document.getElementsByClassName('1-class')[0]).toBeUndefined()
        clearAppName()
        // getElementsByClassName in base app
        expect(document.getElementsByClassName('base-app-class')[0]).toBeUndefined()

        /**
         * getElementById
         */
        setAppName('test-app1')
        // getElementById in micro env
        expect(document.getElementById('ssr-html-id') instanceof HTMLDivElement).toBeTruthy()
        // coverage of special id
        expect(document.getElementById('1-id')).toBeNull()
        clearAppName()
        // getElementById in base app
        expect(document.getElementById('base-app-id')).toBeNull()

        /**
         * getElementsByTagName
         */
        setAppName('test-app1')
        // getElementsByTagName in micro env
        expect(document.getElementsByTagName('ssr-html-tag')[0]).not.toBeUndefined()
        // coverage of special tag-name
        expect(document.getElementsByTagName('body')[0]).toBe(document.body)
        expect(document.getElementsByTagName('head')[0]).toBe(document.head)
        // coverage branch of script
        expect(document.getElementsByTagName('script')[0]).not.toBeUndefined()
        app1.inline = true
        expect(document.getElementsByTagName('script')[0]).toBeUndefined()
        app1.inline = false
        setAppName('not-exist')
        expect(document.getElementsByTagName('script')[0]).not.toBeUndefined()

        clearAppName()
        // getElementsByTagName in base app
        expect(document.getElementsByTagName('base-app-tag')[0]).toBeUndefined()

        /**
         * querySelectorAll
         */
        setAppName('not-exist')
        expect(document.querySelectorAll('div').length).toBe(0)
        expect(document.querySelector('div')).toBeNull()
        /**
         * createElementNS
         */
        setAppName('test-app1')
        const microSvg = document.createElementNS('http://www.w3.org/1999/xhtml', 'svg')
        expect(microSvg.__MICRO_APP_NAME__).toBe('test-app1')
        document.body.appendChild(microSvg)

        /**
         * removeChild
         */
        setAppName('test-app1')
        expect(document.body.removeChild(microSvg)).toBe(microSvg)
        // 模拟app被卸载
        document.body.appendChild(microSvg)
        app1.container = null
        try {
          // 应用卸载之后使用原生方法，microSvg不属于body，所以报错
          document.body.removeChild(microSvg)
        } catch (error) {
          console.error(error)
        }
        expect(console.error).toBeCalled()
        app1.container = saveContainer
        clearAppName()
        const removeChildDom1 = document.createElement('div')
        document.body.appendChild(removeChildDom1)
        document.body.removeChild(removeChildDom1)
        try {
          // @ts-ignore
          document.body.removeChild(null)
        } catch (error) {
          console.error(error)
        }
        expect(console.error).toBeCalled()

        const removeChildDom2 = document.createElement('div')
        document.body.appendChild(removeChildDom2)
        removeChildDom2.__MICRO_APP_NAME__ = 'not-exist'
        document.body.removeChild(removeChildDom2)

        /**
         * prepend
         */
        setAppName('test-app1')
        const prependDom1 = document.createElement('span')
        document.body.prepend(prependDom1, '123')
        const prependDom2 = document.createElement('span')
        document.head.prepend(prependDom2, '123')
        expect(microAppBody.contains(prependDom1)).toBeTruthy()
        expect(microAppHead.contains(prependDom2)).toBeTruthy()
        clearAppName()
        const prependDom3 = rawDocumentCreateElement.call(document, 'span')
        document.body.prepend(prependDom3)
        const prependDom4 = document.createElement('span')
        document.head.prepend(prependDom4)
        expect(microAppBody.contains(prependDom3)).toBeFalsy()
        expect(microAppHead.contains(prependDom4)).toBeFalsy()
        /**
         * insertBefore
         */
        setAppName('test-app1')
        const insertBeforeDom1 = document.createElement('span')
        const insertBeforeDom2 = document.createElement('span')
        document.body.appendChild(insertBeforeDom1)
        document.body.insertBefore(insertBeforeDom2, insertBeforeDom1)
        expect(microAppBody.contains(insertBeforeDom2)).toBeTruthy()

        /**
         * setAttribute
         */
        microAppElement1.setAttribute('data', 'not object')
        expect(console.warn).toHaveBeenLastCalledWith('[micro-app] app test-app1: property data must be an object')
        // 模拟将对象类型转换为字符串
        microAppElement1.setAttribute('data', '[object Object]')
        // @ts-ignore
        microAppElement1.setAttribute('data', {
          __selfName: '',
          1: 'number key',
        })

        /**
         * commonElementHandler
         */
        // 模拟app被卸载
        document.body.appendChild(microSvg)
        app1.container = null

        setAppName('test-app1')
        const commonElementHandlerDom1 = document.createElement('div')
        const commonElementHandlerDom2 = document.createElement('div')
        document.body.appendChild(commonElementHandlerDom1)
        document.body.append(commonElementHandlerDom2)
        expect(microAppBody.contains(commonElementHandlerDom1)).toBeFalsy()
        expect(microAppBody.contains(commonElementHandlerDom2)).toBeFalsy()

        app1.container = saveContainer
        // appName存在，且插入类型不属于node类型，此时走到兜底处理
        document.body.children[0]?.prepend('123')

        // 模拟app不存在
        setAppName('not-exist')
        document.body.prepend('123')
        const commonElementHandlerDom3 = document.createElement('div')
        commonElementHandlerDom3.__MICRO_APP_NAME__ = 'not-exist'
        document.body.prepend(commonElementHandlerDom3)

        // 目标元素不存在
        document.body.prepend(null as any)

        /**
         * getMappingNode
         * -- coverage branch
         */
        // 从缓存中操作元素
        setAppName('test-app1')
        const getMappingNodeDom1 = document.createElement('script')
        getMappingNodeDom1.textContent = 'var a = 1'
        document.head.appendChild(getMappingNodeDom1)
        document.head.removeChild(getMappingNodeDom1)

        /**
         * invokePrototypeMethod
         */
        setAppName('test-app1')
        // 父元素非body、head
        const invokePrototypeMethodDom1 = document.createElement('div')
        const invokePrototypeMethodDom2 = document.createElement('div')
        const ssrHtmlId = document.querySelector('#ssr-html-id')!
        ssrHtmlId.appendChild(invokePrototypeMethodDom1)
        ssrHtmlId.append(invokePrototypeMethodDom2)
        expect(ssrHtmlId.contains(invokePrototypeMethodDom1)).toBeTruthy()
        expect(ssrHtmlId.contains(invokePrototypeMethodDom2)).toBeTruthy()

        // insertBefore 或 replaceChild 中 passiveChild不属于microAppHead、microAppBody
        const notExistDom1 = document.createElement('span')
        const invokePrototypeMethodDom3 = document.createElement('span')
        const invokePrototypeMethodDom4 = document.createElement('span')
        document.head.insertBefore(invokePrototypeMethodDom3, notExistDom1)
        document.body.replaceChild(invokePrototypeMethodDom4, notExistDom1)
        expect(microAppHead.contains(invokePrototypeMethodDom3)).toBeTruthy()
        expect(microAppBody.contains(invokePrototypeMethodDom4)).toBeTruthy()

        // removeChild 删除不属于microAppHead、microAppBody的元素
        clearAppName()
        const invokePrototypeMethodDom5 = document.createElement('span')
        const invokePrototypeMethodDom6 = document.createElement('span')
        document.head.appendChild(invokePrototypeMethodDom5)
        document.body.appendChild(invokePrototypeMethodDom6)
        invokePrototypeMethodDom5.__MICRO_APP_NAME__ = 'test-app1'
        invokePrototypeMethodDom6.__MICRO_APP_NAME__ = 'test-app1'
        document.head.removeChild(invokePrototypeMethodDom5)
        document.body.removeChild(invokePrototypeMethodDom6)
        expect(document.head.contains(invokePrototypeMethodDom5)).toBeFalsy()
        expect(document.body.contains(invokePrototypeMethodDom6)).toBeFalsy()
        // 再次删除不会报错
        expect(document.head.removeChild(invokePrototypeMethodDom5)).toBe(invokePrototypeMethodDom5)
        expect(document.body.removeChild(invokePrototypeMethodDom5)).toBe(invokePrototypeMethodDom5)

        /**
         * handleNewNode
         */
        setAppName('test-app1')
        const handleNewNodeDom1 = document.createElement('style')
        handleNewNodeDom1.setAttribute('exclude', 'true')
        document.head.appendChild(handleNewNodeDom1)

        const handleNewNodeDom2 = document.createElement('style')
        document.head.appendChild(handleNewNodeDom2)

        expect(microAppHead.contains(handleNewNodeDom1)).toBeFalsy()
        expect(microAppHead.contains(handleNewNodeDom2)).toBeTruthy()

        // 模拟关闭样式隔离
        app1.scopecss = false
        const handleNewNodeDom3 = document.createElement('style')
        document.head.appendChild(handleNewNodeDom3)

        const handleNewNodeDom5 = document.createElement('link')
        document.head.appendChild(handleNewNodeDom5)
        expect(microAppHead.contains(handleNewNodeDom5)).toBeTruthy()
        app1.scopecss = true

        // link 标签的 exclude
        const handleNewNodeDom4 = document.createElement('link')
        handleNewNodeDom4.setAttribute('exclude', 'true')
        document.head.appendChild(handleNewNodeDom4)
        expect(microAppHead.contains(handleNewNodeDom4)).toBeFalsy()

        // 分支覆盖 - 动态插入具有ignore属性的link元素
        const handleNewNodeDom6 = document.createElement('link')
        handleNewNodeDom6.setAttribute('ignore', 'true')
        document.head.appendChild(handleNewNodeDom6)
        expect(microAppHead.contains(handleNewNodeDom6)).toBeTruthy()

        // microApp.start global plugin excludeChecker link 链接返回 true，则忽略
        const handleNewNodeDom7 = document.createElement('link')
        handleNewNodeDom7.setAttribute('href', '/demo7.css')
        expect(microAppHead.contains(handleNewNodeDom7)).toBeFalsy()

        // microApp.start module plugin excludeChecker link 链接返回 true，则忽略
        const handleNewNodeDom8 = document.createElement('link')
        handleNewNodeDom8.setAttribute('href', '/demo8.css')
        expect(microAppHead.contains(handleNewNodeDom8)).toBeFalsy()

        // microApp.start global plugin excludeChecker script 链接返回 true，则忽略
        const handleNewNodeDom9 = document.createElement('script')
        handleNewNodeDom9.setAttribute('css', '/demo9.js')
        expect(microAppHead.contains(handleNewNodeDom9)).toBeFalsy()

        // microApp.start module plugin excludeChecker link 链接返回 true，则忽略
        const handleNewNodeDom10 = document.createElement('script')
        handleNewNodeDom10.setAttribute('src', '/demo10.js')
        expect(microAppHead.contains(handleNewNodeDom10)).toBeFalsy()

        resolve(true)
      }, false)
    })
  })

  // 分支覆盖 - document 原型方法的 this 指向
  test('coverage of document this', async () => {
    const microAppElement2 = document.createElement('micro-app')
    microAppElement2.setAttribute('name', 'test-app2')
    microAppElement2.setAttribute('url', `http://127.0.0.1:${ports.source_patch}/ssr-render/`)

    appCon.appendChild(microAppElement2)

    await new Promise((resolve) => {
      microAppElement2.addEventListener('mounted', () => {
        setAppName('test-app2')
        const fakerDoc = new Document()

        const querySelector = Document.prototype.querySelector
        querySelector.call(fakerDoc, 'div')

        const querySelectorAll = Document.prototype.querySelectorAll
        querySelectorAll.call(fakerDoc, 'div')

        resolve(true)
      })
    })
  })

  // 分支覆盖 - 错误的 querySelector key
  test('coverage of error querySelector key', async () => {
    const microAppElement3 = document.createElement('micro-app')
    microAppElement3.setAttribute('name', 'test-app3')
    microAppElement3.setAttribute('url', `http://127.0.0.1:${ports.source_patch}/ssr-render/`)

    appCon.appendChild(microAppElement3)

    await new Promise((resolve) => {
      microAppElement3.addEventListener('mounted', () => {
        setAppName('test-app3')
        document.getElementById('sd$fs')
        document.getElementsByClassName('sd$fs')
        document.getElementsByTagName('sd$fs')
        document.getElementsByName('sd$fs')

        resolve(true)
      })
    })
  })
})
