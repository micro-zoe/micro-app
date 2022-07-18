/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import { useProxyDocument } from '../common/proxy_document'
import { appInstanceMap } from '../../create_app'
import { globalLinks, fetchLinkSuccess } from '../../source/links'
import microApp from '../..'

describe('source links', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.source_links)
    microApp.start({
      // 自定义fetch
      fetch (url: string, options: Record<string, unknown>) {
        return fetch(url, options).then((res) => {
          return res.text()
        })
      }
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  useProxyDocument()

  // 创建一个动态的无效的link标签
  test('append a link with error href', async () => {
    const microAppElement1 = document.createElement('micro-app')
    microAppElement1.setAttribute('name', 'test-app1')
    microAppElement1.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic/`)

    appCon.appendChild(microAppElement1)
    await new Promise((resolve) => {
      microAppElement1.addEventListener('mounted', () => {
        setAppName('test-app1')
        // 动态创建link
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('rel', 'stylesheet')
        dynamicLink.setAttribute('href', 'http://www.micro-app-test.com/not-exist.css')
        document.head.appendChild(dynamicLink)
        dynamicLink.onerror = function () {
          expect(console.error).toBeCalledWith('[micro-app] app test-app1:', expect.any(Error))
        }
        resolve(true)
      }, false)
    })
  })

  // 创建一个动态的非常规link
  test('append an unusual link', async () => {
    const microAppElement2 = document.createElement('micro-app')
    microAppElement2.setAttribute('name', 'test-app2')
    microAppElement2.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic/`)

    appCon.appendChild(microAppElement2)
    await new Promise((resolve) => {
      microAppElement2.addEventListener('mounted', () => {
        setAppName('test-app2')
        // 动态创建link
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('rel', 'preload')
        dynamicLink.setAttribute('href', './manifest.js')
        dynamicLink.setAttribute('id', 'dynamic-link-preload')
        document.head.appendChild(dynamicLink)

        expect(document.getElementById('dynamic-link-preload')).toBeNull()
        resolve(true)
      }, false)
    })
  })

  // html中加载错误的css资源
  test('load css error in html', async () => {
    const microAppElement3 = document.createElement('micro-app')
    microAppElement3.setAttribute('name', 'test-app3')
    microAppElement3.setAttribute('url', `http://127.0.0.1:${ports.source_links}/special-html/notexist-css.html`)

    appCon.appendChild(microAppElement3)
    await new Promise((resolve) => {
      microAppElement3.addEventListener('mounted', () => {
        expect(console.error).toBeCalled()
        resolve(true)
      }, false)
    })
  }, 10000)

  // 从自身缓存/全局缓存中获取css资源
  test('get css code from cache', async () => {
    const microAppElement4 = document.createElement('micro-app')
    microAppElement4.setAttribute('name', 'test-app4')
    microAppElement4.setAttribute('url', `http://127.0.0.1:${ports.source_links}/element-config`)

    appCon.appendChild(microAppElement4)
    await new Promise((resolve) => {
      microAppElement4.addEventListener('mounted', () => {
        expect(globalLinks.size).toBe(1)
        resolve(true)
      }, false)
    })

    const microAppElement5 = document.createElement('micro-app')
    microAppElement5.setAttribute('name', 'test-app5')
    microAppElement5.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic`)

    appCon.appendChild(microAppElement5)
    await new Promise((resolve) => {
      microAppElement5.addEventListener('mounted', () => {
        setAppName('test-app5')

        // 从全局缓存中获取css文件内容
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('rel', 'stylesheet')
        dynamicLink.setAttribute('href', '/element-config/link1.css')
        document.head.appendChild(dynamicLink)
        // 同步从全局缓存中获取到代码
        const app = appInstanceMap.get('test-app5')!
        expect(app.source.links.get(`http://127.0.0.1:${ports.source_links}/element-config/link1.css`)?.code?.length).toBeGreaterThan(1)

        // 再次创建相同文件，则从自身app缓存中获取文件
        const dynamicLink2 = document.createElement('link')
        dynamicLink2.setAttribute('rel', 'stylesheet')
        dynamicLink2.setAttribute('href', '/element-config/link1.css')
        document.head.appendChild(dynamicLink2)

        resolve(true)
      }, false)
    })
  })

  // 测试分支覆盖 html自带css从全局缓存取值&创建新的动态全局css缓存
  test('coverage of static html global & dynamic global css', async () => {
    const microAppElement6 = document.createElement('micro-app')
    microAppElement6.setAttribute('name', 'test-app6')
    microAppElement6.setAttribute('url', `http://127.0.0.1:${ports.source_links}/common`)

    appCon.appendChild(microAppElement6)
    await new Promise((resolve) => {
      microAppElement6.addEventListener('mounted', () => {
        resolve(true)
      }, false)
    })

    const microAppElement7 = document.createElement('micro-app')
    microAppElement7.setAttribute('name', 'test-app7')
    microAppElement7.setAttribute('url', `http://127.0.0.1:${ports.source_links}/element-config`)

    appCon.appendChild(microAppElement7)
    await new Promise((resolve) => {
      microAppElement7.addEventListener('mounted', () => {
        resolve(true)
      }, false)
    })

    const microAppElement8 = document.createElement('micro-app')
    microAppElement8.setAttribute('name', 'test-app8')
    microAppElement8.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic`)

    appCon.appendChild(microAppElement8)
    await new Promise((resolve) => {
      microAppElement8.addEventListener('mounted', () => {
        setAppName('test-app8')

        // 动态创建全局缓存文件
        const dynamicLink1 = document.createElement('link')
        dynamicLink1.setAttribute('rel', 'stylesheet')
        dynamicLink1.setAttribute('href', './link1.css')
        dynamicLink1.setAttribute('global', 'true')
        document.head.appendChild(dynamicLink1)

        // 分支覆盖 -- prefetch 且 无href
        const dynamicLink2 = document.createElement('link')
        dynamicLink2.setAttribute('rel', 'prefetch')
        document.head.appendChild(dynamicLink2)

        // 分支覆盖 -- 动态的 modulepreload
        const dynamicLink3 = document.createElement('link')
        dynamicLink3.setAttribute('rel', 'modulepreload')
        dynamicLink1.setAttribute('href', './test.js')
        document.head.appendChild(dynamicLink3)

        resolve(true)
      }, false)
    })
  })

  // 请求css成功后处理时，parent为空
  test('empty parentNode when fetch css success', () => {
    const microAppHead = document.createElement('micro-app-head')
    const info = { placeholder: document.createComment('link comment') } as any
    const app = { scopecss: false } as any

    fetchLinkSuccess(
      'http://empty.parentNode.com/test.css',
      info,
      'css-text',
      microAppHead,
      app,
    )

    expect(microAppHead.children[0] instanceof HTMLStyleElement).toBeTruthy()
  })
})
