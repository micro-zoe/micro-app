import './setup'
import {
  removeMicroState, setMicroState, getMicroState,
  encodeMicroPath, decodeMicroPath,
  getMicroPathFromURL, setMicroPathToURL, removeMicroPathFromURL, getNoHashMicroPathFromURL,
  isEffectiveApp
} from '../../../sandbox/router/core'
import { appInstanceMap } from '../../../create_app'

describe("router core",() => {
  const appName = 'router-core'

  describe("state crud",() => {
    const microState = {a:1}

    afterEach(() => {
      if (window.history.state) {
        delete window.history.state.microAppState
      }
    })

    test("setMicroState",() => {
      window.history.pushState({init: true},'title')
      const state = setMicroState(appName,microState)
      expect(state).toEqual({
        init: true,
        microAppState: {
          [appName]: microState
        }
      })
    })

    test("removeMicroState",() => {
      const rawState = {
        init: true,
        microAppState: {
          [appName]: microState
        }
      }
      const state = removeMicroState(appName,rawState)
      expect(state).toEqual({
        init: true,
      })
    })
    test("getMicroState",() => {
      window.history.pushState({
        init: true,
        microAppState: {
          [appName]: microState
        }
      },'title')
      const state = getMicroState(appName)
      expect(state).toEqual(microState)
    })
  })

  describe("path encode and decode",() => {
    const path = '/abc?query=1&bbb=3#hash=999&jj=k'
    const slash = '%2F'
    const query = '%3F'
    const equal = '%25M2'
    const and = '%25M1'

    test("encodeMicroPath",() => {
      const newPath = encodeMicroPath(path)
      expect(newPath).toEqual(`${slash}abc${query}query${equal}1${and}bbb${equal}3%23hash${equal}999${and}jj${equal}k`)
    })

    test("decodeMicroPath",() => {
      const newPath = decodeMicroPath(`${slash}abc${query}query${equal}1${and}bbb${equal}3%23hash${equal}999${and}jj${equal}k`)
      expect(newPath).toEqual(path)
      expect(decodeMicroPath('%2Fmicro-app')).toEqual('/micro-app')
    })
  })

  describe("path and url", () => {
    afterEach(() => {
      window.location.hash = ''
    })

    test("getMicroPathFromURL",() => {
      const path = getMicroPathFromURL(appName)
      expect(path).toEqual(null)

      window.location.hash = `#?${appName}=hash`
      const newPath = getMicroPathFromURL(appName)
      expect(newPath).toEqual('hash')
    })

    test("setMicroPathToURL",() => {
      const result = setMicroPathToURL(appName,{
        pathname: '/abc',
        search: '?search=a',
        hash: "#hash=123"
      } as any)
      expect(result).toEqual({
        fullPath: `/?${appName}=%2Fabc%3Fsearch%25M2a%23hash%25M2123`,
        isAttach2Hash: false
      })
    })

    test("setMicroPathToURL with parent is hash router",() => {
      window.location.hash = `#?${appName}=hash`
      const result = setMicroPathToURL(appName,{
        pathname: '/abc',
        search: '?search=a',
        hash: "#hash=123"
      } as any)
      expect(result).toEqual({
        fullPath: `/#?${appName}=%2Fabc%3Fsearch%25M2a%23hash%25M2123`,
        isAttach2Hash: true
      })
    })

    test("removeMicroPathFromURL",() => {
      const result = removeMicroPathFromURL(appName,{
        pathname: '/abc',
        search: '?search=a',
        hash: "#hash=123"
      } as any)
      expect(result).toEqual({
        fullPath: `/abc?search=a#hash=123`,
        isAttach2Hash: false
      })
    })

    test("removeMicroPathFromURL with hash router parent",() => {
      const result = removeMicroPathFromURL(appName,{
        pathname: '/abc',
        search: '?search=a',
        hash: `#?hash=123&${appName}=app`
      } as any)
      expect(result).toEqual({
        fullPath: `/abc?search=a#?hash=123`,
        isAttach2Hash: true
      })
    })

    test("removeMicroPathFromURL with history router parent",() => {
      const result = removeMicroPathFromURL(appName,{
        pathname: '/abc',
        search: `?search=a&${appName}=xxx`,
        hash: "#hash=123"
      } as any)
      expect(result).toEqual({
        fullPath: `/abc?search=a#hash=123`,
        isAttach2Hash: false
      })
    })

  })

  test("getNoHashMicroPathFromURL",() => {
    window.location.hash = `#?${appName}=hash`
    const path = getNoHashMicroPathFromURL(appName,'http://www.abc.com')
    expect(path).toEqual('http://www.abc.com/hash')
    window.location.hash = ''
  })
  // isEffectiveApp

  describe("isEffectiveApp",() => {
    afterEach(() => {
      appInstanceMap.clear()
    })

    test("no effect app",() => {
      expect(isEffectiveApp(appName)).toBe(false)
    })

    test("effect app",() => {
      appInstanceMap.set(appName,{} as any)
      expect(isEffectiveApp(appName)).toBe(true)
    })

    test("effect app but isPrefetch",() => {
      appInstanceMap.set(appName,{
        isPrefetch: true
      } as any)
      expect(isEffectiveApp(appName)).toBe(false)
    })
  })

})
