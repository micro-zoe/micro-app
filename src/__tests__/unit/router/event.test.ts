import './setup'
import * as EventUtil from '../../../sandbox/router/event'
import * as MicroApp from '../../../micro_app'
import * as CoreUtil from '../../../sandbox/router/core'
import * as LocationUtl from '../../../sandbox/router/location'
import { appInstanceMap } from '../../../create_app'

const getActiveApps = jest.spyOn(MicroApp,'getActiveApps')
const getMicroPathFromURL = jest.spyOn(CoreUtil,'getMicroPathFromURL')
const updateMicroLocation = jest.spyOn(LocationUtl,'updateMicroLocation').mockImplementation(() => {})
const  {
  addHistoryListener,
  dispatchHashChangeEventToMicroApp,
  dispatchPopStateEventToMicroApp,
  dispatchNativeEvent
} = EventUtil

const onpopstate = jest.fn();
const onhashchange = jest.fn();
function mockAppInstance(name: string) {
  appInstanceMap.set(name,{
    sandBox: {
      proxyWindow: {
        location: {
          href: 'http://www.micro-app-test.com/abc',
        } as any,
        onpopstate,
        onhashchange
      }
    },
    useMemoryRouter: true
  } as any )
}

describe("router event",() => {
  const appName = 'router-event'
  describe("addHistoryListener",() => {
    let listener: CallableFunction = () => {};

    beforeEach(() => {
      getActiveApps.mockReturnValue([appName])
      listener = addHistoryListener(appName)
      mockAppInstance(appName)
    })

    afterEach(() => {
      getActiveApps.mockClear()
      listener();
      appInstanceMap.clear()
      getMicroPathFromURL.mockClear()
      updateMicroLocation.mockClear()
    })

    test("no microPath with popstate event",() => {
      const event = new PopStateEvent('popstate')

      window.dispatchEvent(event)
      expect(updateMicroLocation).not.toBeCalled()
      expect(onpopstate).toBeCalled()
    })

    test("popstate event",() => {
      getMicroPathFromURL.mockReturnValue('/abc')
      const event = new PopStateEvent('popstate')

      window.dispatchEvent(event)
      expect(updateMicroLocation).toBeCalledWith(appName,'/abc',{
        href: 'http://www.micro-app-test.com/abc'
      })
      expect(onpopstate).toBeCalled()
    })

    test("popstate event with hash changed",() => {
      updateMicroLocation.mockImplementation(() => {
        const app: any = appInstanceMap.get(appName);
        app.sandBox.proxyWindow.location.hash = '#hash=1'
      })
      getMicroPathFromURL.mockReturnValue('/abc#hash=1')
      const event = new PopStateEvent('popstate')

      window.dispatchEvent(event)
      expect(updateMicroLocation).toBeCalledWith(appName,'/abc#hash=1',{
        href: 'http://www.micro-app-test.com/abc',
        hash: '#hash=1'
      })

      expect(onpopstate).toBeCalled()
      expect(onhashchange).toBeCalled()
      updateMicroLocation.mockClear()
    })

    test("onlyForBrowser with popstate event",() => {
      const event: any = new PopStateEvent('popstate')
      event.onlyForBrowser = true

      window.dispatchEvent(event)
      expect(onpopstate).not.toBeCalled()
    })

  })

  test("dispatchHashChangeEventToMicroApp",() => {
    const mock = jest.fn();
    dispatchHashChangeEventToMicroApp(appName,{
      location: {
        href: '/123'
      },
      onhashchange: mock
    } as any,'/abc')
    expect(mock).toBeCalledWith(expect.objectContaining({
      type: 'hashchange',
      oldURL: '/abc',
      newURL: '/123'
    }))
  })

  test("dispatchPopStateEventToMicroApp",() => {
    const mock = jest.fn();
    dispatchPopStateEventToMicroApp(appName,{
      location: {
        href: '/123'
      },
      onpopstate: mock
    } as any)
    expect(mock).toBeCalledWith(expect.objectContaining({
      type: 'popstate'
    }))
  })

  describe("dispatchNativeEvent",() => {
    beforeEach(() => {
      // effect app
      appInstanceMap.set(appName,{} as any)
    })

    afterEach(() => {
      appInstanceMap.clear();
    })

    test("no old href",() => {
      const mockPopstate = jest.fn();
      window.addEventListener('popstate',mockPopstate)

      dispatchNativeEvent(appName,true)
      expect(mockPopstate).toBeCalledWith(expect.objectContaining({
        state: null
      }))
    })

    test("have old href",() => {
      const mockHashChange = jest.fn();
      window.addEventListener('hashchange',mockHashChange)
      dispatchNativeEvent(appName,true,'/old')

      expect(mockHashChange).toBeCalledWith(expect.objectContaining({
        newURL: 'http://localhost/',
        oldURL: '/old'
      }))
    })
  })
})
