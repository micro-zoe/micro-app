/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import { useProxyDocument } from '../common/proxy_document'
import { appInstanceMap } from '../../create_app'
import { globalScripts } from '../../source/scripts'
import microApp from '../..'

describe('source scripts', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.source_scripts)
    microApp.start({
      plugins: {
        global: [
          {
            loader (code, _url, _options) {
              // console.log('全局插件', _url)
              return code
            }
          },
          {
            loader: 'invalid loader' as any,
          },
          'invalid plugin' as any,
        ],
        modules: {
          'test-app1': [
            {
              loader (code, _url, _options) {
                // console.log('test-app1', _url)
                return code
              }
            }
          ],
          'test-app2': [
            {
              loader: 'invalid loader' as any,
            }
          ],
          'test-app5': 'invalid plugin' as any,
        }
      }
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  useProxyDocument()

  // 创建一个动态的无效的script标签
  test('append a script with error href', async () => {
    const microAppElement1 = document.createElement('micro-app')
    microAppElement1.setAttribute('name', 'test-app1')
    microAppElement1.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic/`)

    appCon.appendChild(microAppElement1)
    await new Promise((resolve) => {
      microAppElement1.addEventListener('mounted', () => {
        setAppName('test-app1')
        // 动态创建script
        const dynamicScript = document.createElement('script')
        dynamicScript.setAttribute('src', 'http://www.micro-app-test.com/not-exist.js')
        document.head.appendChild(dynamicScript)
        dynamicScript.onerror = function () {
          expect(console.error).toBeCalledWith('[micro-app] app test-app1:', expect.any(Error))
          resolve(true)
        }
      }, false)
    })
  }, 10000)

  // 不支持modalScript或带有noModule属性
  test('noModule or not support modal script', async () => {
    // 测试环境默认不支持module模式
    const microAppElement2 = document.createElement('micro-app')
    microAppElement2.setAttribute('name', 'test-app2')
    microAppElement2.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/common/`)

    appCon.appendChild(microAppElement2)
    await new Promise((resolve) => {
      microAppElement2.addEventListener('mounted', () => {
        setAppName('test-app2')
        // 插入一个无法运行的module
        const dynamicScript = document.createElement('script')
        dynamicScript.setAttribute('src', './module.js')
        dynamicScript.setAttribute('type', 'module')
        document.head.appendChild(dynamicScript)
        resolve(true)
      }, false)
    })
  })

  // 创建一个动态的无用的内联script元素
  test('append an unUseless dynamic inline script element', async () => {
    const microAppElement4 = document.createElement('micro-app')
    microAppElement4.setAttribute('name', 'test-app4')
    microAppElement4.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic/`)

    appCon.appendChild(microAppElement4)
    await new Promise((resolve) => {
      microAppElement4.addEventListener('mounted', () => {
        setAppName('test-app4')
        const dynamicScript = document.createElement('script')
        document.head.appendChild(dynamicScript)
        resolve(true)
      }, false)
    })
  })

  // 创建一个动态的正常的内联script元素
  test('append an dynamic inline script element', async () => {
    const microAppElement5 = document.createElement('micro-app')
    microAppElement5.setAttribute('name', 'test-app5')
    microAppElement5.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic/`)

    appCon.appendChild(microAppElement5)
    await new Promise((resolve) => {
      microAppElement5.addEventListener('mounted', () => {
        setAppName('test-app5')
        const dynamicScript = document.createElement('script')
        dynamicScript.textContent = 'console.error("inline script")'
        document.head.appendChild(dynamicScript)

        expect(console.error).toBeCalledWith('inline script')
        resolve(true)
      }, false)
    })
  })

  // 从自身缓存/全局缓存中获取js资源
  test('get js code from cache', async () => {
    const microAppElement6 = document.createElement('micro-app')
    microAppElement6.setAttribute('name', 'test-app6')
    microAppElement6.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/element-config`)

    appCon.appendChild(microAppElement6)
    await new Promise((resolve) => {
      microAppElement6.addEventListener('mounted', () => {
        // 一个是common-app的global.js，一个是element-config-app的script2.js
        expect(globalScripts.size).toBe(2)
        resolve(true)
      }, false)
    })

    const microAppElement7 = document.createElement('micro-app')
    microAppElement7.setAttribute('name', 'test-app7')
    microAppElement7.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic`)

    appCon.appendChild(microAppElement7)
    await new Promise((resolve) => {
      microAppElement7.addEventListener('mounted', () => {
        setAppName('test-app7')

        // 从全局缓存中获取js文件内容
        const dynamicScript = document.createElement('script')
        // script2已被test-app6放入全局缓存
        dynamicScript.setAttribute('src', '/element-config/script2.js')
        document.head.appendChild(dynamicScript)

        // 同步从全局缓存中获取到代码
        const app = appInstanceMap.get('test-app7')!
        expect(app.source.scripts.get(`http://127.0.0.1:${ports.source_scripts}/element-config/script2.js`)?.code?.length).toBeGreaterThan(1)

        // 再次创建相同文件，则从自身app缓存中获取文件
        const dynamicScript2 = document.createElement('script')
        dynamicScript2.setAttribute('src', '/element-config/script2.js')
        document.head.appendChild(dynamicScript2)

        resolve(true)
      }, false)
    })
  })

  // html自带js加载失败
  test('not exist js in html', async () => {
    const microAppElement8 = document.createElement('micro-app')
    microAppElement8.setAttribute('name', 'test-app8')
    microAppElement8.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/special-html/notexist-js.html`)

    appCon.appendChild(microAppElement8)
    await new Promise((resolve) => {
      microAppElement8.addEventListener('mounted', () => {
        expect(console.error).toHaveBeenLastCalledWith('[micro-app] app test-app8:', expect.any(Object))
        resolve(true)
      }, false)
    })
  })

  // html自带defer js加载失败
  test('error defer js in html', async () => {
    const microAppElement9 = document.createElement('micro-app')
    microAppElement9.setAttribute('name', 'test-app9')
    microAppElement9.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/special-html/error-deferjs.html`)

    appCon.appendChild(microAppElement9)
    await new Promise((resolve) => {
      microAppElement9.addEventListener('mounted', () => {
        setTimeout(() => {
          expect(console.error).toHaveBeenLastCalledWith('[micro-app] app test-app9:', expect.any(Object))
          resolve(true)
        }, 100)
      }, false)
    })
  })

  // 在inline模式下动态添加script
  test('append dynamic script with inline mode', async () => {
    const microAppElement10 = document.createElement('micro-app')
    microAppElement10.setAttribute('name', 'test-app10')
    microAppElement10.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic`)
    microAppElement10.setAttribute('inline', 'true')

    appCon.appendChild(microAppElement10)
    await new Promise((resolve) => {
      microAppElement10.addEventListener('mounted', () => {
        setAppName('test-app10')
        const dynamicScript = document.createElement('script')
        dynamicScript.setAttribute('src', '/common/script2.js')
        document.head.appendChild(dynamicScript)
        expect(document.contains(dynamicScript)).toBeFalsy()
        resolve(true)
      }, false)
    })
  })

  // 动态添加的script内部报错
  test('throw error in dynamic script', async () => {
    const microAppElement11 = document.createElement('micro-app')
    microAppElement11.setAttribute('name', 'test-app11')
    microAppElement11.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic`)

    appCon.appendChild(microAppElement11)
    await new Promise((resolve) => {
      microAppElement11.addEventListener('mounted', () => {
        setAppName('test-app11')
        const dynamicScript = document.createElement('script')
        dynamicScript.setAttribute('src', '/dynamic/throw-error.js')
        document.head.appendChild(dynamicScript)
        dynamicScript.onload = () => {
          expect(console.error).toHaveBeenLastCalledWith('[micro-app from runDynamicScript] app test-app11: ', expect.any(Error), expect.any(String))
          resolve(true)
        }
      }, false)
    })
  })

  // 关闭沙箱
  test('coverage code for disable sandbox', async () => {
    const microAppElement12 = document.createElement('micro-app')
    microAppElement12.setAttribute('name', 'test-app12')
    microAppElement12.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/special-html/disablesandbox.html`)
    microAppElement12.setAttribute('disableSandbox', 'true')

    appCon.appendChild(microAppElement12)
    await new Promise((resolve) => {
      microAppElement12.addEventListener('mounted', () => {
        expect(appInstanceMap.get('test-app12')?.sandBox).toBeNull()
        resolve(true)
      }, false)
    })
  })

  // 分支覆盖之app重新渲染，动态创建的script不在初始化执行
  test('coverage branch of remount an app with dynamic script', async () => {
    const microAppElement13 = document.createElement('micro-app')
    microAppElement13.setAttribute('name', 'test-app13')
    microAppElement13.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic`)

    let init = false
    appCon.appendChild(microAppElement13)
    await new Promise((resolve) => {
      microAppElement13.addEventListener('mounted', () => {
        setAppName('test-app13')
        const dynamicScript = document.createElement('script')
        dynamicScript.setAttribute('src', '/dynamic/script1.js')
        document.head.appendChild(dynamicScript)

        if (!init) {
          init = true
          dynamicScript.onload = () => {
            appCon.removeChild(microAppElement13)
            appCon.appendChild(microAppElement13)
            resolve(true)
          }
        }
      }, false)
    })
  })

  // 分支覆盖之创建一个动态的全局script
  test('coverage branch of append a global dynamic script', async () => {
    const microAppElement14 = document.createElement('micro-app')
    microAppElement14.setAttribute('name', 'test-app14')
    microAppElement14.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic`)

    appCon.appendChild(microAppElement14)
    await new Promise((resolve) => {
      microAppElement14.addEventListener('mounted', () => {
        setAppName('test-app14')
        const dynamicScript = document.createElement('script')
        dynamicScript.setAttribute('src', '/dynamic/script1.js')
        dynamicScript.setAttribute('global', 'true')
        document.head.appendChild(dynamicScript)
        dynamicScript.onload = () => {
          expect(globalScripts.get(`http://127.0.0.1:${ports.source_scripts}/dynamic/script1.js`)).toBe(expect.any(String))
        }
        resolve(true)
      }, false)
    })
  })

  // 初始化渲染时，某个js文件报错
  test('an error occurs at the first rendering', async () => {
    const microAppElement15 = document.createElement('micro-app')
    microAppElement15.setAttribute('name', 'test-app15')
    microAppElement15.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/dynamic/errorjs.html`)

    appCon.appendChild(microAppElement15)
    await new Promise((resolve) => {
      microAppElement15.addEventListener('mounted', () => {
        expect(console.error).toHaveBeenLastCalledWith('[micro-app from runScript] app test-app15: ', expect.any(Error))
        resolve(true)
      }, false)
    })
  })

  // 分支覆盖：初始化获取 defer js 文件失败
  test('coverage: failed to get defer js file', async () => {
    const microAppElement16 = document.createElement('micro-app')
    microAppElement16.setAttribute('name', 'test-app16')
    microAppElement16.setAttribute('url', `http://127.0.0.1:${ports.source_scripts}/special-html/notexistdefer.html`)

    appCon.appendChild(microAppElement16)
    await new Promise((resolve) => {
      microAppElement16.addEventListener('mounted', () => {
        expect(console.error).toHaveBeenLastCalledWith('[micro-app] app test-app16:', expect.any(Object))
        resolve(true)
      }, false)
    })
  })
})
