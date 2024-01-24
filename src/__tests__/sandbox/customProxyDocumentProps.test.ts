/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import microApp from '../..'

describe('sandbox custom proxy document property', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.custom_proxy_document)

    microApp.start({
      customProxyDocumentProps: {
        title: {
          get(){
            return "title of micro-app environment get"
          },
          set(value){
            return "title of micro-app environment set"
          }
        },
      }
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 自定义代理 document.title 测试
  test('custom proxy document.title', async () => {
    const microAppElement1 = document.createElement('micro-app')
    microAppElement1.setAttribute('name', 'test-app1')
    microAppElement1.setAttribute('url', `http://127.0.0.1:${ports.custom_proxy_document}/common/`)

    appCon.appendChild(microAppElement1)

    await new Promise((resolve) => {
      microAppElement1.addEventListener('mounted', () => {
        setAppName('test-app1')
        // get current title
        const originTitle = document.title

        // change title
        document.title = 'new title'

        // change title not working
        expect(document.title).toBe(originTitle)
        resolve(true)
      })
    })
  })
})
