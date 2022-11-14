/**
 * @jest-environment jsdom
 */
import './setup'
import { createMicroLocation, autoTriggerNavigationGuard,updateMicroLocation } from '../../../sandbox/router/location'
import { appInstanceMap } from '../../../create_app'
import globalEnv  from '../../../libs/global_env'
import * as EventUtil from '../../../sandbox/router/event'
import * as HistoryUtil from '../../../sandbox/router/history'
import * as ApiUtil from '../../../sandbox/router/api'

const dispatchNativeEvent = jest.fn()
const nativeHistoryNavigate = jest.fn()
const navigateWithNativeEvent = jest.fn()
const executeNavigationGuard = jest.fn()
jest.spyOn(EventUtil, 'dispatchNativeEvent').mockImplementation(dispatchNativeEvent)
jest.spyOn(HistoryUtil, 'nativeHistoryNavigate').mockImplementation(nativeHistoryNavigate)
jest.spyOn(HistoryUtil, 'navigateWithNativeEvent').mockImplementation(navigateWithNativeEvent)
jest.spyOn(ApiUtil, 'executeNavigationGuard').mockImplementation(executeNavigationGuard)

const mockAssign = jest.fn()
const mockReload = jest.fn()
const mockReplace = jest.fn()
const a = document.createElement('a')
a.href = window.location.href
Object.defineProperty(globalEnv.rawWindow, 'location', {
  writable: true,
  value: {
    mock: true,
    hash: a.hash,
    host: a.host,
    hostname: a.hostname,
    href: a.href,
    origin: a.origin,
    pathname: a.pathname,
    port: a.port,
    protocol: a.protocol,
    search: a.search,
    toString: a.toString,
    reload: mockReload,
    replace: mockReplace,
    assign: mockAssign,
  },
})

describe('router location', () => {
  const appName = 'location'
  const url = 'http://www.micro-app-test.com/location?query=abc&def=ggg#hash=2'

  // 一些用例单独跑有问题，可能是共用 location
  describe('createMicroLocation', () => {
    const location = createMicroLocation(appName, url)

    beforeEach(() => {
      appInstanceMap.set(appName, {} as any)
    })

    afterEach(() => {
      appInstanceMap.clear()
    })

    test('assign', () => {
      location.assign('/abc')
      expect(mockAssign).toBeCalledWith('/?location=%2Fabc')
    })

    test('replace', () => {
      location.replace('/abc')
      expect(mockReplace).toBeCalledWith('/?location=%2Fabc')
    })

    test('reload', () => {
      location.reload()
      expect(mockReload).toBeCalled()
    })

    test('href', () => {
      expect(location.href).toBe(url)
    })

    describe('set href', () => {
      beforeEach(() => {
        appInstanceMap.set(appName, {} as any)
      })

      afterEach(() => {
        appInstanceMap.delete(appName)
      })

      test('set href with effect app', () => {
        location.href = 'http://www.micro-app-test.com/'
        expect(window.location.href).toBe('/?location=%2F')
      })

      test('set href with same pathname and search', () => {
        location.href = 'http://www.micro-app-test.com/location?query=abc&def=ggg#hash=3'
        expect(window.location.href).toBe('/?location=%2F')
        expect(dispatchNativeEvent).toBeCalledWith(appName, false, null)
        expect(nativeHistoryNavigate).toBeCalledWith(appName, 'pushState', '/?location=%2Flocation%3Fquery%25M2abc%25M1def%25M2ggg%23hash%25M23')
        expect(mockReload).not.toBeCalled()
      })

      test('set href with same pathname and search, no hash will reload', () => {
        location.href = 'http://www.micro-app-test.com/location?query=abc&def=ggg'
        expect(window.location.href).toBe('/?location=%2F')
        expect(dispatchNativeEvent).not.toBeCalled()
        expect(nativeHistoryNavigate).toBeCalledWith(appName, 'pushState', '/?location=%2Flocation%3Fquery%25M2abc%25M1def%25M2ggg')
        expect(mockReload).toBeCalled()
      })

      test('set href with different pathname and search, isAttach2Hash', () => {
        globalEnv.rawWindow.location.hash = '#hashsss=2'
        location.href = 'http://www.micro-app-test.com/location#hash=4'
        expect(dispatchNativeEvent).not.toBeCalled()
        expect(nativeHistoryNavigate).toBeCalledWith(appName, 'pushState', '/#hashsss=2?location=%2Flocation%23hash%25M24')
        expect(mockReload).toBeCalled()
        globalEnv.rawWindow.location.hash = ''
      })
    })

    test('pathname', () => {
      expect(location.pathname).toBe('/location')
    })

    describe('set pathname', () => {
      test('same pathname and has hash', () => {
        location.pathname = '/location'
        expect(dispatchNativeEvent).toBeCalledWith(appName, false)
        expect(nativeHistoryNavigate).not.toBeCalled()
        expect(mockReload).not.toBeCalled()
      })

      test.skip('same pathname and no hash', () => {
        location.pathname = '/location'
        // 设置 shadowLocation 的 hash？
      })

      test('different pathname', () => {
        location.pathname = '/abc'
        expect(dispatchNativeEvent).not.toBeCalled()
        expect(nativeHistoryNavigate).toBeCalledWith(appName, 'pushState', '/?location=%2Fabc%3Fquery%25M2abc%25M1def%25M2ggg%23hash%25M22')
        expect(mockReload).toBeCalled()
      })
    })

    test('search', () => {
      expect(location.search).toBe('?query=abc&def=ggg')
    })

    describe('set search', () => {
      test('same search and has hash', () => {
        location.search = '?query=abc&def=ggg'
        expect(dispatchNativeEvent).toBeCalledWith(appName, false)
        expect(nativeHistoryNavigate).not.toBeCalled()
        expect(mockReload).not.toBeCalled()
      })

      test.skip('same search and no hash', () => {
        location.search = '?query=abc&def=ggg'
      })

      test('different search', () => {
        location.search = '?query=abcd'
        expect(dispatchNativeEvent).not.toBeCalled()
        expect(nativeHistoryNavigate).toBeCalledWith(appName, 'pushState', '/?location=%2Flocation%3Fquery%25M2abcd%23hash%25M22')
        expect(mockReload).toBeCalled()
      })
    })

    test('hash', () => {
      expect(location.hash).toBe('#hash=2')
    })

    describe('set hash', () => {
      test('different hash', () => {
        location.hash = '#h=1'
        expect(navigateWithNativeEvent).toBeCalledWith(appName, 'pushState',
          {
            'fullPath': '/?location=%2Flocation%3Fquery%25M2abc%25M1def%25M2ggg%23h%25M21',
            'isAttach2Hash': false,
          }
          , false)
      })

      test('same hash', () => {
        location.hash = '#hash=2'
        expect(nativeHistoryNavigate).not.toBeCalled()
      })
    })

    test('fullPath', () => {
      expect(location.fullPath).toBe('/location?query=abc&def=ggg#hash=2')
    })
  })

  test('autoTriggerNavigationGuard', () => {
    const location = createMicroLocation(appName, url)

    autoTriggerNavigationGuard(appName, location)
    const newLocation = expect.objectContaining({
      name: appName,
      href: location.href,
    })
    expect(executeNavigationGuard).toBeCalledWith(appName, newLocation, newLocation)
  })

  describe("updateMicroLocation",() => {
    const location = createMicroLocation(appName, url)

    test("common",() => {
      updateMicroLocation(appName,'abc',location)
      expect(location.pathname).toBe('/abc')
      expect(executeNavigationGuard).toBeCalled();
    })

    test("with auto type",() => {
      updateMicroLocation(appName,'def',location,'autp')
      expect(executeNavigationGuard).toBeCalled();
    })

    test("with prevent type",() => {
      updateMicroLocation(appName,'gbv',location,'prevent')
      expect(executeNavigationGuard).not.toBeCalled();
    })
  })
})
