import { AppInterface } from '@micro-app/types'

import { initEnvOfNestedApp } from '../../libs/nest_app'
import { AppManager } from '../../app_manager'

describe('Additional Util', () => {
  const appManager = AppManager.getInstance()
  const appName = 'nest-app'
  const container = document.createElement('div') as HTMLElement
  // @ts-ignore
  container.disconnectedCallback = jest.fn()
  const app = {
    name: appName,
    container
  } as AppInterface

  window.__MICRO_APP_ENVIRONMENT__ = true
  initEnvOfNestedApp()

  beforeEach(() => {
    window.__MICRO_APP_ENVIRONMENT__ = true
    appManager.set(appName, app)
  })

  afterEach(() => {
    window.__MICRO_APP_ENVIRONMENT__ = undefined
    appManager.clear()
  })

  test('期望 initEnvOfNestedApp 可以卸载嵌套子应用', () => {
    const unmountEvent = new CustomEvent('unmount')
    window.dispatchEvent(unmountEvent)
    expect(appManager.get(appName)).toBe(undefined)
    // @ts-ignore
    expect(container.disconnectedCallback).toBeCalled()
  })

  test('期望 releaseUnmountOfNestedApp 可以移除监听事件', () => {
    const unmountEvent = new CustomEvent('unmount')
    window.dispatchEvent(unmountEvent)
    expect(appManager.get(appName)).toBe(app)
    // @ts-ignore
    expect(container.disconnectedCallback).not.toBeCalled()
  })
})
