import './setup'
import { createMicroHistory, nativeHistoryNavigate,navigateWithNativeEvent,patchHistory,releasePatchHistory } from '../../../sandbox/router/history'
import * as LocationUtil from '../../../sandbox/router/location'
import * as EventUtil from '../../../sandbox/router/event'
import * as MicroApp from '../../../micro_app'
import globalEnv  from '../../../libs/global_env'
import { appInstanceMap } from '../../../create_app'

const updateMicroLocation = jest.fn();
const dispatchNativeEvent = jest.fn();
jest.spyOn(LocationUtil,'updateMicroLocation').mockImplementation(updateMicroLocation)
jest.spyOn(EventUtil,'dispatchNativeEvent').mockImplementation(dispatchNativeEvent)
const getActiveApps = jest.spyOn(MicroApp,'getActiveApps')

describe("router history",() => {
  describe("createMicroHistory",() => {

    const appName = 'app';
    const microLocation: any = {
      href: 'http://www.micro-app-test.com/abc',
      origin: "http://www.micro-app-test.com",
      fullPath: '/abc',
      shadowLocation: {}
    }
    const history: any = createMicroHistory(appName,microLocation)

    beforeEach(() => {
      // effect app
      appInstanceMap.set(appName,{} as any)
    })

    afterEach(() => {
      appInstanceMap.clear();
    })
    test("state",() => {
      globalEnv.rawWindow.history.pushState({
        microAppState:{
          app: 1
        }
      },'/')

      expect(history.state).toBeTruthy()
      delete globalEnv.rawWindow.history.state.microAppState[appName];
    })

    test("pushState",() => {
      history.pushState({pushState:true},'/')
      expect(globalEnv.rawWindow.history.state).toEqual({pushState:true})
      expect(globalEnv.rawWindow.history.state.microAppState).toBeFalsy()
    })

    test("pushState with url",() => {
      const url = new URL('http://www.micro-app-test.com/def');
      url.searchParams.set('foo', 'bar');
      history.pushState({a:1},'http://www.micro-app-test.com/def',url)
      expect(globalEnv.rawWindow.history.state.microAppState).toEqual({
        app: {
          a: 1
        }
      })
      expect(updateMicroLocation).toBeCalledWith(appName,'/def?foo=bar',expect.anything())
    })

    test("replaceState",() => {
      history.replaceState({replaceState:true},'/')
      expect(globalEnv.rawWindow.history.state).toEqual({replaceState:true})
      expect(globalEnv.rawWindow.history.state.microAppState).toBeFalsy()
    })

    test("replaceState  with url",() => {
      const url = new URL('http://www.micro-app-test.com/def');
      url.searchParams.set('foo', 'bar');

      history.replaceState({replaceState:true},'/',url)
      expect(globalEnv.rawWindow.history.state.microAppState).toEqual({
        app: {
          replaceState: true
        }
      })
      expect(updateMicroLocation).toBeCalledWith(appName,'/def?foo=bar',expect.anything())
    })

    test("length",() => {
      expect(history.length).toBeTruthy()
    })
  })

  describe("nativeHistoryNavigate",() => {
    test("no Effective App",() => {
      const appName = 'nativeHistoryNavigate';

      nativeHistoryNavigate(appName,'pushState','/def?foo=bar',{a:1},'title')
      expect(globalEnv.rawWindow.history.state).not.toEqual({a:1})
    })
    test("is Effective App",() => {
      const appName = 'nativeHistoryNavigate';
      // effect app
      appInstanceMap.set(appName,{} as any)

      nativeHistoryNavigate(appName,'pushState','/def?foo=bar',{a:1},'title')
      expect(globalEnv.rawWindow.history.state).toEqual({a:1})
      appInstanceMap.delete(appName);
    })
  })

  describe("navigateWithNativeEvent",() => {
    test("no Effective App",() => {
      const appName = 'navigateWithNativeEvent';

      navigateWithNativeEvent(appName,'pushState',{} as any,true,{a:1},'title')
      expect(dispatchNativeEvent).not.toBeCalled();
    })

    test("with Effective App",() => {
      const appName = 'navigateWithNativeEvent';
      appInstanceMap.set(appName,{} as any)

      navigateWithNativeEvent(appName,'pushState',{} as any,true,{a:1},'title')
      expect(dispatchNativeEvent).toBeCalledWith(appName,true,null);
      appInstanceMap.delete(appName);
    })

    test("isAttach2Hash and oldFullPath !== result.fullPath",() => {
      const appName = 'navigateWithNativeEvent';
      appInstanceMap.set(appName,{} as any)

      navigateWithNativeEvent(appName,'pushState',{
        isAttach2Hash: true
      } as any,true,{a:1},'title')
      expect(dispatchNativeEvent).toBeCalledWith(appName,true,'http://localhost/def?foo=bar');
      appInstanceMap.delete(appName);
    })
  })

  describe("patchHistory and releasePatchHistory",() => {
    const rawWindow = globalEnv.rawWindow
    const appName = 'abc';

    beforeEach(() => {
      getActiveApps.mockReturnValue([appName])
      appInstanceMap.set(appName,{
        sandBox: {
          proxyWindow: {
            location: {}
          }
        },
        useMemoryRouter: true,
      } as any)

      delete rawWindow.history.state?.microAppState
      rawWindow.history.pushState({
        microAppState: {
          init: true
        }
      },'/','/')
      patchHistory()
    })

    afterEach(() => {
      releasePatchHistory()
      getActiveApps.mockClear()
      appInstanceMap.clear()
    })

    test("history.pushState",() => {
      rawWindow.history.pushState({pushState:true},'/','/abc')
      expect(dispatchNativeEvent).toBeCalledWith(appName,true,null);
      expect(rawWindow.history.state).toEqual({
        pushState:true,
        microAppState:{
          [appName]: null
        }
      })
    })

    test("history.pushState with same url",() => {
      rawWindow.history.pushState({pushState:true},'/','/')
      expect(rawWindow.history.state).toEqual({
          pushState:true,
          microAppState:{
            init: true,
            [appName]: null
        }
      })
    })

    test("history.replaceState",() => {
      rawWindow.history.replaceState({pushState:true},'/','/abc')
    })
  })
})
