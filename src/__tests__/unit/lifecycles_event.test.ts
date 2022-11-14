
import dispatchLifecyclesEvent, { dispatchCustomEventToMicroApp } from '../../interact/lifecycles_event'
import microApp from '../../micro_app'

describe('LifeCycles Event', () => {
  describe('dispatchCustomEventToMicroApp', () => {
    test('使用 dispatchCustomEventToMicroApp 方法发送事件，window 可以接收到事件', () => {
      const callback = jest.fn()
      window.addEventListener('unmount-app', callback)

      dispatchCustomEventToMicroApp('unmount', 'app')

      expect(callback).toBeCalled()
    })
  })

  describe('dispatchLifecyclesEvent', () => {
    const appName = 'app'
    beforeAll(() => {
      console.error = jest.fn()
    })

    test('element 为空，报错', () => {
      // @ts-ignore
      dispatchLifecyclesEvent(undefined, appName, 'mount')

      expect(console.error).toBeCalledWith(`[micro-app] app ${appName}: element does not exist in lifecycle mount`)
    })

    test('发送 mount 事件，接收成功', () => {
      const container = document.createElement('div')
      container.addEventListener('mount', (e) => {
        const { name, container: detailContainer } = (e as CustomEvent).detail
        expect(name).toEqual(appName)
        expect(detailContainer).toEqual(container)
        expect(e.target).toEqual(container)
        expect(e.currentTarget).toEqual(container)
      })
      dispatchLifecyclesEvent(container, appName, 'mounted')
    })

    test('发送 created 事件，主应用监听了这个事件可以被触发', () => {
      const container = document.createElement('div')
      const onCreated = jest.fn()

      microApp.options.lifeCycles = { created: onCreated } as any
      dispatchLifecyclesEvent(container, appName, 'created')

      expect(onCreated).toBeCalled()
      microApp.options.lifeCycles = undefined
    })
  })
})
