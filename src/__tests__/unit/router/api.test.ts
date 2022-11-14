/**
 * @jest-environment jsdom
 */
import './setup'
import * as RouterApi from '../../../sandbox/router/api'
import * as HistoryApi from '../../../sandbox/router/history'
import globalEnv from '../../../libs/global_env'
import * as MicroApp from '../../../micro_app'
import { appInstanceMap } from '../../../create_app'

const navigateWithRawHistory = jest.fn();
jest.spyOn(HistoryApi,'navigateWithRawHistory').mockImplementation(navigateWithRawHistory)
const getActiveApps = jest.spyOn(MicroApp,'getActiveApps')

const {
  router,
  executeNavigationGuard,
  clearRouterWhenUnmount
}  = RouterApi

function mockAppInstance(name: string) {
  appInstanceMap.set(name,{
    sandBox: {
      proxyWindow: {
        location: {} as any
      }
    },
    useMemoryRouter: true
  } as any )
}

describe("router api",() => {
  afterAll(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks();
    getActiveApps.mockRestore()
  })

  describe("router",() => {
    const SLASH = '%2F'
    const state = {
      a: 'bc'
    }

    test("current",() => {
      expect(router.current).toBeTruthy()
    })

    test("encode",() => {
      expect(router.encode('/abc/def/#/page')).toBe(`${SLASH}abc${SLASH}def${SLASH}%23${SLASH}page`)
      expect(router.encode('/abc/def/#/page?query=q&queryB=qb')).toBe(`${SLASH}abc${SLASH}def${SLASH}%23${SLASH}page%3Fquery%25M2q%25M1queryB%25M2qb`)
    })

    test("decode",() => {
      expect(router.decode(`${SLASH}abc${SLASH}def${SLASH}%23${SLASH}page%3Fquery%25M2q%25M1queryB%25M2qb`)).toBe('/abc/def/#/page?query=q&queryB=qb')
    })

    describe('push',() => {
      test('push default use replaceState method',() => {
        router.push({
          name: 'abc',
          path: '/abc',
          state
        })
        expect(navigateWithRawHistory).toBeCalledWith('abc','replaceState',expect.anything(),state)
      })

      test('push with replace false',() => {
        router.push({
          name: 'abc',
          path: '/abc',
          state,
          replace: false
        })
        expect(navigateWithRawHistory).toBeCalledWith('abc','pushState',expect.anything(),state)
      })

      test("test push with app active",() => {
        getActiveApps.mockReturnValue(['abc'])
        mockAppInstance('abc')
        router.push({
          name: 'abc',
          path: 'http://www.abc.com',
          state
        })
        expect(navigateWithRawHistory).toBeCalledWith('abc','pushState',expect.anything(),state)
        getActiveApps.mockClear()
      })
    })

    describe("replace",() => {
      test('replace',() => {
        router.replace({
          name: 'abc',
          path: 'http://www.abc.com',
          state
        })
        expect(navigateWithRawHistory).toBeCalledWith('abc','replaceState',expect.anything(),state)
      })

      test('replace with replace false',() => {
        router.replace({
          name: 'abc',
          path: 'http://www.abc.com',
          state,
          replace: false
        })
        expect(navigateWithRawHistory).toBeCalledWith('abc','pushState',expect.anything(),state)
      })

      test("test replace with app active",() => {
        getActiveApps.mockReturnValue(['abc'])
        mockAppInstance('abc')
        router.replace({
          name: 'abc',
          path: 'http://www.abc.com',
          state
        })
        expect(navigateWithRawHistory).toBeCalledWith('abc','replaceState',expect.anything(),state)
      })

    })
    test("go,back,forward",() => {
      globalEnv.rawWindow.history.go = jest.fn()
      globalEnv.rawWindow.history.back = jest.fn()
      globalEnv.rawWindow.history.forward = jest.fn()

      router.go(1)
      router.back(1)
      router.forward()
      expect(globalEnv.rawWindow.history.go).toBeCalledWith(1)
      expect(globalEnv.rawWindow.history.back).toBeCalledWith(1)
      expect(globalEnv.rawWindow.history.forward).toBeCalled();

      globalEnv.rawWindow.history.go.mockReset();
    })


    describe("路由守卫",() => {
      const toParam = {
        name: 'abc',
        path: 'http://www.abc.com',
        state
      };

      afterAll(() => {
        clearRouterWhenUnmount('abc')
      })
      test('监听所有子应用的路由变化',(done) => {
        const cb = jest.fn().mockImplementation((to: any, from: any, name: string) => {
          expect(to).toEqual(toParam)
          expect(from).toEqual(toParam)
          expect(name).toEqual(to.name)
          const current = new Map();
          current.set(toParam.name,toParam)
          expect(router.current).toEqual(current);
          done()
        });
        router.beforeEach(cb)

        executeNavigationGuard(toParam.name,toParam,toParam)
        router.push(toParam)
        expect(cb).toBeCalled();
      })

      test("监听某个子应用的路由变化",(done) => {
        const abc = jest.fn();
        const other = jest.fn();
        router.beforeEach({
          abc,
          other
        })

        executeNavigationGuard(toParam.name,toParam,toParam)
        router.push(toParam)

        setTimeout(() => {
          expect(abc).toBeCalled();
          expect(other).not.toBeCalled();
          done();
        },0)
      })

      test("解绑路由监听",(done) => {
        const unCalled = jest.fn();
        const cancelCallback = router.beforeEach(unCalled)

        cancelCallback()
        executeNavigationGuard(toParam.name,toParam,toParam)
        router.push(toParam)

        setTimeout(() => {
          expect(unCalled).not.toBeCalled();
          done();
        },0)
      })

      test("afterEach",(done) => {
        const cb = jest.fn();
        router.afterEach(cb)

        executeNavigationGuard(toParam.name,toParam,toParam)
        router.push(toParam)

        setTimeout(() => {
          expect(cb).toBeCalled();
          done()
        },50)
      })
    })

    describe("attachToURL 系列",() => {
      afterEach(() => {
        getActiveApps.mockClear()
        appInstanceMap.clear();
      })

      test("attachToURL",() => {
        getActiveApps.mockReturnValue(['abc'])
        mockAppInstance('abc')
        const attachRouteToBrowserURL = jest.fn()
        jest.spyOn(HistoryApi,'attachRouteToBrowserURL').mockImplementation(attachRouteToBrowserURL)

        router.attachToURL('abc')
        expect(attachRouteToBrowserURL).toBeCalledWith('abc',{
          fullPath: "/?abc=NaN", isAttach2Hash: false
        },{
          microAppState: {"abc": null}
        })
      })

      test("attachAllToURL",() => {
        getActiveApps.mockReturnValue(['abc','def'])
        mockAppInstance('abc')
        mockAppInstance('def')

        const attachRouteToBrowserURL = jest.fn()
        jest.spyOn(HistoryApi,'attachRouteToBrowserURL').mockImplementation(attachRouteToBrowserURL)

        router.attachAllToURL({
          includeHiddenApp: false,
          includePreRender: false
        })

        expect(attachRouteToBrowserURL).toBeCalledTimes(2)
      })
    })

    describe("createDefaultPageApi",() => {
      test("setDefaultPage/getDefaultPage/removeDefaultPage",() => {
        const appName = 'abc'
        router.setDefaultPage({
          name: appName,
          path: '/abc'
        })

        const defaultPage = router.getDefaultPage(appName)
        expect(defaultPage).toBe('/abc')
        router.removeDefaultPage(appName)
        expect(router.getDefaultPage(appName)).toBeFalsy()
      })
    })

    describe("createBaseRouterApi",() => {
      test("setBaseAppRouter 和 getBaseAppRouter",() => {
        const baseRouter = {};
        router.setBaseAppRouter(baseRouter)

        expect(router.getBaseAppRouter()).not.toBe(baseRouter)
      })
    })
  })
})
